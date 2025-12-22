import { isMainFeatureEnabled } from '../../config/featureFlags';
import { CortexService } from '../../../services/gemini';
import { TickCommitter } from '../TickCommitter';
import { LimbicSystem } from '../LimbicSystem';
import { CortexSystem } from '../CortexSystem';
import { useArtifactStore } from '../../../stores/artifactStore';
import { SYSTEM_CONFIG } from '../../config/systemConfig';
import { getCurrentTraceId } from '../../trace/TraceContext';
import { p0MetricAdd } from '../TickLifecycleTelemetry';

// P0.1 COMMIT 3: Action-First Policy
// Feature flag - can be disabled if causing issues
const ACTION_FIRST_ENABLED = (SYSTEM_CONFIG.features as Record<string, boolean>).P011_ACTION_FIRST_ENABLED ?? true;

type ActionFirstResult = {
  handled: boolean;
  action?: 'CREATE' | 'READ' | 'APPEND' | 'REPLACE';
  target?: string;
  payload?: string;
  assumption?: string;
};

function updateContextAfterAction(ctx: any): void {
  const now = Date.now();
  ctx.silenceStart = now;
  ctx.lastSpeakTimestamp = now;
  ctx.goalState.lastUserInteractionAt = now;
  ctx.consecutiveAgentSpeeches = 0;
  ctx.hadExternalRewardThisTick = true;
  ctx.ticksSinceLastReward = 0;
}

function normalizeArtifactNameCandidates(rawTarget: string): string[] {
  const t = String(rawTarget || '').trim();
  if (!t) return [];
  if (t.startsWith('art-')) return [t];
  const lower = t.toLowerCase();
  if (lower.endsWith('.md')) return [t, t.slice(0, -3)];
  return [t, `${t}.md`];
}

function splitTargetAndPayload(input: string): { target: string; payload: string } {
  const idx = input.indexOf(':');
  if (idx < 0) return { target: input.trim(), payload: '' };
  return {
    target: input.slice(0, idx).trim(),
    payload: input.slice(idx + 1).trim()
  };
}

function detectActionableIntent(input: string): ActionFirstResult {
  const lower = input.toLowerCase().trim();

  const slugify = (s: string) => {
    const raw = String(s || '')
      .toLowerCase()
      .trim()
      .replace(/^o\s+/, '')
      .replace(/[^a-z0-9]+/g, '-');
    const collapsed = raw.replace(/-+/g, '-').replace(/^-|-$/g, '');
    return collapsed.slice(0, 48);
  };

  const deriveCreateTarget = (rawTarget: string) => {
    const t = String(rawTarget || '').trim();
    if (!t) return 'artifact.md';
    const first = t.split(/\s+/)[0];
    const looksLikeFilename = first.includes('.') || first.length >= 3;
    if (looksLikeFilename && !first.includes('/') && !first.includes('\\')) {
      if (first.toLowerCase().endsWith('.md')) return first;
      if (first.includes('.')) return first;
      return `${first}.md`;
    }
    const slug = slugify(t);
    return `${slug || 'artifact'}.md`;
  };
  
  // CREATE patterns: "stwórz plik X", "create file X", "napisz X", "write X"
  const createMatch = lower.match(/(?:stw[óo]rz|utw[óo]rz|stworz|utworz|create|napisz|write|zr[óo]b|zrob)\s+(?:plik\s+)?(.+)/i);
  if (createMatch) {
    return { handled: true, action: 'CREATE', target: deriveCreateTarget(createMatch[1]) };
  }
  
  // APPEND patterns: require verb + target + payload (after ':')
  // Examples: "dopisz do note.md: ...", "dodaj do note: ...", "dorzuc do note.md: ..."
  const appendMatch = lower.match(/(?:dopisz|dodaj|dorzuc|append|add)\s+(?:do|to)\s+(.+)/i);
  if (appendMatch) {
    const { target, payload } = splitTargetAndPayload(String(appendMatch[1] || ''));
    if (target && payload) return { handled: true, action: 'APPEND', target, payload };
  }

  // REPLACE patterns: require verb + target; payload optional.
  // If payload is present after ':', we'll use it as new full content.
  const replaceMatch = lower.match(/(?:zamień|zamien|zastąp|zastap|podmień|podmien|replace)\s+(?:w|w\s+pliku|in)\s+(.+)/i);
  if (replaceMatch) {
    const { target, payload } = splitTargetAndPayload(String(replaceMatch[1] || ''));
    if (target) return { handled: true, action: 'REPLACE', target, payload };
  }
  
  // READ patterns: "pokaż X", "read X", "otwórz X", "open X"
  const readMatch = lower.match(/(?:pokaż|pokaz|read|otwórz|otworz|open|wyświetl|wyswietl|show)\s+([^\s,]+)/i);
  if (readMatch) {
    return { handled: true, action: 'READ', target: readMatch[1] };
  }
  
  return { handled: false };
}

export function detectActionableIntentForTesting(input: string): ActionFirstResult {
  return detectActionableIntent(input);
}

export type TraceLike = {
  traceId: string;
  tickNumber: number;
  agentId: string | null;
};

export type ReactiveCallbacksLike = {
  onMessage: (role: string, text: string, type: any, meta?: any) => void;
  onThought: (thought: string) => void;
  onLimbicUpdate: (limbic: any) => void;
};

export async function runReactiveStep(input: {
  ctx: any;
  userInput: string;
  callbacks: ReactiveCallbacksLike;
  memorySpace: any;
  trace: TraceLike;
}): Promise<void> {
  const { ctx, userInput, callbacks, memorySpace, trace } = input;

  TickCommitter.markUserInput();

  // P0.1: Action-First - execute tool commands immediately without asking
  if (ACTION_FIRST_ENABLED) {
    const actionIntent = detectActionableIntent(userInput);
    if (actionIntent.handled && actionIntent.action && actionIntent.target) {
      const store = useArtifactStore.getState();
      const target = actionIntent.target;
      
      try {
        if (actionIntent.action === 'CREATE') {
          const id = store.create(target, '');
          const traceId = getCurrentTraceId();
          if (traceId) p0MetricAdd(traceId, { actionFirstTriggered: 1, actionType: 'CREATE' });
          callbacks.onMessage('assistant', `Utworzyłem ${target} (${id}). Poprawić coś?`, 'speech');
          updateContextAfterAction(ctx);
          return;
        }
        
        if (actionIntent.action === 'READ') {
          const candidates = normalizeArtifactNameCandidates(target);
          for (const c of candidates) {
            if (c.startsWith('art-')) {
              const art = store.get(c);
              if (art) {
                const traceId = getCurrentTraceId();
                if (traceId) p0MetricAdd(traceId, { actionFirstTriggered: 1, actionType: 'READ' });
                callbacks.onMessage('assistant', `${art.name}:\n\n${art.content || '(pusty)'}`, 'speech');
                updateContextAfterAction(ctx);
                return;
              }
              continue;
            }
            const byName = store.getByName(c);
            if (byName.length === 1) {
              const art = byName[0];
              const traceId = getCurrentTraceId();
              if (traceId) p0MetricAdd(traceId, { actionFirstTriggered: 1, actionType: 'READ' });
              callbacks.onMessage('assistant', `${art.name}:\n\n${art.content || '(pusty)'}`, 'speech');
              updateContextAfterAction(ctx);
              return;
            }
          }
          // Not found - fall through to LLM
        }
        
        if (actionIntent.action === 'APPEND') {
          const payload = String(actionIntent.payload || '').trim();
          if (payload) {
            const candidates = normalizeArtifactNameCandidates(target);
            for (const c of candidates) {
              if (c.startsWith('art-')) {
                store.append(c, `\n\n${payload}`);
                const traceId = getCurrentTraceId();
                if (traceId) p0MetricAdd(traceId, { actionFirstTriggered: 1, actionType: 'APPEND' });
                callbacks.onMessage('assistant', `Dopisałem do ${c}. Poprawić coś?`, 'speech');
                updateContextAfterAction(ctx);
                return;
              }
              const byName = store.getByName(c);
              if (byName.length === 1) {
                store.append(byName[0].id, `\n\n${payload}`);
                const traceId = getCurrentTraceId();
                if (traceId) p0MetricAdd(traceId, { actionFirstTriggered: 1, actionType: 'APPEND' });
                callbacks.onMessage('assistant', `Dopisałem do ${byName[0].name}. Poprawić coś?`, 'speech');
                updateContextAfterAction(ctx);
                return;
              }
            }
          }
          // No payload or not found - fall through to LLM
        }

        if (actionIntent.action === 'REPLACE') {
          const candidates = normalizeArtifactNameCandidates(target);
          let replaced = false;
          for (const c of candidates) {
            if (c.startsWith('art-')) {
              const next = String(actionIntent.payload || '').trim() || `TODO: REPLACE requested\n\n${userInput}`;
              store.replace(c, next);
              const traceId = getCurrentTraceId();
              if (traceId) p0MetricAdd(traceId, { actionFirstTriggered: 1, actionType: 'REPLACE' });
              callbacks.onMessage('assistant', `Podmieniłem treść w ${c}. Poprawić coś?`, 'speech');
              updateContextAfterAction(ctx);
              return;
            }
            const byName = store.getByName(c);
            if (byName.length === 1) {
              const next = String(actionIntent.payload || '').trim() || `TODO: REPLACE requested\n\n${userInput}`;
              store.replace(byName[0].id, next);
              const traceId = getCurrentTraceId();
              if (traceId) p0MetricAdd(traceId, { actionFirstTriggered: 1, actionType: 'REPLACE' });
              callbacks.onMessage('assistant', `Podmieniłem treść w ${byName[0].name}. Poprawić coś?`, 'speech');
              updateContextAfterAction(ctx);
              replaced = true;
              break;
            }
          }
          if (replaced) return;
          // Not found - fall through to LLM
        }
      } catch (e) {
        // Action failed, fall through to normal processing
        callbacks.onThought(`[ACTION_FIRST_ERROR] ${(e as Error)?.message || 'unknown'}`);
      }
    }
  }

  const prefetchedMemories = isMainFeatureEnabled('ONE_MIND_ENABLED')
    ? ((await memorySpace.hot.semanticSearch(userInput)) as any)
    : undefined;

  const result = await CortexSystem.processUserMessage({
    text: userInput,
    currentLimbic: ctx.limbic,
    currentSoma: ctx.soma,
    conversationHistory: ctx.conversation,
    identity: ctx.agentIdentity,
    sessionOverlay: ctx.sessionOverlay,
    memorySpace,
    prefetchedMemories
  });

  const intent = await CortexService.detectIntent(userInput);

  if (intent.style === 'POETIC') {
    ctx.poeticMode = true;
    console.log('Intent Detected: POETIC MODE ENABLED');
  } else if (intent.style === 'SIMPLE') {
    ctx.poeticMode = false;
    console.log('Intent Detected: POETIC MODE DISABLED (Simple Style Requested)');
  } else if (intent.style === 'ACADEMIC') {
    ctx.poeticMode = false;
  }

  if (result.moodShift) {
    ctx.limbic = LimbicSystem.applyMoodShift(ctx.limbic, result.moodShift);
    callbacks.onLimbicUpdate(ctx.limbic);
  }

  if (result.internalThought) {
    callbacks.onMessage('assistant', result.internalThought, 'thought');
  }

  if (isMainFeatureEnabled('ONE_MIND_ENABLED') && trace.agentId) {
    try {
      const commit = TickCommitter.commitSpeech({
        agentId: trace.agentId,
        traceId: trace.traceId,
        tickNumber: trace.tickNumber,
        origin: 'reactive',
        speechText: result.responseText
      });

      if (commit.committed) {
        callbacks.onMessage('assistant', result.responseText, 'speech', {
          knowledgeSource: result.knowledgeSource,
          evidenceSource: result.evidenceSource,
          evidenceDetail: result.evidenceDetail,
          generator: result.generator
        });
      } else {
        callbacks.onThought(`[REACTIVE_SUPPRESSED] ${commit.blockReason || 'UNKNOWN'}`);
      }
    } catch (e) {
      callbacks.onThought(`[REACTIVE_COMMIT_ERROR] ${(e as Error)?.message || 'unknown'}`);
      callbacks.onMessage('assistant', result.responseText, 'speech', {
        knowledgeSource: result.knowledgeSource,
        evidenceSource: result.evidenceSource,
        evidenceDetail: result.evidenceDetail,
        generator: result.generator
      });
    }
  } else {
    callbacks.onMessage('assistant', result.responseText, 'speech', {
      knowledgeSource: result.knowledgeSource,
      evidenceSource: result.evidenceSource,
      evidenceDetail: result.evidenceDetail,
      generator: result.generator
    });
  }

  const now = Date.now();
  ctx.silenceStart = now;
  ctx.lastSpeakTimestamp = now;
  ctx.goalState.lastUserInteractionAt = now;

  ctx.consecutiveAgentSpeeches = 0;

  ctx.hadExternalRewardThisTick = true;
  ctx.ticksSinceLastReward = 0;
}
