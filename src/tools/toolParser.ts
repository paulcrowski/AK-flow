import { eventBus } from '../core/EventBus';
import { CortexService } from '../llm/gemini';
import { MemoryService, getCurrentAgentId, getCurrentOwnerId, getCurrentUserEmail } from '../services/supabase';
import { persistSearchKnowledgeChunk } from '../services/SearchKnowledgeChunker';
import { downloadLibraryDocumentText, uploadLibraryFile } from '../services/LibraryService';
import { safeParseJson, splitTodo3 } from '../utils/splitTodo3';
import { AgentType, PacketType } from '../types';
import { getCurrentTraceId } from '../core/trace/TraceContext';
import { generateUUID } from '../utils/uuid';
import * as SomaSystem from '../core/systems/SomaSystem';
import * as LimbicSystem from '../core/systems/LimbicSystem';
import { VISUAL_BASE_COOLDOWN_MS, VISUAL_ENERGY_COST_BASE } from '../core/constants';
import { useArtifactStore, hashArtifactContent, normalizeArtifactRef as normalizeArtifactRefCore } from '../stores/artifactStore';
import { getCognitiveState } from '../stores/cognitiveStore';
import { SYSTEM_CONFIG } from '../core/config/systemConfig';
import { p0MetricAdd } from '../core/systems/TickLifecycleTelemetry';
import { consumeWorkspaceTags } from './workspaceTools';
import { scheduleSoftTimeout, searchInFlight, visualInFlight, withTimeout } from './toolRuntime';

// P0 13/10: Tool execution timeout (ms)
const TOOL_TIMEOUT_MS = (() => {
  const isTestEnv = typeof process !== 'undefined' && process.env.NODE_ENV === 'test';
  const defaultMs = isTestEnv ? 10000 : 20000;
  const raw = (import.meta as any)?.env?.VITE_TOOL_TIMEOUT_MS;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : defaultMs;
})();

export interface ToolParserDeps {
  setCurrentThought: (t: string) => void;
  addMessage: (role: 'user' | 'assistant', text: string, type?: 'thought' | 'speech' | 'visual' | 'intel' | 'action' | 'tool_result', imageData?: string, sources?: any[]) => void;
  setSomaState: (updater: (prev: any) => any) => void;
  setLimbicState: (updater: (prev: any) => any) => void;
  lastVisualTimestampRef: { current: number };
  visualBingeCountRef: { current: number };
  stateRef: { current: any };
  getActiveSessionId?: () => string | null | undefined;
}

export const createProcessOutputForTools = (deps: ToolParserDeps) => {
  const {
    setCurrentThought,
    addMessage,
    setSomaState,
    setLimbicState,
    lastVisualTimestampRef,
    visualBingeCountRef,
    stateRef
  } = deps;

  return async function processOutputForTools(rawText: string): Promise<string> {
    let cleanText = rawText;

    const normalizeArg = (raw: string) => {
      let s = String(raw || '').trim();
      if ((s.startsWith('<') && s.endsWith('>')) || (s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'")) || (s.startsWith('`') && s.endsWith('`'))) {
        s = s.slice(1, -1).trim();
      }
      s = s.replace(/\s+/g, ' ');
      return s;
    };

    const inferMimeTypeFromName = (name: string) => {
      const lower = String(name || '').toLowerCase();
      if (lower.endsWith('.md')) return 'text/markdown';
      if (lower.endsWith('.txt')) return 'text/plain';
      if (lower.endsWith('.json')) return 'application/json';
      if (lower.endsWith('.ts') || lower.endsWith('.tsx')) return 'text/plain';
      return 'application/octet-stream';
    };

    const publishRequiresEvidence = (name: string) => {
      const lower = String(name || '').toLowerCase().trim();
      return lower.endsWith('.ts') || lower.endsWith('.tsx') || lower.endsWith('.js') || lower.endsWith('.jsx') || lower.endsWith('.py') || lower.endsWith('.go') || lower.endsWith('.rs') || lower.endsWith('.java') || lower.endsWith('.cs') || lower.endsWith('.sql') || lower.endsWith('.diff') || lower.endsWith('.patch');
    };

    const emitToolError = (params: { tool: string; payload: any; error: string; intentId: string }) => {
      eventBus.publish({
        id: generateUUID(),
        timestamp: Date.now(),
        source: AgentType.CORTEX_FLOW,
        type: PacketType.TOOL_ERROR,
        payload: { ...params.payload, tool: params.tool, intentId: params.intentId, error: params.error },
        priority: 0.9
      });
      addMessage('assistant', `TOOL_ERROR: ${params.tool} :: ${params.error}`, 'thought');
    };

    const P011_NORMALIZE_ARTIFACT_REF_ENABLED =
      (SYSTEM_CONFIG.features as Record<string, boolean>).P011_NORMALIZE_ARTIFACT_REF_ENABLED ?? true;

    type ArtifactRefResult =
      | { ok: true; id: string; nameHint?: string }
      | { ok: false; code: 'NOT_FOUND' | 'AMBIGUOUS'; userMessage: string };

    const isArtifactRefError = (r: ArtifactRefResult): r is Extract<ArtifactRefResult, { ok: false }> => !r.ok;

    const normalizeArtifactRef = (refRaw: string): ArtifactRefResult => {
      const traceId = getCurrentTraceId();
      if (traceId) p0MetricAdd(traceId, { artifactResolveAttempt: 1 });
      const raw = normalizeArg(refRaw);
      if (!P011_NORMALIZE_ARTIFACT_REF_ENABLED) {
        const ok = raw.startsWith('art-');
        if (traceId) p0MetricAdd(traceId, ok ? { artifactResolveSuccess: 1 } : { artifactResolveFail: 1 });
        return ok
          ? { ok: true, id: raw }
          : {
              ok: false,
              code: 'NOT_FOUND',
              userMessage: `Nie znalazłem artefaktu '${raw}'. Użyj ID (art-123) albo utwórz nowy plik.`
            };
      }

      const r = normalizeArtifactRefCore(raw);
      if (traceId) p0MetricAdd(traceId, r.ok ? { artifactResolveSuccess: 1 } : { artifactResolveFail: 1 });
      return r as any;
    };

    const emitToolResult = (params: { tool: string; payload: any; intentId: string }) => {
      eventBus.publish({
        id: generateUUID(),
        timestamp: Date.now(),
        source: AgentType.CORTEX_FLOW,
        type: PacketType.TOOL_RESULT,
        payload: { ...params.payload, tool: params.tool, intentId: params.intentId },
        priority: 0.8
      });
    };

    const handlePublishArtifact = async (artifactIdRaw: string) => {
      const tool = 'PUBLISH';
      const intentId = generateUUID();
      const resolved = normalizeArtifactRef(artifactIdRaw);
      const argForIntent = isArtifactRefError(resolved) ? String(artifactIdRaw || '') : resolved.id;
      eventBus.publish({
        id: intentId,
        timestamp: Date.now(),
        source: AgentType.CORTEX_FLOW,
        type: PacketType.TOOL_INTENT,
        payload: { tool, arg: argForIntent },
        priority: 0.8
      });
      if (isArtifactRefError(resolved)) {
        emitToolError({ tool, intentId, payload: { arg: artifactIdRaw }, error: resolved.userMessage });
        return;
      }
      const resolvedId = resolved.id;
      try {
        const store = useArtifactStore.getState();
        const art = store.get(resolvedId);
        if (!art) throw new Error('ARTIFACT_NOT_FOUND');
        if (publishRequiresEvidence(art.name)) {
          const evidenceCount = Array.isArray((store as any).evidence) ? (store as any).evidence.length : 0;
          if (evidenceCount <= 0) {
            throw new Error('EVIDENCE_REQUIRED: use READ_LIBRARY_RANGE or READ_ARTIFACT first');
          }
        }
        const authUserId = getCurrentOwnerId();
        const userEmail = getCurrentUserEmail();
        if (!authUserId || !userEmail) throw new Error('AUTH_REQUIRED');
        const agentId = getCurrentAgentId();
        const mime = inferMimeTypeFromName(art.name);
        const file = new File([String(art.content || '')], art.name, { type: mime });
        const res: any = await withTimeout<any>(
          uploadLibraryFile({
            file,
            authUserId,
            userEmail,
            agentId: agentId ?? null
          }) as any,
          TOOL_TIMEOUT_MS,
          'PUBLISH'
        );
        if (res.ok === false) throw new Error(res.error);
        emitToolResult({
          tool,
          intentId,
          payload: {
            id: art.id,
            name: art.name,
            docId: res.document?.id,
            size: file.size
          }
        });
        addMessage('assistant', `PUBLISH_OK: ${String(res.document?.id || '')} (${art.name})`, 'tool_result');
      } catch (e: any) {
        emitToolError({ tool, intentId, payload: { arg: artifactIdRaw }, error: e?.message || String(e) });
      }
    };

    const handleArtifactBlock = async (params: { kind: 'CREATE' | 'APPEND' | 'REPLACE'; header: string; body: string; raw: string }) => {
      const tool = params.kind;
      const intentId = generateUUID();
      eventBus.publish({
        id: intentId,
        timestamp: Date.now(),
        source: AgentType.CORTEX_FLOW,
        type: PacketType.TOOL_INTENT,
        payload: { tool, arg: params.header },
        priority: 0.8
      });

      try {
        const store = useArtifactStore.getState();
        if (params.kind === 'CREATE') {
          const id = store.create(params.header, params.body);
          emitToolResult({ tool, intentId, payload: { id, name: params.header } });
          addMessage('assistant', `CREATE_OK: ${id} (${params.header})`, 'tool_result');
          const created = store.get(id);
          if (created) {
            const hash = hashArtifactContent(created.content);
            store.addEvidence({ kind: 'artifact', ts: Date.now(), artifactId: created.id, name: created.name, hash });
            addMessage('assistant', `READ_ARTIFACT ${created.id} (${created.name}) hash=${hash}\n\n${created.content}`, 'tool_result');
          }
          return;
        }

        const resolved = normalizeArtifactRef(params.header);
        if (isArtifactRefError(resolved)) {
          emitToolError({ tool, intentId, payload: { arg: params.header }, error: resolved.userMessage });
          return;
        }
        const id = resolved.id;
        if (params.kind === 'APPEND') {
          store.append(id, params.body);
          emitToolResult({ tool, intentId, payload: { id } });
          addMessage('assistant', `APPEND_OK: ${id}`, 'tool_result');
          return;
        }

        store.replace(id, params.body);
        emitToolResult({ tool, intentId, payload: { id } });
        addMessage('assistant', `REPLACE_OK: ${id}`, 'tool_result');
      } catch (e: any) {
        emitToolError({ tool, intentId, payload: { arg: params.header }, error: e?.message || String(e) });
      }
    };

    const handleReadArtifact = async (artifactIdRaw: string, rawTag: string) => {
      const tool = 'READ_ARTIFACT';
      const intentId = generateUUID();
      const artifactId = String(artifactIdRaw || '').trim();
      eventBus.publish({
        id: intentId,
        timestamp: Date.now(),
        source: AgentType.CORTEX_FLOW,
        type: PacketType.TOOL_INTENT,
        payload: { tool, arg: artifactId },
        priority: 0.8
      });

      try {
        const store = useArtifactStore.getState();
        const resolved = normalizeArtifactRef(artifactId);
        if (isArtifactRefError(resolved)) {
          emitToolError({ tool, intentId, payload: { arg: artifactId }, error: resolved.userMessage });
          return;
        }
        const art = store.get(resolved.id);
        if (!art) throw new Error('ARTIFACT_NOT_FOUND');
        const hash = hashArtifactContent(art.content);
        store.addEvidence({ kind: 'artifact', ts: Date.now(), artifactId: art.id, name: art.name, hash });
        emitToolResult({ tool, intentId, payload: { id: art.id, name: art.name, length: art.content.length, hash } });
        addMessage('assistant', `READ_ARTIFACT ${art.id} (${art.name}) hash=${hash}\n\n${art.content}`, 'tool_result');
      } catch (e: any) {
        emitToolError({ tool, intentId, payload: { arg: artifactId }, error: e?.message || String(e) });
      }
    };

    while (true) {
      const publishMatch = cleanText.match(/\[PUBLISH:\s*([^\]]+?)\](?:\s*\[\/PUBLISH\])?/i);
      if (publishMatch) {
        cleanText = cleanText.replace(publishMatch[0], '').trim();
        await handlePublishArtifact(publishMatch[1]);
        continue;
      }

      const readMatch = cleanText.match(/\[READ_ARTIFACT:\s*([^\]]+?)\](?:\s*\[\/READ_ARTIFACT\])?/i);
      if (readMatch) {
        cleanText = cleanText.replace(readMatch[0], '').trim();
        await handleReadArtifact(readMatch[1], readMatch[0]);
        continue;
      }

      // Allow single-line APPEND/REPLACE without closing tag: [APPEND: name]content
      const singleLineMatch = cleanText.match(/\[(APPEND|REPLACE):\s*([^\]]+?)\]([^\[]+)/i);
      if (singleLineMatch) {
        const kind = String(singleLineMatch[1] || '').toUpperCase() as any;
        const header = String(singleLineMatch[2] || '').trim();
        const body = String(singleLineMatch[3] || '').trim();
        cleanText = cleanText.replace(singleLineMatch[0], '').trim();
        await handleArtifactBlock({ kind, header, body, raw: singleLineMatch[0] });
        continue;
      }

      const blockMatch = cleanText.match(/\[(CREATE|APPEND|REPLACE):\s*([^\]]+?)\]([\s\S]*?)\[\/(CREATE|APPEND|REPLACE)\]/i);
      if (!blockMatch) break;

      const kind = String(blockMatch[1] || '').toUpperCase() as any;
      const header = String(blockMatch[2] || '').trim();
      const body = String(blockMatch[3] || '');
      cleanText = cleanText.replace(blockMatch[0], '').trim();

      if (String(blockMatch[1] || '').toUpperCase() !== String(blockMatch[4] || '').toUpperCase()) {
        const tool = 'ARTIFACT_BLOCK';
        const intentId = generateUUID();
        eventBus.publish({
          id: intentId,
          timestamp: Date.now(),
          source: AgentType.CORTEX_FLOW,
          type: PacketType.TOOL_INTENT,
          payload: { tool, arg: kind },
          priority: 0.8
        });
        emitToolError({ tool, intentId, payload: { arg: kind }, error: 'TAG_MISMATCH' });
        continue;
      }

      await handleArtifactBlock({ kind, header, body, raw: blockMatch[0] });
    }

    // 0.5 DETerministic JSON ACTION: SPLIT_TODO3
    // [SPLIT_TODO3: <documentId>]
    const splitMatch = cleanText.match(/\[SPLIT_TODO3:\s*([^\]]+?)\]/i);
    if (splitMatch) {
      const documentId = String(splitMatch[1] || '').trim();
      cleanText = cleanText.replace(splitMatch[0], '').trim();

      const tool = 'SPLIT_TODO3';
      const intentId = generateUUID();
      eventBus.publish({
        id: intentId,
        timestamp: Date.now(),
        source: AgentType.CORTEX_FLOW,
        type: PacketType.TOOL_INTENT,
        payload: { tool, arg: documentId },
        priority: 0.8
      });

      try {
        addMessage('assistant', `Invoking SPLIT_TODO3 for: ${documentId}`, 'action');
        setCurrentThought('Workspace split TODO → 3...');

        const res: any = await withTimeout<any>(downloadLibraryDocumentText({ documentId }) as any, TOOL_TIMEOUT_MS, tool);
        if (res.ok === false) throw new Error(res.error);

        const parsed = safeParseJson(String(res.text || ''));
        if (!parsed) throw new Error('JSON_PARSE_ERROR');

        const result = splitTodo3(parsed);
        const text = [
          `SPLIT_TODO3 ${documentId} (${res.doc.original_name}):`,
          `NOW=${result.now.length} NEXT=${result.next.length} LATER=${result.later.length}`,
          '',
          'NOW:',
          ...result.now.slice(0, 50).map((t: any, i: number) => `- ${String(t?.content || t?.id || i)}`),
          '',
          'NEXT:',
          ...result.next.slice(0, 50).map((t: any, i: number) => `- ${String(t?.content || t?.id || i)}`),
          '',
          'LATER:',
          ...result.later.slice(0, 50).map((t: any, i: number) => `- ${String(t?.content || t?.id || i)}`)
        ].join('\n');

        eventBus.publish({
          id: generateUUID(),
          timestamp: Date.now(),
          source: AgentType.CORTEX_FLOW,
          type: PacketType.TOOL_RESULT,
          payload: { tool, arg: documentId, intentId },
          priority: 0.8
        });

        addMessage('assistant', text, 'tool_result');
      } catch (error: any) {
        const msg = error?.message || String(error);
        const isTimeout = typeof msg === 'string' && msg.startsWith('TOOL_TIMEOUT:');
        eventBus.publish({
          id: generateUUID(),
          timestamp: Date.now(),
          source: AgentType.CORTEX_FLOW,
          type: isTimeout ? PacketType.TOOL_TIMEOUT : PacketType.TOOL_ERROR,
          payload: { tool, arg: documentId, intentId, error: msg },
          priority: 0.9
        });
        addMessage('assistant', `SPLIT_TODO3_${isTimeout ? 'TIMEOUT' : 'ERROR'}: ${documentId} :: ${msg}`, 'thought');
      }
    }

    // 0. WORKSPACE TOOLS (Library-backed)
    // [SEARCH_LIBRARY: query]
    // [READ_LIBRARY_CHUNK: <docId>#<chunkIndex>]
    // [READ_LIBRARY_DOC: <docId>]
    // Aliases:
    // [SEARCH_IN_REPO: query] -> SEARCH_LIBRARY
    // [READ_FILE: <docId>] -> READ_LIBRARY_DOC
    // [READ_FILE_CHUNK: <docId>#<chunkIndex>] -> READ_LIBRARY_CHUNK
    cleanText = await consumeWorkspaceTags({
      cleanText,
      deps: { setCurrentThought, addMessage },
      timeoutMs: TOOL_TIMEOUT_MS,
      makeId: generateUUID,
      publish: (packet) => eventBus.publish(packet)
    });

    // SNAPSHOT TOOL
    // [SNAPSHOT]
    const snapshotMatch = cleanText.match(/\[SNAPSHOT\]/i);
    if (snapshotMatch) {
      cleanText = cleanText.replace(snapshotMatch[0], '').trim();
      const tool = 'SNAPSHOT';
      const intentId = generateUUID();

      eventBus.publish({
        id: intentId,
        timestamp: Date.now(),
        source: AgentType.CORTEX_FLOW,
        type: PacketType.TOOL_INTENT,
        payload: { tool },
        priority: 0.8
      });

      addMessage('assistant', 'Invoking SNAPSHOT', 'action');
      setCurrentThought('Generating snapshot...');

      try {
        const agentId = getCurrentAgentId() ?? 'unknown';
        const sessionId = deps.getActiveSessionId?.() ?? 'unknown';
        const state = getCognitiveState();

        const kernelState = {
          conversation: (state.uiConversation || []).slice(-200).map((m: any, idx: number) => ({
            id: String(m?.id || `${intentId}-${idx}`),
            role: String(m?.role || 'unknown'),
            content: String(m?.text || ''),
            timestamp: Date.now()
          })),
          limbicState: state.limbic,
          chemState: state.neuro,
          somaState: state.soma,
          activeGoal: state.goalState?.activeGoal
        } as any;

        const { exportFullSnapshot, saveSnapshotToDb } = await import('../services/SnapshotService');
        const snapshot = await exportFullSnapshot(agentId, sessionId, kernelState);

        const artifactName = `snapshot_${snapshot.exportedAt}.json`;
        const store = useArtifactStore.getState();
        const artifactId = store.create(artifactName, JSON.stringify(snapshot, null, 2));

        let snapshotId: string | null = null;
        try {
          snapshotId = await saveSnapshotToDb(snapshot);
        } catch {
          snapshotId = null;
        }

        emitToolResult({
          tool,
          intentId,
          payload: {
            artifactId,
            artifactName,
            ...(snapshotId ? { snapshotId } : {})
          }
        });

        addMessage(
          'assistant',
          `SNAPSHOT_OK: ${artifactId} (${artifactName})${snapshotId ? ` db=${snapshotId}` : ''}`,
          'tool_result'
        );
      } catch (e: any) {
        emitToolError({ tool: 'SNAPSHOT', intentId, payload: {}, error: e?.message || String(e) });
      }
    }

    // 1. SEARCH TAG
    let searchMatch = cleanText.match(/\[SEARCH:\s*(.*?)\]/i);
    if (!searchMatch) {
      const legacySearch = cleanText.match(/\[SEARCH\]\s*(?:for\s*)?:?\s*(.+)$/i);
      if (legacySearch) {
        searchMatch = [legacySearch[0], legacySearch[1]] as any;
      }
    }

    if (searchMatch) {
      const query = searchMatch[1].trim();
      cleanText = cleanText.replace(searchMatch[0], '').trim();
      const intentId = generateUUID();

      // P0: TOOL_INTENT event
      eventBus.publish({
        id: intentId,
        timestamp: Date.now(),
        source: AgentType.CORTEX_FLOW,
        type: PacketType.TOOL_INTENT,
        payload: { tool: 'SEARCH', query },
        priority: 0.8
      });

      const key = query.toLowerCase();
      let op = searchInFlight.get(key);

      if (!op) {
        addMessage('assistant', `Invoking SEARCH for: "${query}"`, 'action');
        setCurrentThought(`Researching: ${query}...`);

        const startedTraceId = getCurrentTraceId() ?? undefined;
        const startedSessionId = deps.getActiveSessionId?.() ?? undefined;

        const promise = CortexService.performDeepResearch(query, 'User requested data.');
        op = {
          promise,
          startedAt: Date.now(),
          intentIds: new Set<string>([intentId]),
          timeoutEmitted: new Set<string>(),
          settled: false,
          primaryIntentId: intentId,
          startedTraceId,
          startedSessionId
        };
        searchInFlight.set(key, op);

        void promise
          .then((research) => {
            op!.settled = true;

            if (!research || !research.synthesis) {
              for (const id of op!.intentIds) {
                eventBus.publish({
                  id: generateUUID(),
                  timestamp: Date.now(),
                  source: AgentType.CORTEX_FLOW,
                  type: PacketType.TOOL_ERROR,
                  payload: { tool: 'SEARCH', query, intentId: id, error: 'Empty result' },
                  priority: 0.9
                });
              }
              addMessage('assistant', 'Mój moduł SEARCH jest teraz wyłączony.', 'thought');
              return;
            }

            for (const id of op!.intentIds) {
              eventBus.publish({
                id: generateUUID(),
                timestamp: Date.now(),
                source: AgentType.CORTEX_FLOW,
                type: PacketType.TOOL_RESULT,
                payload: {
                  tool: 'SEARCH',
                  query,
                  intentId: id,
                  sourcesCount: research.sources?.length || 0,
                  synthesisLength: research.synthesis.length,
                  late: op!.timeoutEmitted.has(id)
                },
                priority: 0.8
              });
            }

            if (op!.timeoutEmitted.size > 0) {
              addMessage(
                'assistant',
                `SEARCH wynik dotarł po TIMEOUT (dołączony). query="${query}"`,
                'thought'
              );
            }

            addMessage('assistant', research.synthesis, 'intel', undefined, research.sources);

            // P0 v1.2: Persist SEARCH results as consolidated knowledge chunks (feature-flagged)
            void persistSearchKnowledgeChunk({
              query,
              synthesis: research.synthesis,
              sources: research.sources,
              traceId: op!.startedTraceId,
              sessionId: op!.startedSessionId,
              toolIntentId: op!.primaryIntentId
            });
          })
          .catch((error: any) => {
            op!.settled = true;
            console.warn('[ToolParser] Research failed:', error);

            for (const id of op!.intentIds) {
              eventBus.publish({
                id: generateUUID(),
                timestamp: Date.now(),
                source: AgentType.CORTEX_FLOW,
                type: PacketType.TOOL_ERROR,
                payload: {
                  tool: 'SEARCH',
                  query,
                  intentId: id,
                  error: error?.message || 'Unknown error'
                },
                priority: 0.9
              });
            }

            addMessage('assistant', 'Mój moduł SEARCH jest teraz wyłączony.', 'thought');
          })
          .finally(() => {
            searchInFlight.delete(key);
          });
      } else {
        op.intentIds.add(intentId);
      }
      scheduleSoftTimeout({
        op,
        intentId,
        tool: 'SEARCH',
        payload: { query },
        timeoutMs: TOOL_TIMEOUT_MS,
        makeId: generateUUID,
        publish: (packet) => eventBus.publish(packet)
      });
    }

    // 2. VISUAL TAG
    let visualMatch = cleanText.match(/\[VISUALIZE:\s*([\s\S]*?)\]/i);
    if (!visualMatch) {
      const legacyVisual = cleanText.match(/\[VISUALIZE\]\s*(.+)$/is);
      if (legacyVisual) {
        visualMatch = [legacyVisual[0], legacyVisual[1]] as any;
      }
    }
    if (!visualMatch) {
      const progressiveVisual = cleanText.match(/\[(Visualize|visualize|Visualizing|visualizing)\s+(.+?)\]/is);
      if (progressiveVisual) {
        visualMatch = [progressiveVisual[0], progressiveVisual[2]] as any;
      }
    }

    if (visualMatch) {
      let prompt = visualMatch[1].trim();
      if (prompt.endsWith(']')) prompt = prompt.slice(0, -1);

      console.log('Visual Tag Detected:', prompt);

      // TAGGED COGNITION: Log MY_ACTION before tool invocation
      addMessage('assistant', `Invoking VISUALIZE for: "${prompt.substring(0, 50)}..."`, 'action');
      cleanText = cleanText.replace(visualMatch[0], '').trim();

      const now = Date.now();
      if (now - lastVisualTimestampRef.current > VISUAL_BASE_COOLDOWN_MS * 10) {
        visualBingeCountRef.current = 0;
      }

      const currentBinge = visualBingeCountRef.current;
      const dynamicCooldown = VISUAL_BASE_COOLDOWN_MS * (currentBinge + 1);
      const timeSinceLast = now - lastVisualTimestampRef.current;

      if (timeSinceLast < dynamicCooldown) {
        const remainingSec = Math.ceil((dynamicCooldown - timeSinceLast) / 1000);
        const distractions = [
          'System Alert: Sudden spike in entropy detected. Analyze logic structure instead.',
          'Data Stream Update: Reviewing recent memory coherence.',
          'Focus Shift: Analyzing linguistic patterns in user input.'
        ];
        const randomDistraction = distractions[Math.floor(Math.random() * distractions.length)];

        addMessage(
          'assistant',
          `[VISUAL CORTEX REFRACTORY PERIOD ACTIVE - ${remainingSec}s REMAINING] ${randomDistraction}`,
          'thought'
        );

        eventBus.publish({
          id: generateUUID(),
          timestamp: Date.now(),
          source: AgentType.CORTEX_FLOW,
          type: PacketType.SYSTEM_ALERT,
          payload: { msg: 'Visual Cortex Overload. Redirecting focus.' },
          priority: 0.2
        });

        return cleanText;
      } else {
        const intentId = generateUUID();
        
        // P0: TOOL_INTENT event
        eventBus.publish({
          id: intentId,
          timestamp: Date.now(),
          source: AgentType.VISUAL_CORTEX,
          type: PacketType.TOOL_INTENT,
          payload: { tool: 'VISUALIZE', prompt: prompt.substring(0, 100) },
          priority: 0.8
        });

        const key = prompt.toLowerCase();
        let op = visualInFlight.get(key);

        if (!op) {
          setCurrentThought(`Visualizing: ${prompt.substring(0, 30)}...`);
          lastVisualTimestampRef.current = now;
          visualBingeCountRef.current += 1;

          const energyCost = VISUAL_ENERGY_COST_BASE * (currentBinge + 1);

          setSomaState(prev => {
            let updated = SomaSystem.applyEnergyCost(prev, energyCost);
            updated = SomaSystem.applyCognitiveLoad(updated, 15);
            return updated;
          });

          setLimbicState(prev => LimbicSystem.applyVisualEmotionalCost(prev, currentBinge));

          eventBus.publish({
            id: generateUUID(),
            timestamp: Date.now(),
            source: AgentType.VISUAL_CORTEX,
            type: PacketType.VISUAL_THOUGHT,
            payload: { status: 'RENDERING', prompt },
            priority: 0.5
          });

          const promise = CortexService.generateVisualThought(prompt);
          op = {
            promise,
            startedAt: Date.now(),
            intentIds: new Set<string>([intentId]),
            timeoutEmitted: new Set<string>(),
            settled: false
          };
          visualInFlight.set(key, op);

          void promise
            .then(async (img) => {
              op!.settled = true;

              if (!img) {
                for (const id of op!.intentIds) {
                  eventBus.publish({
                    id: generateUUID(),
                    timestamp: Date.now(),
                    source: AgentType.VISUAL_CORTEX,
                    type: PacketType.TOOL_ERROR,
                    payload: { tool: 'VISUALIZE', intentId: id, error: 'Null image result' },
                    priority: 0.9
                  });
                }
                return;
              }

              const perception = await CortexService.analyzeVisualInput(img);

              for (const id of op!.intentIds) {
                eventBus.publish({
                  id: generateUUID(),
                  timestamp: Date.now(),
                  source: AgentType.VISUAL_CORTEX,
                  type: PacketType.TOOL_RESULT,
                  payload: {
                    tool: 'VISUALIZE',
                    intentId: id,
                    hasImage: true,
                    perceptionLength: perception?.length || 0,
                    late: op!.timeoutEmitted.has(id)
                  },
                  priority: 0.8
                });
              }

              eventBus.publish({
                id: generateUUID(),
                timestamp: Date.now(),
                source: AgentType.VISUAL_CORTEX,
                type: PacketType.VISUAL_PERCEPTION,
                payload: {
                  status: 'PERCEPTION_COMPLETE',
                  prompt: prompt,
                  perception_text: perception
                },
                priority: 0.9
              });

              addMessage('assistant', perception, 'visual', img);

              MemoryService.storeMemory({
                content: `ACTION: Generated Image of "${prompt}". PERCEPTION: ${perception}`,
                emotionalContext: stateRef.current.limbicState,
                timestamp: new Date().toISOString(),
                imageData: img,
                isVisualDream: true
              });
            })
            .catch((e: any) => {
              op!.settled = true;
              console.warn('Visual gen failed', e);

              for (const id of op!.intentIds) {
                eventBus.publish({
                  id: generateUUID(),
                  timestamp: Date.now(),
                  source: AgentType.VISUAL_CORTEX,
                  type: PacketType.TOOL_ERROR,
                  payload: {
                    tool: 'VISUALIZE',
                    intentId: id,
                    error: e?.message || 'Unknown error'
                  },
                  priority: 0.9
                });
              }
            })
            .finally(() => {
              visualInFlight.delete(key);
            });
        } else {
          op.intentIds.add(intentId);
        }
        scheduleSoftTimeout({
          op,
          intentId,
          tool: 'VISUALIZE',
          payload: { prompt: prompt.substring(0, 100) },
          timeoutMs: TOOL_TIMEOUT_MS,
          makeId: generateUUID,
          publish: (packet) => eventBus.publish(packet)
        });
      }
    }

    return cleanText;
  };
};
