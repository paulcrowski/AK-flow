import { eventBus } from '../core/EventBus';
import { getCurrentAgentId, getCurrentOwnerId, getCurrentUserEmail } from '../services/supabase';
import { downloadLibraryDocumentText, uploadLibraryFile } from '../services/LibraryService';
import { safeParseJson, splitTodo3 } from '../utils/splitTodo3';
import { AgentType, PacketType } from '../types';
import { getCurrentTraceId } from '../core/trace/TraceContext';
import { generateUUID } from '../utils/uuid';
import { useArtifactStore, hashArtifactContent, normalizeArtifactRef as normalizeArtifactRefCore } from '../stores/artifactStore';
import { getRememberedArtifactName, rememberArtifactName } from '../core/utils/artifactNameCache';
import { buildToolCommitDetails, formatToolCommitMessage } from '../core/utils/toolCommit';
import { getCognitiveState } from '../stores/cognitiveStore';
import { SYSTEM_CONFIG } from '../core/config/systemConfig';
import { p0MetricAdd } from '../core/systems/TickLifecycleTelemetry';
import { consumeWorkspaceTags } from './workspaceTools';
import { withTimeout } from './toolRuntime';
import { consumeSearchTag } from './searchTag';
import { consumeVisualizeTag } from './visualizeTag';

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
      const headerNameHint = params.header.startsWith('art-')
        ? getRememberedArtifactName(params.header) || ''
        : params.header;
      eventBus.publish({
        id: intentId,
        timestamp: Date.now(),
        source: AgentType.CORTEX_FLOW,
        type: PacketType.TOOL_INTENT,
        payload: { tool, arg: params.header, ...(headerNameHint ? { artifactName: headerNameHint } : {}) },
        priority: 0.8
      });

      try {
        const store = useArtifactStore.getState();
        if (params.kind === 'CREATE') {
          const id = store.create(params.header, params.body);
          const created = store.get(id);
          const artifactName = rememberArtifactName(id, created?.name || params.header) || params.header;
          emitToolResult({ tool, intentId, payload: { id, name: artifactName } });
          emitToolCommit({
            action: 'CREATE',
            artifactId: id,
            artifactName,
            afterContent: created?.content ?? params.body
          });
          if (created) {
            const hash = hashArtifactContent(created.content);
            store.addEvidence({ kind: 'artifact', ts: Date.now(), artifactId: created.id, name: created.name, hash });
            addMessage('assistant', `READ_ARTIFACT ${created.id} (${created.name}) hash=${hash}\n\n${created.content}`, 'tool_result');
            addMessage('assistant', `Artifact created: ${created.name} (${created.id}). Open Artifacts panel to view.`, 'action');
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
          const before = store.get(id)?.content ?? '';
          store.append(id, params.body);
          const updated = store.get(id);
          const after = updated?.content ?? '';
          const artifactName = rememberArtifactName(
            id,
            updated?.name || resolved.nameHint || getRememberedArtifactName(id) || ''
          ) || resolved.nameHint || id;
          emitToolResult({ tool, intentId, payload: { id, name: artifactName } });
          emitToolCommit({
            action: 'APPEND',
            artifactId: id,
            artifactName,
            beforeContent: before,
            afterContent: after
          });
          store.markComplete(id, true);
          return;
        }

        const before = store.get(id)?.content ?? '';
        store.replace(id, params.body);
        const updated = store.get(id);
        const after = updated?.content ?? '';
        const artifactName = rememberArtifactName(
          id,
          updated?.name || resolved.nameHint || getRememberedArtifactName(id) || ''
        ) || resolved.nameHint || id;
        emitToolResult({ tool, intentId, payload: { id, name: artifactName } });
        emitToolCommit({
          action: 'REPLACE',
          artifactId: id,
          artifactName,
          beforeContent: before,
          afterContent: after
        });
        store.markComplete(id, true);
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
      const workspaceWriteMatch = cleanText.match(/\[WORKSPACE_WRITE_FILE:\s*([^,\]]+),\s*([\s\S]*?)\]/i);
      if (workspaceWriteMatch) {
        const fileName = normalizeArg(workspaceWriteMatch[1]);
        const body = String(workspaceWriteMatch[2] || '').trim();
        cleanText = cleanText.replace(workspaceWriteMatch[0], '').trim();
        const store = useArtifactStore.getState();
        const existing = store.list().find((a: any) => a.name === fileName);
        if (existing) {
          await handleArtifactBlock({ kind: 'REPLACE', header: existing.id, body, raw: workspaceWriteMatch[0] });
        } else {
          await handleArtifactBlock({ kind: 'CREATE', header: fileName, body, raw: workspaceWriteMatch[0] });
        }
        continue;
      }

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
        addMessage('assistant', `Artifact created: ${artifactName} (${artifactId}). Open Artifacts panel to view.`, 'action');
      } catch (e: any) {
        emitToolError({ tool: 'SNAPSHOT', intentId, payload: {}, error: e?.message || String(e) });
      }
    }

    // 1. SEARCH TAG
    cleanText = await consumeSearchTag({
      cleanText,
      deps: { setCurrentThought, addMessage, getActiveSessionId: deps.getActiveSessionId },
      timeoutMs: TOOL_TIMEOUT_MS,
      makeId: generateUUID,
      publish: (packet) => eventBus.publish(packet)
    });

    // 2. VISUAL TAG
    cleanText = await consumeVisualizeTag({
      cleanText,
      deps: { setCurrentThought, addMessage, setSomaState, setLimbicState, lastVisualTimestampRef, visualBingeCountRef, stateRef },
      timeoutMs: TOOL_TIMEOUT_MS,
      makeId: generateUUID,
      publish: (packet) => eventBus.publish(packet)
    });

    return cleanText;
  };
};
