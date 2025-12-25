import { isMainFeatureEnabled } from '../../config/featureFlags';
import { CortexService } from '../../../llm/gemini';
import { TickCommitter } from '../TickCommitter';
import { LimbicSystem } from '../LimbicSystem';
import { CortexSystem } from '../CortexSystem';
import { ExecutiveGate } from '../ExecutiveGate';
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

function publishReactiveSpeech(params: {
  ctx: any;
  trace: TraceLike;
  callbacks: ReactiveCallbacksLike;
  speechText: string;
  internalThought: string;
  meta?: { knowledgeSource?: any; evidenceSource?: any; evidenceDetail?: any; generator?: any };
}): void {
  const { ctx, trace, callbacks, speechText, internalThought, meta } = params;
  const candidate = ExecutiveGate.createReactiveCandidate(speechText, internalThought, `reactive-${trace.traceId}-${trace.tickNumber}`);
  const gateContext = {
    ...ExecutiveGate.getDefaultContext(ctx.limbic, 0),
    socialDynamics: ctx.socialDynamics
  };
  const gateDecision = ExecutiveGate.decide([candidate], gateContext);

  if (!gateDecision.should_speak || !gateDecision.winner) {
    callbacks.onThought(`[REACTIVE_SUPPRESSED] ${gateDecision.reason}`);
    return;
  }

  if (isMainFeatureEnabled('ONE_MIND_ENABLED') && trace.agentId) {
    try {
      const commit = TickCommitter.commitSpeech({
        agentId: trace.agentId,
        traceId: trace.traceId,
        tickNumber: trace.tickNumber,
        origin: 'reactive',
        speechText: gateDecision.winner.speech_content
      });

      if (commit.committed) {
        callbacks.onMessage('assistant', gateDecision.winner.speech_content, 'speech', meta);
      } else {
        callbacks.onThought(`[REACTIVE_SUPPRESSED] ${commit.blockReason || 'UNKNOWN'}`);
      }
      return;
    } catch (e) {
      callbacks.onThought(`[REACTIVE_COMMIT_ERROR] ${(e as Error)?.message || 'unknown'}`);
    }
  }

  callbacks.onMessage('assistant', gateDecision.winner.speech_content, 'speech', meta);
}

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
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()
      .replace(/^o\s+/, '')
      .replace(/[^a-z0-9]+/g, '-');
    const collapsed = raw.replace(/-+/g, '-').replace(/^-|-$/g, '');
    return collapsed.slice(0, 48);
  };

  const deriveCreateTarget = (rawTarget: string, opts?: { preferPhrase?: boolean }) => {
    const t = String(rawTarget || '').trim();
    if (!t) return 'artifact.md';
    const preferPhrase = Boolean(opts?.preferPhrase);
    const first = t.split(/\s+/)[0];
    const looksLikeFilename = !preferPhrase && (first.includes('.') || first.length >= 3);
    if (looksLikeFilename && !first.includes('/') && !first.includes('\\')) {
      if (first.toLowerCase().endsWith('.md')) return first;
      if (first.includes('.')) return first;
      return `${first}.md`;
    }
    const slug = slugify(t);
    return `${slug || 'artifact'}.md`;
  };

  const contentKeyword = '(?:trescia|tre(?:s|\\u015b)ci(?:a|\\u0105)|tekstem|zawartoscia|zawarto(?:s|\\u015b)ci(?:a|\\u0105))';
  const createNoNameRegex = new RegExp(
    `(?:stworz|utworz|zapisz)\\s+(?:plik\\s+)?z\\s+${contentKeyword}\\s+([\\s\\S]+)`,
    'i'
  );
  const createWithNameRegex = new RegExp(
    `(?:stworz|utworz|zapisz)\\s+(?:plik\\s+)?(?:o\\s+nazwie\\s+)?(.+?)\\s+z\\s+${contentKeyword}\\s+([\\s\\S]+)`,
    'i'
  );

  const createNoNameMatch = raw.match(createNoNameRegex);
  if (createNoNameMatch) {
    const payload = String(createNoNameMatch[1] || '').trim();
    if (payload) {
      const target = deriveCreateTarget(payload, { preferPhrase: true });
      return { handled: true, action: 'CREATE', target, payload };
    }
  }

  const createWithNameMatch = raw.match(createWithNameRegex);
  if (createWithNameMatch) {
    const name = String(createWithNameMatch[1] || '').trim();
    const payload = String(createWithNameMatch[2] || '').trim();
    if (payload) {
      const target = deriveCreateTarget(name || payload, { preferPhrase: !name });
      return { handled: true, action: 'CREATE', target, payload };
    }
  }
  
  // CREATE patterns: "stworz/utworz/zapisz plik X"
  const createMatch = normalized.match(/(?:stworz|utworz|zapisz)\s+(?:plik\s+)?(.+)/i);
  if (createMatch) {
    return { handled: true, action: 'CREATE', target: deriveCreateTarget(createMatch[1]) };
  }

  const editAppendMatch = raw.match(
    /(?:edytuj|eydtuj|modyfikuj)\s+(?:plik\s+)?([^\s:]+)\s+(?:dodaj|dopisz)\s+(?:tresc|tekst)?\s*:?\s*([\s\S]+)/i
  );
  if (editAppendMatch) {
    const target = String(editAppendMatch[1] || '').trim();
    const payload = String(editAppendMatch[2] || '').trim();
    if (target && payload) return { handled: true, action: 'APPEND', target, payload };
  }
  
  // APPEND patterns: require verb + target + payload (after ':')
  // Examples: "dopisz do note.md: ...", "dodaj do note: ..."
  const appendMatch = normalized.match(/(?:dopisz|dodaj)\s+(?:do)\s+(.+)/i);
  if (appendMatch) {
    const { target, payload } = splitTargetAndPayload(String(appendMatch[1] || ''));
    if (target && payload) return { handled: true, action: 'APPEND', target, payload };
  }

  const appendInlineMatch = raw.match(/(?:dopisz|dodaj)\s+(?:tresc|tekst)?\s*do\s+([^\s:]+)\s+([\s\S]+)/i);
  if (appendInlineMatch) {
    const target = String(appendInlineMatch[1] || '').trim();
    const payload = String(appendInlineMatch[2] || '').trim();
    if (payload && (target.startsWith('art-') || target.includes('.'))) {
      return { handled: true, action: 'APPEND', target, payload };
    }
  }

  const editReplaceMatch = raw.match(/(?:edytuj|eydtuj|modyfikuj)\s+(?:plik\s+)?([^\s:]+)\s*:\s*([\s\S]+)/i);
  if (editReplaceMatch) {
    const target = String(editReplaceMatch[1] || '').trim();
    const payload = String(editReplaceMatch[2] || '').trim();
    if (target && payload) return { handled: true, action: 'REPLACE', target, payload };
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
            const content = String(actionIntent.payload || '').trim();
            const id = store.create(target, content);
            if (traceId) p0MetricAdd(traceId, { actionFirstExecuted: 1 });
            emitToolResult('CREATE', intentId, { id, name: target });
            callbacks.onMessage('assistant', `Utworzylem ${target} (${id}). Poprawic cos?`, 'speech');
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
            publishReactiveSpeech({ ctx, trace, callbacks, speechText: resolved.userMessage, internalThought: '' });
            return;
          }
          const art = store.get(resolved.id);
          if (!art) {
            emitToolError('READ_ARTIFACT', intentId, { arg: resolved.id }, 'ARTIFACT_NOT_FOUND');
            return;
          }
          if (traceId) p0MetricAdd(traceId, { actionFirstExecuted: 1 });
          emitToolResult('READ_ARTIFACT', intentId, { id: art.id, name: art.name, length: art.content.length });
          publishReactiveSpeech({ ctx, trace, callbacks, speechText: `${art.name}\n\n${art.content || '(pusty)'}`, internalThought: '' });
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
              publishReactiveSpeech({ ctx, trace, callbacks, speechText: resolved.userMessage, internalThought: '' });
              return;
            }
            try {
              store.append(resolved.id, `\n\n${payload}`);
              if (traceId) p0MetricAdd(traceId, { actionFirstExecuted: 1 });
              emitToolResult('APPEND', intentId, { id: resolved.id });
              publishReactiveSpeech({
                ctx,
                trace,
                callbacks,
                speechText: `Dopisa?,em do ${resolved.nameHint || resolved.id}. Poprawi?? co?>?`,
                internalThought: ''
              });
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
            publishReactiveSpeech({ ctx, trace, callbacks, speechText: resolved.userMessage, internalThought: '' });
            return;
          }
          try {
            store.replace(resolved.id, next);
            if (traceId) p0MetricAdd(traceId, { actionFirstExecuted: 1 });
            emitToolResult('REPLACE', intentId, { id: resolved.id });
            publishReactiveSpeech({
              ctx,
              trace,
              callbacks,
              speechText: `Podmieni?,em tre?>?? w ${resolved.nameHint || resolved.id}. Poprawi?? co?>?`,
              internalThought: ''
            });
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

  publishReactiveSpeech({
    ctx,
    trace,
    callbacks,
    speechText: result.responseText,
    internalThought: result.internalThought || '',
    meta: {
      knowledgeSource: result.knowledgeSource,
      evidenceSource: result.evidenceSource,
      evidenceDetail: result.evidenceDetail,
      generator: result.generator
    }
  });

  const now = Date.now();
  ctx.silenceStart = now;
  ctx.lastSpeakTimestamp = now;
  ctx.goalState.lastUserInteractionAt = now;

  ctx.consecutiveAgentSpeeches = 0;

  ctx.hadExternalRewardThisTick = true;
  ctx.ticksSinceLastReward = 0;
}
