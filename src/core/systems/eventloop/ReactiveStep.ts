import { isMainFeatureEnabled } from '../../config/featureFlags';
import { CortexService } from '../../../llm/gemini';
import { TickCommitter } from '../TickCommitter';
import { LimbicSystem } from '../LimbicSystem';
import { CortexSystem } from '../CortexSystem';
import { useArtifactStore, normalizeArtifactRef } from '../../../stores/artifactStore';
import { SYSTEM_CONFIG } from '../../config/systemConfig';
import { getCurrentTraceId } from '../../trace/TraceContext';
import { p0MetricAdd } from '../TickLifecycleTelemetry';
import { eventBus } from '../../EventBus';
import { AgentType, PacketType } from '../../../types';
import { generateUUID } from '../../../utils/uuid';

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

function splitTargetAndPayload(input: string): { target: string; payload: string } {
  const idx = input.indexOf(':');
  if (idx < 0) return { target: input.trim(), payload: '' };
  return {
    target: input.slice(0, idx).trim(),
    payload: input.slice(idx + 1).trim()
  };
}

function detectActionableIntent(input: string): ActionFirstResult {
  const raw = String(input || '');
  const trimmed = raw.trim();
  const normalized = trimmed
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  if (
    raw.includes('?') ||
    normalized.startsWith('czy ') ||
    normalized.includes('umiesz') ||
    normalized.includes('mozesz') ||
    normalized.includes('potrafisz')
  ) {
    return { handled: false };
  }

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
  
  // CREATE patterns: "stworz/utworz/zapisz plik X"
  const createMatch = normalized.match(/(?:stworz|utworz|zapisz)\s+(?:plik\s+)?(.+)/i);
  if (createMatch) {
    return { handled: true, action: 'CREATE', target: deriveCreateTarget(createMatch[1]) };
  }
  
  // APPEND patterns: require verb + target + payload (after ':')
  // Examples: "dopisz do note.md: ...", "dodaj do note: ..."
  const appendMatch = normalized.match(/(?:dopisz|dodaj)\s+(?:do)\s+(.+)/i);
  if (appendMatch) {
    const { target, payload } = splitTargetAndPayload(String(appendMatch[1] || ''));
    if (target && payload) return { handled: true, action: 'APPEND', target, payload };
  }

  // REPLACE patterns: require verb + target; payload optional.
  // If payload is present after ':', we'll use it as new full content.
  const replaceMatch = normalized.match(/(?:zamien|zastap)\s+(?:w|w\s+pliku)\s+(.+)/i);
  if (replaceMatch) {
    const { target, payload } = splitTargetAndPayload(String(replaceMatch[1] || ''));
    if (target) return { handled: true, action: 'REPLACE', target, payload };
  }
  
  // READ patterns: "pokaz X", "otworz X"
  const readMatch = normalized.match(/(?:pokaz|otworz)\s+([^\s,]+)/i);
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

      const resolveRef = (refRaw: string) => {
        const traceId = getCurrentTraceId();
        if (traceId) p0MetricAdd(traceId, { artifactResolveAttempt: 1 });
        const resolved = normalizeArtifactRef(refRaw);
        if (traceId) {
          p0MetricAdd(traceId, resolved.ok ? { artifactResolveSuccess: 1 } : { artifactResolveFail: 1 });
        }
        return resolved;
      };

      const emitToolIntent = (tool: string, arg: string) => {
        const intentId = generateUUID();
        eventBus.publish({
          id: intentId,
          timestamp: Date.now(),
          source: AgentType.CORTEX_FLOW,
          type: PacketType.TOOL_INTENT,
          payload: { tool, arg },
          priority: 0.8
        });
        return intentId;
      };

      const emitToolResult = (tool: string, intentId: string, payload: Record<string, unknown>) => {
        eventBus.publish({
          id: generateUUID(),
          timestamp: Date.now(),
          source: AgentType.CORTEX_FLOW,
          type: PacketType.TOOL_RESULT,
          payload: { tool, intentId, ...payload },
          priority: 0.8
        });
      };

      const emitToolError = (tool: string, intentId: string, payload: Record<string, unknown>, error: string) => {
        eventBus.publish({
          id: generateUUID(),
          timestamp: Date.now(),
          source: AgentType.CORTEX_FLOW,
          type: PacketType.TOOL_ERROR,
          payload: { tool, intentId, ...payload, error },
          priority: 0.9
        });
      };

      try {
        if (actionIntent.action === 'CREATE') {
          const intentId = emitToolIntent('CREATE', target);
          const traceId = getCurrentTraceId();
          if (traceId) p0MetricAdd(traceId, { actionFirstTriggered: 1, actionType: 'CREATE' });
          try {
            const id = store.create(target, '');
            if (traceId) p0MetricAdd(traceId, { actionFirstExecuted: 1 });
            emitToolResult('CREATE', intentId, { id, name: target });
            callbacks.onMessage('assistant', `Utworzy?,em ${target} (${id}). Poprawi?? co?>?`, 'speech');
            updateContextAfterAction(ctx);
            return;
          } catch (e) {
            emitToolError('CREATE', intentId, { arg: target }, (e as Error)?.message || 'unknown');
            return;
          }
        }

        if (actionIntent.action === 'READ') {
          const resolved = resolveRef(target);
          const intentId = emitToolIntent('READ_ARTIFACT', resolved.ok ? resolved.id : target);
          const traceId = getCurrentTraceId();
          if (traceId) p0MetricAdd(traceId, { actionFirstTriggered: 1, actionType: 'READ' });
          if (!resolved.ok) {
            emitToolError('READ_ARTIFACT', intentId, { arg: target }, resolved.userMessage);
            callbacks.onMessage('assistant', resolved.userMessage, 'speech');
            return;
          }
          const art = store.get(resolved.id);
          if (!art) {
            emitToolError('READ_ARTIFACT', intentId, { arg: resolved.id }, 'ARTIFACT_NOT_FOUND');
            return;
          }
          if (traceId) p0MetricAdd(traceId, { actionFirstExecuted: 1 });
          emitToolResult('READ_ARTIFACT', intentId, { id: art.id, name: art.name, length: art.content.length });
          callbacks.onMessage('assistant', `${art.name}\n\n${art.content || '(pusty)'}`, 'speech');
          updateContextAfterAction(ctx);
          return;
        }

        if (actionIntent.action === 'APPEND') {
          const payload = String(actionIntent.payload || '').trim();
          if (!payload) {
            // No payload - fall through to LLM
          } else {
            const resolved = resolveRef(target);
            const intentId = emitToolIntent('APPEND', resolved.ok ? resolved.id : target);
            const traceId = getCurrentTraceId();
            if (traceId) p0MetricAdd(traceId, { actionFirstTriggered: 1, actionType: 'APPEND' });
            if (!resolved.ok) {
              emitToolError('APPEND', intentId, { arg: target }, resolved.userMessage);
              callbacks.onMessage('assistant', resolved.userMessage, 'speech');
              return;
            }
            try {
              store.append(resolved.id, `\n\n${payload}`);
              if (traceId) p0MetricAdd(traceId, { actionFirstExecuted: 1 });
              emitToolResult('APPEND', intentId, { id: resolved.id });
              callbacks.onMessage('assistant', `Dopisa?,em do ${resolved.nameHint || resolved.id}. Poprawi?? co?>?`, 'speech');
              updateContextAfterAction(ctx);
              return;
            } catch (e) {
              emitToolError('APPEND', intentId, { arg: resolved.id }, (e as Error)?.message || 'unknown');
              return;
            }
          }
        }

        if (actionIntent.action === 'REPLACE') {
          const resolved = resolveRef(target);
          const next = String(actionIntent.payload || '').trim() || `TODO: REPLACE requested\n\n${userInput}`;
          const intentId = emitToolIntent('REPLACE', resolved.ok ? resolved.id : target);
          const traceId = getCurrentTraceId();
          if (traceId) p0MetricAdd(traceId, { actionFirstTriggered: 1, actionType: 'REPLACE' });
          if (!resolved.ok) {
            emitToolError('REPLACE', intentId, { arg: target }, resolved.userMessage);
            callbacks.onMessage('assistant', resolved.userMessage, 'speech');
            return;
          }
          try {
            store.replace(resolved.id, next);
            if (traceId) p0MetricAdd(traceId, { actionFirstExecuted: 1 });
            emitToolResult('REPLACE', intentId, { id: resolved.id });
            callbacks.onMessage('assistant', `Podmieni?,em tre?>?? w ${resolved.nameHint || resolved.id}. Poprawi?? co?>?`, 'speech');
            updateContextAfterAction(ctx);
            return;
          } catch (e) {
            emitToolError('REPLACE', intentId, { arg: resolved.id }, (e as Error)?.message || 'unknown');
            return;
          }
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
