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
import { detectIntent, getRetrievalLimit } from '../IntentDetector';
import { getRememberedArtifactName, rememberArtifactName } from '../../utils/artifactNameCache';
import { buildToolCommitDetails, formatToolCommitMessage } from '../../utils/toolCommit';
import { downloadLibraryDocumentText, findLibraryDocumentByName, getLibraryChunkByIndex, listLibraryChunks, searchLibraryChunks } from '../../../services/LibraryService';
import { getCurrentAgentId } from '../../../services/supabase';
import { getCognitiveState } from '../../../stores/cognitiveStore';
import type { PendingAction, PendingActionEvent, ResolveDependencies } from './pending';
import { createPendingAction, setPendingAction, tryResolvePendingAction } from './pending';
import { detectActionableIntent, isImplicitReference, isRecognizableTarget, looksLikeLibraryAnchor, needsLibraryChunks, resolveImplicitReference } from './reactiveStep.helpers';
import { normalizeRoutingInput } from '../../../tools/toolParser';
import { evidenceLedger } from '../EvidenceLedger';
import { emitToolError, emitToolIntent, emitToolResult as emitToolResultContract } from '../../telemetry/toolContract';
import { validateToolResult } from '../../tools/validateToolResult';

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

      const emitToolCommit = (params: {
        action: 'CREATE' | 'APPEND' | 'REPLACE';
        artifactId: string;
        artifactName: string;
        beforeContent?: string;
        afterContent?: string;
        deltaText?: string;
      }) => {
        const details = buildToolCommitDetails(params);
        if (!details) return;
        const message = formatToolCommitMessage(details);
        eventBus.publish({
          id: generateUUID(),
          timestamp: Date.now(),
          source: AgentType.CORTEX_FLOW,
          type: PacketType.SYSTEM_ALERT,
          payload: {
            event: 'TOOL_COMMIT',
            message,
            ...details
          },
          priority: 0.7
        });
      };

      const emitSystemAlert = (event: string, payload: Record<string, unknown>, priority = 0.6) => {
        eventBus.publish({
          id: generateUUID(),
          timestamp: Date.now(),
          source: AgentType.CORTEX_FLOW,
          type: PacketType.SYSTEM_ALERT,
          payload: { event, ...payload },
          priority
        });
      };
      const toolResultOptions = { priority: 0.8 };
      const toolErrorOptions = { priority: 0.9 };
      const emitToolResult = (
        tool: string,
        intentId: string,
        payload?: Record<string, unknown>,
        options: { priority: number } = toolResultOptions
      ) => {
        const normalized: Record<string, unknown> = { ...(payload ?? {}) };
        if (typeof normalized.id === 'string' && typeof normalized.artifactId !== 'string') {
          if (tool === 'CREATE' || tool === 'APPEND' || tool === 'REPLACE' || tool === 'READ_ARTIFACT') {
            normalized.artifactId = normalized.id;
          }
        }
        if (typeof normalized.name === 'string' && typeof normalized.artifactName !== 'string') {
          normalized.artifactName = normalized.name;
        }
        validateToolResult(tool, normalized);
        emitToolResultContract(tool, intentId, normalized, options);
      };

      const updateLibraryAnchor = (
        documentId: string,
        documentName?: string | null,
        chunkCount?: number | null
      ) => {
        const previousDocId = ctx.lastLibraryDocId ?? null;
        const shouldResetChunkCount =
          Boolean(previousDocId) && previousDocId !== documentId && typeof chunkCount !== 'number';

        ctx.lastLibraryDocId = documentId;
        ctx.activeDomain = 'LIBRARY';
        if (documentName !== undefined) {
          ctx.lastLibraryDocName = documentName;
        }
        if (typeof chunkCount === 'number') {
          ctx.lastLibraryDocChunkCount = chunkCount;
        } else if (shouldResetChunkCount) {
          ctx.lastLibraryDocChunkCount = null;
        }
        try {
          const state = getCognitiveState();
          if (state?.hydrate) {
            const patch: Record<string, unknown> = {
              lastLibraryDocId: documentId,
              activeDomain: 'LIBRARY'
            };
            if (documentName !== undefined) {
              patch.lastLibraryDocName = documentName;
            }
            if (typeof chunkCount === 'number') {
              patch.lastLibraryDocChunkCount = chunkCount;
            } else if (shouldResetChunkCount) {
              patch.lastLibraryDocChunkCount = null;
            }
            state.hydrate(patch);
          }
        } catch {
          // ignore state sync issues
        }
      };

      const updateWorldAnchor = (path: string) => {
        ctx.lastWorldPath = path;
        ctx.activeDomain = 'WORLD';
        try {
          const state = getCognitiveState();
          if (state?.hydrate) state.hydrate({ lastWorldPath: path, activeDomain: 'WORLD' });
        } catch {
          // ignore state sync issues
        }
      };

      const updateArtifactAnchor = (artifactId: string, artifactName?: string | null) => {
        ctx.lastArtifactId = artifactId;
        ctx.activeDomain = 'ARTIFACT';
        if (artifactName !== undefined) {
          ctx.lastArtifactName = artifactName;
        }
        try {
          const state = getCognitiveState();
          if (state?.hydrate) {
            state.hydrate({
              lastArtifactId: artifactId,
              activeDomain: 'ARTIFACT',
              ...(artifactName !== undefined ? { lastArtifactName: artifactName } : {})
            });
          }
        } catch {
          // ignore state sync issues
        }
      };

      const ensureCursor = () => {
        if (!ctx.cursor) ctx.cursor = {};
        return ctx.cursor;
      };

      const setLibraryFocus = (documentId: string, documentName?: string | null, chunkCount?: number | null) => {
        ctx.focus = { domain: 'LIBRARY', id: documentId, label: documentName ?? null };
        if (typeof chunkCount === 'number' && chunkCount > 0) {
          ctx.cursor = { chunkCount, chunkIndex: 0 };
        } else {
          ctx.cursor = {};
        }
      };

      const updateCursorForChunkList = (documentId: string, chunkCount?: number | null) => {
        if (ctx.focus?.domain !== 'LIBRARY' || ctx.focus.id !== documentId) return;
        const cursor = ensureCursor();
        if (typeof chunkCount === 'number') {
          cursor.chunkCount = chunkCount;
          if (cursor.chunkIndex === undefined && chunkCount > 0) {
            cursor.chunkIndex = 0;
          }
        }
        cursor.chunksKnownForDocId = documentId;
        ctx.cursor = cursor;
      };

      const updateCursorForChunk = (documentId: string, chunkId?: string | null, chunkIndex?: number) => {
        if (ctx.focus?.domain !== 'LIBRARY') return;
        if (documentId && ctx.focus.id !== documentId) return;
        const cursor = ensureCursor();
        if (chunkId) cursor.lastChunkId = chunkId;
        if (typeof chunkIndex === 'number') cursor.chunkIndex = chunkIndex;
        ctx.cursor = cursor;
      };

      const shouldClearAnchorForError = (error: unknown) => {
        const message = String(error || '').toUpperCase();
        return (
          message.includes('NOT_FOUND') ||
          message.includes('NO_DOC') ||
          message.includes('NO_CHUNKS') ||
          message.includes('MISSING_DOC') ||
          message.includes('CHUNK_NOT_FOUND') ||
          message.includes('CHUNKS_MISSING')
        );
      };

      const clearLibraryAnchorIfMatches = (documentId: string, error: unknown) => {
        if (!shouldClearAnchorForError(error)) return;
        if (!documentId || ctx.lastLibraryDocId !== documentId) return;
        ctx.lastLibraryDocId = null;
        ctx.lastLibraryDocName = null;
        ctx.lastLibraryDocChunkCount = null;
        if (ctx.activeDomain === 'LIBRARY') {
          ctx.activeDomain = null;
        }
        if (ctx.focus?.domain === 'LIBRARY' && ctx.focus.id === documentId) {
          ctx.focus = { domain: null, id: null, label: null };
          ctx.cursor = {};
        }
        try {
          const state = getCognitiveState();
          if (state?.hydrate) {
            const patch: Record<string, unknown> = {
              lastLibraryDocId: null,
              lastLibraryDocName: null,
              lastLibraryDocChunkCount: null
            };
            if (state.activeDomain === 'LIBRARY') {
              patch.activeDomain = null;
            }
            if (state.focus?.domain === 'LIBRARY' && state.focus.id === documentId) {
              patch.focus = { domain: null, id: null, label: null };
              patch.cursor = {};
            }
            state.hydrate(patch);
          }
        } catch {
          // ignore state sync issues
        }
      };

      const wantsChunks = (inputText: string) => {
        const normalized = normalizeRoutingInput(inputText);
        return normalized.includes('chunk') || normalized.includes('chunki');
      };

      const isUuidLike = (value: string) =>
        /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(value);

      const normalizeLibraryQuery = (rawTarget: string) => {
        const raw = String(rawTarget || '').replace(/["'`]/g, '').trim();
        if (!raw) return '';
        const parts = raw.split(/\s+/);
        if (parts.length > 1) {
          const first = normalizeRoutingInput(parts[0]);
          if (first.startsWith('ksiazk') || first.startsWith('dokument') || first.startsWith('raport') || first.startsWith('pdf') || first.startsWith('book') || first.startsWith('document') || first.startsWith('report') || first.startsWith('bibliotek') || first.startsWith('library')) {
            parts.shift();
          }
        }
        const cleaned = parts.join(' ').replace(/[\s,;:.!?]+$/g, '').trim();
        return cleaned.slice(0, 160);
      };

      const publishClarification = (question: string, options?: string[]) => {
        const optionText = options && options.length > 0
          ? ` ${options.map((opt, idx) => `${idx + 1}) ${opt}`).join(' ')}`
          : '';
        emitSystemAlert('USER_CLARIFICATION_QUESTION', {
          input: userInput,
          question,
          options: options ?? []
        });
        publishReactiveSpeech({
          ctx,
          trace,
          callbacks,
          speechText: `${question}${optionText}`,
          internalThought: 'USER_CLARIFICATION_QUESTION'
        });
        updateContextAfterAction(ctx);
      };

      const publishIngestMissing = (doc: { id?: string; original_name?: string } | null, reason: string) => {
        emitSystemAlert('LIBRARY_INGEST_MISSING', {
          docId: doc?.id ?? null,
          name: doc?.original_name ?? null,
          reason
        });
        publishReactiveSpeech({
          ctx,
          trace,
          callbacks,
          speechText: 'Ten dokument nie jest jeszcze zindeksowany (brak chunkow).',
          internalThought: 'LIBRARY_INGEST_MISSING'
        });
        updateContextAfterAction(ctx);
      };

      const readLibraryDoc = async (documentId: string, docHint?: { original_name?: string; ingested_at?: string | null }) => {
        const intentId = emitToolIntent('READ_LIBRARY_DOC', documentId);
        try {
          const res: any = await downloadLibraryDocumentText({ documentId });
          if (res.ok === false) {
            throw new Error(res.error || 'READ_LIBRARY_DOC_FAILED');
          }

          const doc = res.doc || docHint || {};
          const originalName = String(doc?.original_name || '').trim() || 'unknown';
          if (!doc?.ingested_at) {
            emitSystemAlert('LIBRARY_INGEST_MISSING', {
              docId: documentId,
              name: originalName,
              reason: 'ingested_at_missing'
            });
          }

          const raw = String(res.text || '');
          const excerpt = raw.slice(0, 8000);
          evidenceLedger.record('READ_FILE', originalName || documentId);
          emitToolResult(
            'READ_LIBRARY_DOC',
            intentId,
            { docId: documentId, name: originalName, length: raw.length },
            toolResultOptions
          );
          updateLibraryAnchor(documentId, originalName);
          setLibraryFocus(documentId, originalName);

          if (needsLibraryChunks({ focus: ctx.focus, cursor: ctx.cursor, docId: documentId })) {
            await listLibraryChunkSummaries(documentId);
          }

          publishReactiveSpeech({
            ctx,
            trace,
            callbacks,
            speechText: `READ_LIBRARY_DOC ${documentId} (${originalName}):\n${excerpt || '(empty)'}`,
            internalThought: ''
          });
          updateContextAfterAction(ctx);
        } catch (error: any) {
          emitToolError(
            'READ_LIBRARY_DOC',
            intentId,
            { arg: documentId },
            error?.message || 'READ_LIBRARY_DOC_FAILED',
            toolErrorOptions
          );
          clearLibraryAnchorIfMatches(documentId, error?.message || error);
        }
      };

      const readLibraryChunk = async (documentId: string, chunkIndex: number, docHint?: { original_name?: string; ingested_at?: string | null }) => {
        const intentId = emitToolIntent('READ_LIBRARY_CHUNK', `${documentId}#${chunkIndex}`);
        try {
          const res: any = await getLibraryChunkByIndex({ documentId, chunkIndex });
          if (res.ok === false) {
            throw new Error(res.error || 'READ_LIBRARY_CHUNK_FAILED');
          }
          if (!res.chunk) {
            const listRes: any = await listLibraryChunks({ documentId, limit: 1 });
            if (listRes.ok && listRes.chunks.length === 0) {
              publishIngestMissing({ id: documentId, original_name: docHint?.original_name }, 'chunks_missing');
              throw new Error('CHUNKS_MISSING');
            }
            throw new Error('CHUNK_NOT_FOUND');
          }

          const chunkId = String(res.chunk?.id || '').trim();
          if (!chunkId) {
            throw new Error('CHUNK_ID_MISSING');
          }
          const chunkText = String(res.chunk.content || '').trim();
          evidenceLedger.record('READ_FILE', `${documentId}#${chunkIndex}`);
          emitToolResult(
            'READ_LIBRARY_CHUNK',
            intentId,
            { docId: documentId, chunkId, chunkIndex, length: chunkText.length },
            toolResultOptions
          );
          updateLibraryAnchor(documentId, docHint?.original_name);
          updateCursorForChunk(documentId, chunkId, chunkIndex);
          publishReactiveSpeech({
            ctx,
            trace,
            callbacks,
            speechText: `READ_LIBRARY_CHUNK ${documentId}#${chunkIndex}:\n${chunkText || '(empty)'}`,
            internalThought: ''
          });
          updateContextAfterAction(ctx);
        } catch (error: any) {
          emitToolError(
            'READ_LIBRARY_CHUNK',
            intentId,
            { arg: `${documentId}#${chunkIndex}` },
            error?.message || 'READ_LIBRARY_CHUNK_FAILED',
            toolErrorOptions
          );
          clearLibraryAnchorIfMatches(documentId, error?.message || error);
        }
      };

      const listLibraryChunkSummaries = async (documentId: string, limit = 20) => {
        const intentId = emitToolIntent('LIST_LIBRARY_CHUNKS', documentId);
        try {
          const res: any = await listLibraryChunks({ documentId, limit: limit + 1 });
          if (res.ok === false) {
            throw new Error(res.error || 'LIST_LIBRARY_CHUNKS_FAILED');
          }

          const chunks = Array.isArray(res.chunks) ? res.chunks : [];
          const chunkCount = typeof res.chunkCount === 'number' ? res.chunkCount : chunks.length;
          if (chunks.length === 0) {
            emitToolResult(
              'LIST_LIBRARY_CHUNKS',
              intentId,
              { docId: documentId, chunkCount, shown: 0, hasMore: false },
              toolResultOptions
            );
            updateLibraryAnchor(documentId, undefined, chunkCount);
            updateCursorForChunkList(documentId, chunkCount);
            return { text: 'Brak chunkow dla tego dokumentu.', shownCount: 0, hasMore: false };
          }

          const hasMore = chunks.length > limit;
          const visible = chunks.slice(0, limit);
          const summaries = visible.map((chunk: any) => {
            const preview = String(chunk.content || '').replace(/\s+/g, ' ').slice(0, 100);
            return `#${chunk.chunk_index}: ${preview}...`;
          });

          emitToolResult(
            'LIST_LIBRARY_CHUNKS',
            intentId,
            {
              docId: documentId,
              chunkCount,
              shown: visible.length,
              hasMore
            },
            toolResultOptions
          );
          updateLibraryAnchor(documentId, undefined, chunkCount);
          updateCursorForChunkList(documentId, chunkCount);

          const countInfo = hasMore
            ? `Pokazuje pierwsze ${limit} chunkow (jest wiecej):`
            : `Dokument ma ${visible.length} chunkow:`;

          return {
            text: `${countInfo}\n${summaries.join('\n')}\n\nKtory chunk? [READ_LIBRARY_CHUNK: ${documentId}#N]`,
            shownCount: visible.length,
            hasMore
          };
        } catch (error: any) {
          emitToolError(
            'LIST_LIBRARY_CHUNKS',
            intentId,
            { documentId },
            error?.message || 'LIST_LIBRARY_CHUNKS_FAILED',
            toolErrorOptions
          );
          clearLibraryAnchorIfMatches(documentId, error?.message || error);
          return { text: 'Nie moge pobrac chunkow.', shownCount: 0, hasMore: false };
        }
      };

      const handleLibraryRead = async (rawTarget?: string, anchorOnly?: boolean) => {
        const chunkRequest = wantsChunks(rawTarget || userInput);
        const resolved = resolveImplicitReference(userInput, {
          focus: ctx.focus,
          lastLibraryDocId: ctx.lastLibraryDocId,
          lastWorldPath: ctx.lastWorldPath,
          lastArtifactId: ctx.lastArtifactId
        });

        if (resolved.type === 'library_doc' && resolved.id && resolved.confidence > 0.7) {
          if (isDev) {
            console.log(`[ANCHOR_RESOLVER] Using library anchor: ${resolved.id} (confidence: ${resolved.confidence})`);
          }
          if (chunkRequest) {
            const { text } = await listLibraryChunkSummaries(resolved.id);
            publishReactiveSpeech({
              ctx,
              trace,
              callbacks,
              speechText: text,
              internalThought: ''
            });
            updateContextAfterAction(ctx);
            return;
          }
          await readLibraryDoc(resolved.id);
          return;
        }

        const anchorRequested = Boolean(anchorOnly) || looksLikeLibraryAnchor(rawTarget || '');
        if (anchorRequested) {
          const anchorId = ctx.lastLibraryDocId || null;
          if (!anchorId) {
            emitSystemAlert('MISSING_LIBRARY_ANCHOR', {
              input: userInput,
              reason: 'no_last_library_doc'
            });
            publishClarification('Nie mam aktywnej ksiazki. Podaj tytul dokumentu.');
            return;
          }
          if (chunkRequest) {
            const { text } = await listLibraryChunkSummaries(anchorId);
            publishReactiveSpeech({
              ctx,
              trace,
              callbacks,
              speechText: text,
              internalThought: ''
            });
            updateContextAfterAction(ctx);
            return;
          }
          await readLibraryDoc(anchorId);
          return;
        }

        const raw = String(rawTarget || '').trim();
        if (raw && isUuidLike(raw)) {
          if (chunkRequest) {
            const { text } = await listLibraryChunkSummaries(raw);
            publishReactiveSpeech({
              ctx,
              trace,
              callbacks,
              speechText: text,
              internalThought: ''
            });
            updateContextAfterAction(ctx);
            return;
          }
          await readLibraryDoc(raw);
          return;
        }

        const query = normalizeLibraryQuery(rawTarget || '');
        if (!query) {
          publishClarification('Podaj tytul lub fragment nazwy dokumentu.');
          return;
        }

        if (isUuidLike(query)) {
          if (chunkRequest) {
            const { text } = await listLibraryChunkSummaries(query);
            publishReactiveSpeech({
              ctx,
              trace,
              callbacks,
              speechText: text,
              internalThought: ''
            });
            updateContextAfterAction(ctx);
            return;
          }
          await readLibraryDoc(query);
          return;
        }

        const agentId = trace.agentId || getCurrentAgentId() || null;
        const found: any = await findLibraryDocumentByName({ name: query, agentId });
        if (found.ok === false) {
          publishClarification('Nie moge sprawdzic biblioteki. Podaj tytul jeszcze raz.');
          return;
        }
        if (found.document) {
          const doc = found.document as any;
          if (chunkRequest && !doc?.ingested_at) {
            publishIngestMissing(doc, 'ingested_at_missing');
            return;
          }
          if (chunkRequest) {
            const { text } = await listLibraryChunkSummaries(String(doc.id));
            publishReactiveSpeech({
              ctx,
              trace,
              callbacks,
              speechText: text,
              internalThought: ''
            });
            updateContextAfterAction(ctx);
            return;
          }
          await readLibraryDoc(String(doc.id), doc);
          return;
        }

        const searchIntentId = emitToolIntent('SEARCH_LIBRARY', query);
        let searchRes: any;
        try {
          searchRes = await searchLibraryChunks({ query, limit: 6 });
          if (searchRes.ok === false) {
            throw new Error(searchRes.error || 'SEARCH_LIBRARY_FAILED');
          }
        } catch (error: any) {
          emitToolError(
            'SEARCH_LIBRARY',
            searchIntentId,
            { arg: query },
            error?.message || 'SEARCH_LIBRARY_FAILED',
            toolErrorOptions
          );
          return;
        }
        if (searchRes.hits.length > 0) {
          evidenceLedger.record('SEARCH_HIT', query);
        }
        emitToolResult(
          'SEARCH_LIBRARY',
          searchIntentId,
          { arg: query, hitsCount: searchRes.hits.length },
          toolResultOptions
        );

        if (searchRes.hits.length === 1) {
          const hit = searchRes.hits[0];
          if (chunkRequest) {
            const { text } = await listLibraryChunkSummaries(String(hit.document_id));
            publishReactiveSpeech({
              ctx,
              trace,
              callbacks,
              speechText: text,
              internalThought: ''
            });
            updateContextAfterAction(ctx);
            return;
          }
          await readLibraryDoc(String(hit.document_id));
          return;
        }

        if (searchRes.hits.length > 1) {
          const seen = new Set<string>();
          const options: string[] = [];
          for (const hit of searchRes.hits) {
            const docId = String(hit.document_id);
            if (seen.has(docId)) continue;
            seen.add(docId);
            const snippet = String(hit.snippet || '').replace(/\s+/g, ' ').slice(0, 80);
            options.push(`${docId} :: ${snippet || '...'}`);
            if (options.length >= 3) break;
          }
          publishClarification('Znalazlem kilka pasujacych dokumentow. Ktory mam otworzyc?', options);
          return;
        }

        publishClarification('Nie znalazlem dokumentu. Podaj dokladny tytul.');
      };

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
            updateArtifactAnchor(id, artifactName);
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
          updateArtifactAnchor(art.id, art.name);
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
            updateArtifactAnchor(resolved.id, artifactName);
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
            updateArtifactAnchor(resolved.id, artifactName);
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


