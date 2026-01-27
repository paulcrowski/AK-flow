import { isMainFeatureEnabled } from '../../config/featureFlags';
import { CortexService } from '../../../llm/gemini';
import { guardReactive } from '../CortexFailureGuard';
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
import { detectIntent, getRetrievalLimit } from '../IntentDetector';
import { getRememberedArtifactName, rememberArtifactName } from '../../utils/artifactNameCache';
import type { PendingAction, PendingActionEvent, ResolveDependencies } from './pending';
import { createPendingAction, setPendingAction, tryResolvePendingAction } from './pending';
import { detectActionableIntent, isImplicitReference, isRecognizableTarget, looksLikeLibraryAnchor } from './reactiveStep.helpers';
import { createLibraryHandlers } from './reactiveStep.library';
import { emitToolError, emitToolIntent } from '../../telemetry/toolContract';
import {
  emitToolCommit,
  emitSystemAlert,
  emitToolResult,
  toolErrorOptions,
  toolResultOptions
} from './reactive/emitters';
import {
  clearLibraryAnchorIfMatches,
  setLibraryFocus,
  updateArtifactAnchor,
  updateCursorForChunk,
  updateCursorForChunkList,
  updateLibraryAnchor
} from './reactive/anchors';

export { detectActionableIntentForTesting, detectFileIntentForTesting } from './reactiveStep.helpers';

// P0.1 COMMIT 3: Action-First Policy
// Feature flag - can be disabled if causing issues
const ACTION_FIRST_ENABLED = (SYSTEM_CONFIG.features as Record<string, boolean>).P011_ACTION_FIRST_ENABLED ?? true;

// PENDING ACTION - Slot filling for incomplete tool commands
function emitPendingActionTelemetry(
  event: PendingActionEvent,
  action: PendingAction,
  extra?: Record<string, unknown>
): void {
  const payload = {
    event: `PENDING_ACTION_${event}`,
    actionType: action.type,
    targetId: action.targetId,
    targetName: action.targetName,
    ...(extra ?? {})
  };

  eventBus.publish({
    id: `pending-${event.toLowerCase()}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    timestamp: Date.now(),
    source: AgentType.CORTEX_FLOW,
    type: PacketType.SYSTEM_ALERT,
    payload,
    priority: 0.5
  });

  const isDev = typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production';
  if (isDev) {
    console.log(`[PENDING_ACTION:${event}]`, payload);
  }
}

function publishReactiveSpeech(params: {
  ctx: any;
  trace: TraceLike;
  callbacks: ReactiveCallbacksLike;
  speechText: string;
  internalThought: string;
  meta?: { knowledgeSource?: any; evidenceSource?: any; evidenceDetail?: any; generator?: any };
  agentMemoryId?: string | null;
}): void {
  const { ctx, trace, callbacks, speechText, internalThought, meta, agentMemoryId } = params;
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
        callbacks.onMessage('assistant', gateDecision.winner.speech_content, 'speech', {
          ...(meta || {}),
          ...(agentMemoryId ? { agentMemoryId } : {})
        });
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
  const { ctx, callbacks, memorySpace, trace } = input;
  let { userInput } = input;
  const isDev = typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production';

  TickCommitter.markUserInput();

  const pendingDeps: ResolveDependencies = {
    detectActionableIntent,
    isRecognizableTarget,
    isImplicitReference,
    emitTelemetry: emitPendingActionTelemetry
  };

  const pendingResult = tryResolvePendingAction(ctx, userInput, pendingDeps);
  if (pendingResult.handled) {
    const isPolish = String(ctx.agentIdentity?.language || '').toLowerCase().includes('pol');
    if (pendingResult.syntheticCommand) {
      userInput = pendingResult.syntheticCommand;
      if (isDev) {
        console.log(`[PENDING_ACTION] Synthesized: "${userInput.slice(0, 80)}..."`);
      }
    } else if (pendingResult.action === 'expired') {
      publishReactiveSpeech({
        ctx,
        trace,
        callbacks,
        speechText: isPolish
          ? 'Minęło za dużo czasu. Powiedz jeszcze raz co dopisać.'
          : 'Too much time passed. Please repeat.',
        internalThought: 'PENDING_EXPIRED'
      });
      return;
    } else if (pendingResult.action === 'cancelled') {
      publishReactiveSpeech({
        ctx,
        trace,
        callbacks,
        speechText: isPolish
          ? 'OK, anulowane.'
          : 'OK, cancelled.',
        internalThought: 'PENDING_CANCELLED'
      });
      return;
    } else if (pendingResult.action === 'cancelled_no_pending') {
      publishReactiveSpeech({
        ctx,
        trace,
        callbacks,
        speechText: 'OK.',
        internalThought: 'PENDING_CANCEL_NOOP'
      });
      return;
    } else {
      return;
    }
  }

  // P0.1: Action-First - execute tool commands immediately without asking
  if (ACTION_FIRST_ENABLED) {
    const actionIntent = detectActionableIntent(userInput);
    const store = useArtifactStore.getState();
    const resolveImplicitTarget = () => {
      const lastFocusedId = store.order?.[0] ?? null;
      const lastCreatedId = store.lastCreatedId ?? null;
      const id = lastFocusedId || lastCreatedId;
      if (!id) return null;
      const artifact = store.get(id);
      const nameHint = artifact?.name || getRememberedArtifactName(id) || '';
      return { id, nameHint };
    };
    const implicitTarget =
      (!actionIntent.target && (actionIntent.action === 'APPEND' || actionIntent.action === 'REPLACE'))
        ? resolveImplicitTarget()
        : null;
    const target = actionIntent.target || implicitTarget?.id;
    const implicitNameHint = implicitTarget?.nameHint || '';
    const { handleLibraryRead } = createLibraryHandlers({
      ctx,
      trace,
      callbacks,
      userInput,
      isDev,
      emitSystemAlert,
      emitToolResult,
      emitToolError,
      toolResultOptions,
      toolErrorOptions,
      updateLibraryAnchor: (documentId, documentName, chunkCount) =>
        updateLibraryAnchor(ctx, documentId, documentName, chunkCount),
      setLibraryFocus: (documentId, documentName, chunkCount) =>
        setLibraryFocus(ctx, documentId, documentName, chunkCount),
      updateCursorForChunkList: (documentId, chunkCount) =>
        updateCursorForChunkList(ctx, documentId, chunkCount),
      updateCursorForChunk: (documentId, chunkId, chunkIndex) =>
        updateCursorForChunk(ctx, documentId, chunkId, chunkIndex),
      clearLibraryAnchorIfMatches: (documentId, error) =>
        clearLibraryAnchorIfMatches(ctx, documentId, error),
      publishReactiveSpeech,
      updateContextAfterAction
    });

    if (!actionIntent.handled && looksLikeLibraryAnchor(userInput)) {
      await handleLibraryRead(userInput, true);
      return;
    }

    if (actionIntent.action === 'READ' && actionIntent.domain === 'LIBRARY') {
      await handleLibraryRead(target || userInput, false);
      return;
    }

    if (actionIntent.handled && actionIntent.action && target) {
      const resolveRef = (refRaw: string) => {
        const traceId = getCurrentTraceId();
        if (traceId) p0MetricAdd(traceId, { artifactResolveAttempt: 1 });
        const resolved = normalizeArtifactRef(refRaw);
        if (traceId) {
          p0MetricAdd(traceId, resolved.ok ? { artifactResolveSuccess: 1 } : { artifactResolveFail: 1 });
        }
        return resolved;
      };
      const isInvalidToolTarget = (rawTarget: string) => {
        const trimmed = String(rawTarget || '').trim();
        if (!trimmed) return true;
        if (isImplicitReference(trimmed)) return false;
        if (trimmed.includes(' ') || trimmed.includes(':')) return true;
        if (trimmed.startsWith('art-')) return false;
        return !isRecognizableTarget(trimmed);
      };
      const getRecentArtifactNames = () => {
        const ids = store.order.slice(0, 2);
        return ids
          .map((id) => store.get(id)?.name || getRememberedArtifactName(id) || id)
          .filter(Boolean);
      };
      const respondUnknownTarget = () => {
        const recent = getRecentArtifactNames();
        const recentLabel = recent.length > 0 ? recent.join(', ') : 'brak';
        publishReactiveSpeech({
          ctx,
          trace,
          callbacks,
          speechText: `Nie wiem do którego pliku. Ostatnie dwa: ${recentLabel}. Który?`,
          internalThought: 'INVALID_TARGET'
        });
      };

      try {
        if (actionIntent.action === 'CREATE') {
          const intentId = emitToolIntent('CREATE', target, { artifactName: target });
          const traceId = getCurrentTraceId();
          if (traceId) p0MetricAdd(traceId, { actionFirstTriggered: 1, actionType: 'CREATE' });
          try {
            let content = String(actionIntent.payload || '').trim();
            // FIX-1: Fallback dla pustego payload — generuj placeholder zamiast pustego pliku
            if (!content) {
              content = `# ${target}\n\nTODO: Uzupełnić treść\n\nCreated: ${new Date().toISOString().split('T')[0]}`;
              if (traceId) p0MetricAdd(traceId, { actionFirstPayloadFallback: 1 });
            }
            const id = store.create(target, content);
            if (traceId) p0MetricAdd(traceId, { actionFirstExecuted: 1, actionFirstContentChars: content.length });
            const created = store.get(id);
            const artifactName = rememberArtifactName(id, created?.name || target) || target;
            emitToolResult('CREATE', intentId, { id, name: artifactName }, toolResultOptions);
            updateArtifactAnchor(ctx, id, artifactName);
            emitToolCommit({
              action: 'CREATE',
              artifactId: id,
              artifactName,
              afterContent: created?.content ?? content
            });
            callbacks.onMessage('assistant', `Utworzylem ${target} (${id}). Poprawic cos?`, 'speech');
            updateContextAfterAction(ctx);
            return;
          } catch (e) {
            emitToolError(
              'CREATE',
              intentId,
              { arg: target },
              (e as Error)?.message || 'unknown',
              toolErrorOptions
            );
            return;
          }
        }

        if (actionIntent.action === 'READ') {
          const resolved = resolveRef(target);
          const nameHint = resolved.ok
            ? rememberArtifactName(resolved.id, resolved.nameHint || getRememberedArtifactName(resolved.id) || '')
            : '';
          const intentId = emitToolIntent(
            'READ_ARTIFACT',
            resolved.ok ? resolved.id : target,
            nameHint ? { artifactName: nameHint } : undefined
          );
          const traceId = getCurrentTraceId();
          if (traceId) p0MetricAdd(traceId, { actionFirstTriggered: 1, actionType: 'READ' });
          if (!resolved.ok) {
            emitToolError('READ_ARTIFACT', intentId, { arg: target }, resolved.userMessage, toolErrorOptions);
            publishReactiveSpeech({ ctx, trace, callbacks, speechText: resolved.userMessage, internalThought: '' });
            return;
          }
          const art = store.get(resolved.id);
          if (!art) {
            emitToolError('READ_ARTIFACT', intentId, { arg: resolved.id }, 'ARTIFACT_NOT_FOUND', toolErrorOptions);
            return;
          }
          if (traceId) p0MetricAdd(traceId, { actionFirstExecuted: 1 });
          emitToolResult(
            'READ_ARTIFACT',
            intentId,
            { id: art.id, name: art.name, length: art.content.length },
            toolResultOptions
          );
          updateArtifactAnchor(ctx, art.id, art.name);
          publishReactiveSpeech({ ctx, trace, callbacks, speechText: `${art.name}\n\n${art.content || '(pusty)'}`, internalThought: '' });
          updateContextAfterAction(ctx);
          return;
        }

        if (actionIntent.action === 'APPEND') {
          const payload = String(actionIntent.payload || '').trim();
          if (isInvalidToolTarget(target)) {
            respondUnknownTarget();
            return;
          }
          const resolved = resolveRef(target);
          const nameHint = resolved.ok
            ? rememberArtifactName(
              resolved.id,
              resolved.nameHint || implicitNameHint || getRememberedArtifactName(resolved.id) || ''
            )
            : '';
          const traceId = getCurrentTraceId();

          // No payload? Set pendingAction (slot filling)
          if (!payload) {
            if (!resolved.ok) {
              publishReactiveSpeech({
                ctx,
                trace,
                callbacks,
                speechText: resolved.userMessage,
                internalThought: 'APPEND_TARGET_NOT_FOUND'
              });
              return;
            }

            const newPending = createPendingAction(
              'APPEND_CONTENT',
              resolved.id,
              nameHint || resolved.nameHint || resolved.id,
              userInput
            );

            setPendingAction(ctx, newPending, emitPendingActionTelemetry);

            if (traceId) {
              p0MetricAdd(traceId, {
                actionFirstTriggered: 1,
                actionType: 'APPEND',
                appendPayloadMissing: 1,
                pendingActionSet: 1
              });
            }

            const isPolish = String(ctx.agentIdentity?.language || '').toLowerCase().includes('pol');
            const artifactName = newPending.targetName || newPending.targetId;

            publishReactiveSpeech({
              ctx,
              trace,
              callbacks,
              speechText: isPolish
                ? `Co dopisać do ${artifactName}?`
                : `What should I add to ${artifactName}?`,
              internalThought: 'PENDING_APPEND_WAITING'
            });

            updateContextAfterAction(ctx);
            return;
          }

          // Normal flow with payload
          const intentId = emitToolIntent(
            'APPEND',
            resolved.ok ? resolved.id : target,
            nameHint ? { artifactName: nameHint } : undefined
          );
          if (traceId) p0MetricAdd(traceId, { actionFirstTriggered: 1, actionType: 'APPEND' });
          if (!resolved.ok) {
            emitToolError('APPEND', intentId, { arg: target }, resolved.userMessage, toolErrorOptions);
            publishReactiveSpeech({ ctx, trace, callbacks, speechText: resolved.userMessage, internalThought: '' });
            return;
          }
          try {
            const before = store.get(resolved.id)?.content ?? '';
            store.append(resolved.id, `\n\n${payload}`);
            if (traceId) p0MetricAdd(traceId, { actionFirstExecuted: 1 });
            const updated = store.get(resolved.id);
            const artifactName = rememberArtifactName(
              resolved.id,
              updated?.name || resolved.nameHint || getRememberedArtifactName(resolved.id) || ''
            ) || resolved.nameHint || resolved.id;
            emitToolResult('APPEND', intentId, { id: resolved.id, name: artifactName }, toolResultOptions);
            updateArtifactAnchor(ctx, resolved.id, artifactName);
            emitToolCommit({
              action: 'APPEND',
              artifactId: resolved.id,
              artifactName,
              beforeContent: before,
              afterContent: updated?.content ?? ''
            });
            store.markComplete(resolved.id, true);
            publishReactiveSpeech({
              ctx,
              trace,
              callbacks,
              speechText: `Dopisałem do ${resolved.nameHint || resolved.id}. Poprawić coś?`,
              internalThought: ''
            });
            updateContextAfterAction(ctx);
            return;
          } catch (e) {
            emitToolError(
              'APPEND',
              intentId,
              { arg: resolved.id },
              (e as Error)?.message || 'unknown',
              toolErrorOptions
            );
            return;
          }
        }

        if (actionIntent.action === 'REPLACE') {
          const payload = String(actionIntent.payload || '').trim();
          if (isInvalidToolTarget(target)) {
            respondUnknownTarget();
            return;
          }
          const resolved = resolveRef(target);
          const nameHint = resolved.ok
            ? rememberArtifactName(
              resolved.id,
              resolved.nameHint || implicitNameHint || getRememberedArtifactName(resolved.id) || ''
            )
            : '';
          const traceId = getCurrentTraceId();

          if (!payload) {
            if (!resolved.ok) {
              publishReactiveSpeech({
                ctx,
                trace,
                callbacks,
                speechText: resolved.userMessage,
                internalThought: 'REPLACE_TARGET_NOT_FOUND'
              });
              return;
            }

            const newPending = createPendingAction(
              'REPLACE_CONTENT',
              resolved.id,
              nameHint || resolved.nameHint || resolved.id,
              userInput
            );

            setPendingAction(ctx, newPending, emitPendingActionTelemetry);

            if (traceId) {
              p0MetricAdd(traceId, {
                actionFirstTriggered: 1,
                actionType: 'REPLACE',
                pendingActionSet: 1
              });
            }

            const isPolish = String(ctx.agentIdentity?.language || '').toLowerCase().includes('pol');
            const artifactName = newPending.targetName || newPending.targetId;

            publishReactiveSpeech({
              ctx,
              trace,
              callbacks,
              speechText: isPolish
                ? `Co dopisać do ${artifactName}?`
                : `What should I replace in ${artifactName}?`,
              internalThought: 'PENDING_REPLACE_WAITING'
            });

            updateContextAfterAction(ctx);
            return;
          }

          const intentId = emitToolIntent(
            'REPLACE',
            resolved.ok ? resolved.id : target,
            nameHint ? { artifactName: nameHint } : undefined
          );
          if (traceId) p0MetricAdd(traceId, { actionFirstTriggered: 1, actionType: 'REPLACE' });
          if (!resolved.ok) {
            emitToolError('REPLACE', intentId, { arg: target }, resolved.userMessage, toolErrorOptions);
            publishReactiveSpeech({ ctx, trace, callbacks, speechText: resolved.userMessage, internalThought: '' });
            return;
          }
          try {
            const before = store.get(resolved.id)?.content ?? '';
            store.replace(resolved.id, payload);
            if (traceId) p0MetricAdd(traceId, { actionFirstExecuted: 1 });
            const updated = store.get(resolved.id);
            const artifactName = rememberArtifactName(
              resolved.id,
              updated?.name || resolved.nameHint || getRememberedArtifactName(resolved.id) || ''
            ) || resolved.nameHint || resolved.id;
            emitToolResult('REPLACE', intentId, { id: resolved.id, name: artifactName }, toolResultOptions);
            updateArtifactAnchor(ctx, resolved.id, artifactName);
            emitToolCommit({
              action: 'REPLACE',
              artifactId: resolved.id,
              artifactName,
              beforeContent: before,
              afterContent: updated?.content ?? ''
            });
            store.markComplete(resolved.id, true);
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
            emitToolError(
              'REPLACE',
              intentId,
              { arg: resolved.id },
              (e as Error)?.message || 'unknown',
              toolErrorOptions
            );
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
    ? ((await memorySpace.hot.semanticSearch(userInput, {
      limit: getRetrievalLimit(detectIntent(userInput))
    })) as any)
    : undefined;

  const guardResult = await guardReactive(async () => {
    const result = await CortexSystem.processUserMessage({
      text: userInput,
      currentLimbic: ctx.limbic,
      currentSoma: ctx.soma,
      conversationHistory: ctx.conversation,
      identity: ctx.agentIdentity,
      sessionOverlay: ctx.sessionOverlay,
      memorySpace,
      prefetchedMemories,
      workingMemory: {
        last_library_doc_id: ctx.lastLibraryDocId ?? null,
        last_library_doc_name: ctx.lastLibraryDocName ?? null,
        last_library_doc_chunk_count: ctx.lastLibraryDocChunkCount ?? null,
        last_world_path: ctx.lastWorldPath ?? null,
        last_artifact_id: ctx.lastArtifactId ?? null,
        last_artifact_name: ctx.lastArtifactName ?? null,
        active_domain: ctx.activeDomain ?? null,
        last_tool: ctx.lastTool ?? null
      }
    });

    const intent = await CortexService.detectIntent(userInput);

    return { result, intent };
  }, { traceId: trace.traceId, onThought: callbacks.onThought });

  if (!guardResult.ok) {
    return;
  }

  const { result, intent } = guardResult.result;

  if (intent.style === 'POETIC') {
    ctx.poeticMode = true;
    if (isDev) console.log('Intent Detected: POETIC MODE ENABLED');
  } else if (intent.style === 'SIMPLE') {
    ctx.poeticMode = false;
    if (isDev) console.log('Intent Detected: POETIC MODE DISABLED (Simple Style Requested)');
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
    },
    agentMemoryId: result.agentMemoryId
  });

  const now = Date.now();
  ctx.silenceStart = now;
  ctx.lastSpeakTimestamp = now;
  ctx.goalState.lastUserInteractionAt = now;

  ctx.consecutiveAgentSpeeches = 0;

  ctx.hadExternalRewardThisTick = true;
  ctx.ticksSinceLastReward = 0;
}


