import { CortexService } from '../llm/gemini';
import { persistSearchKnowledgeChunk } from '../services/SearchKnowledgeChunker';
import { getCurrentTraceId } from '../core/trace/TraceContext';
import { evidenceLedger } from '../core/systems/EvidenceLedger';
import { emitToolError, emitToolResult } from '../core/telemetry/toolContract';
import { withTimeout } from './toolRuntime';

export type SearchExecutorDeps = {
  publish?: (packet: any) => void;
  makeId?: () => string;
  addMessage?: (
    role: 'user' | 'assistant',
    text: string,
    type?: 'thought' | 'speech' | 'visual' | 'intel' | 'action' | 'tool_result',
    imageData?: string,
    sources?: any[]
  ) => void;
  getActiveSessionId?: () => string | null | undefined;
};

export type SearchExecutionOutcome =
  | { ok: true; synthesis: string; sources: any[] }
  | { ok: false; error: string };

const SEARCH_FAILURE_THOUGHT = 'Moj modul SEARCH jest teraz wylaczony.';

const buildResultPayload = (params: {
  query: string;
  sourcesCount: number;
  synthesisLength: number;
  late: boolean;
}) => ({
  query: params.query,
  sourcesCount: params.sourcesCount,
  synthesisLength: params.synthesisLength,
  late: params.late
});

const emitResult = (deps: SearchExecutorDeps, intentId: string, payload: Record<string, unknown>) => {
  emitToolResult('SEARCH', intentId, payload, {
    publish: deps.publish,
    makeId: deps.makeId,
    priority: 0.8
  });
};

const emitError = (deps: SearchExecutorDeps, intentId: string, payload: Record<string, unknown>, error: string) => {
  emitToolError('SEARCH', intentId, payload, error, {
    publish: deps.publish,
    makeId: deps.makeId,
    priority: 0.9
  });
};

export function emitSearchSuccess(params: {
  query: string;
  synthesis: string;
  sources?: any[];
  intentIds: Iterable<string>;
  lateIntentIds?: Set<string>;
  deps: SearchExecutorDeps;
  traceId?: string;
  sessionId?: string;
  toolIntentId?: string;
}) {
  const synthesis = String(params.synthesis || '').trim();
  const sources = Array.isArray(params.sources) ? params.sources : [];
  const sourcesCount = sources.length;
  const synthesisLength = synthesis.length;

  for (const intentId of params.intentIds) {
    emitResult(
      params.deps,
      intentId,
      buildResultPayload({
        query: params.query,
        sourcesCount,
        synthesisLength,
        late: params.lateIntentIds?.has(intentId) ?? false
      })
    );
  }

  if (sourcesCount > 0) {
    evidenceLedger.record('SEARCH_HIT', params.query);
  }

  if (params.lateIntentIds && params.lateIntentIds.size > 0 && params.deps.addMessage) {
    params.deps.addMessage(
      'assistant',
      `SEARCH wynik dotarl po TIMEOUT (dolaczony). query="${params.query}"`,
      'thought'
    );
  }

  if (params.deps.addMessage) {
    params.deps.addMessage('assistant', synthesis, 'intel', undefined, sources);
  }

  if (synthesis) {
    void persistSearchKnowledgeChunk({
      query: params.query,
      synthesis,
      sources,
      traceId: params.traceId,
      sessionId: params.sessionId,
      toolIntentId: params.toolIntentId
    });
  }
}

export function emitSearchFailure(params: {
  query: string;
  intentIds: Iterable<string>;
  error: string;
  deps: SearchExecutorDeps;
  reportAsThought?: boolean;
}) {
  for (const intentId of params.intentIds) {
    emitError(params.deps, intentId, { query: params.query }, params.error);
  }

  if (params.reportAsThought !== false && params.deps.addMessage) {
    params.deps.addMessage('assistant', SEARCH_FAILURE_THOUGHT, 'thought');
  }
}

export async function runSearchAndPersist(params: {
  query: string;
  reason: string;
  intentId: string;
  deps: SearchExecutorDeps;
  timeoutMs?: number;
  late?: boolean;
  traceId?: string;
  sessionId?: string;
}): Promise<SearchExecutionOutcome> {
  const traceId = params.traceId ?? getCurrentTraceId() ?? undefined;
  const sessionId = params.sessionId ?? params.deps.getActiveSessionId?.() ?? undefined;

  try {
    const researchPromise = CortexService.performDeepResearch(params.query, params.reason);
    const research = params.timeoutMs
      ? await withTimeout(researchPromise, params.timeoutMs, 'SEARCH')
      : await researchPromise;
    const synthesis = String(research?.synthesis || '').trim();

    if (!synthesis) {
      emitSearchFailure({
        query: params.query,
        intentIds: [params.intentId],
        error: 'Empty result',
        deps: params.deps
      });
      return { ok: false, error: 'Empty result' };
    }

    emitSearchSuccess({
      query: params.query,
      synthesis,
      sources: research?.sources,
      intentIds: [params.intentId],
      lateIntentIds: params.late ? new Set([params.intentId]) : undefined,
      deps: params.deps,
      traceId,
      sessionId,
      toolIntentId: params.intentId
    });

    return {
      ok: true,
      synthesis,
      sources: Array.isArray(research?.sources) ? research.sources : []
    };
  } catch (error: any) {
    const msg = error?.message || String(error);
    const isTimeout = typeof msg === 'string' && msg.startsWith('TOOL_TIMEOUT:');
    const finalMsg = isTimeout ? 'TIMEOUT' : msg;

    emitSearchFailure({
      query: params.query,
      intentIds: [params.intentId],
      error: finalMsg,
      deps: params.deps
    });
    return { ok: false, error: finalMsg };
  }
}
