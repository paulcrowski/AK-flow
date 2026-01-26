import { CortexService } from '../llm/gemini';
import { getCurrentTraceId } from '../core/trace/TraceContext';
import type { ToolParserDeps } from './toolParser';
import { searchInFlight, scheduleSoftTimeout } from './toolRuntime';
import { emitToolIntent } from '../core/telemetry/toolContract';
import { emitSearchFailure, emitSearchSuccess } from './searchExecutor';

type InFlightSearchOp = {
  promise: Promise<any>;
  startedAt: number;
  intentIds: Set<string>;
  timeoutEmitted: Set<string>;
  settled: boolean;
  primaryIntentId: string;
  startedTraceId?: string;
  startedSessionId?: string;
};

function findSearchMatch(cleanText: string): { raw: string; query: string } | null {
  const direct = cleanText.match(/\[SEARCH:\s*(.*?)\]/i);
  if (direct) return { raw: direct[0], query: String(direct[1] || '').trim() };

  const legacy = cleanText.match(/\[SEARCH\]\s*(?:for\s*)?:?\s*(.+)$/i);
  if (legacy) return { raw: legacy[0], query: String(legacy[1] || '').trim() };

  return null;
}

function startSearchOp(params: {
  query: string;
  intentId: string;
  deps: Pick<ToolParserDeps, 'addMessage' | 'setCurrentThought' | 'getActiveSessionId'>;
  makeId: () => string;
  publish: (packet: any) => void;
  timeoutMs: number;
}) {
  const startedTraceId = getCurrentTraceId() ?? undefined;
  const startedSessionId = params.deps.getActiveSessionId?.() ?? undefined;

  const promise = CortexService.performDeepResearch(params.query, 'User requested data.');
  const op: InFlightSearchOp = {
    promise,
    startedAt: Date.now(),
    intentIds: new Set<string>([params.intentId]),
    timeoutEmitted: new Set<string>(),
    settled: false,
    primaryIntentId: params.intentId,
    startedTraceId,
    startedSessionId
  };
  searchInFlight.set(params.query.toLowerCase(), op as any);

  

  const execDeps = { ...params.deps, publish: params.publish, makeId: params.makeId };

  void promise
    .then((research) => {
      op.settled = true;

      const synthesis = String(research?.synthesis || '').trim();
      if (!synthesis) {
        emitSearchFailure({
          query: params.query,
          intentIds: op.intentIds,
          error: 'Empty result',
          deps: execDeps
        });
        return;
      }

      emitSearchSuccess({
        query: params.query,
        synthesis,
        sources: research?.sources,
        intentIds: op.intentIds,
        lateIntentIds: op.timeoutEmitted,
        deps: execDeps,
        traceId: op.startedTraceId,
        sessionId: op.startedSessionId,
        toolIntentId: op.primaryIntentId
      });
    })
    .catch((error: any) => {
      op.settled = true;

      console.warn('[ToolParser] Research failed:', error);

      emitSearchFailure({
        query: params.query,
        intentIds: op.intentIds,
        error: error?.message || 'Unknown error',
        deps: execDeps
      });
    })
    .finally(() => {
      searchInFlight.delete(params.query.toLowerCase());
    });


  return op;
}

export async function consumeSearchTag(params: {
  cleanText: string;
  deps: Pick<ToolParserDeps, 'setCurrentThought' | 'addMessage' | 'getActiveSessionId'>;
  timeoutMs: number;
  makeId: () => string;
  publish: (packet: any) => void;
}): Promise<string> {
  const found = findSearchMatch(params.cleanText);
  if (!found) return params.cleanText;

  const query = found.query;
  const cleanText = params.cleanText.replace(found.raw, '').trim();

  const intentId = emitToolIntent('SEARCH', query, { query }, { publish: params.publish, makeId: params.makeId, priority: 0.8 });

  let op = searchInFlight.get(query.toLowerCase()) as any;
  if (!op) {
    params.deps.addMessage('assistant', `Invoking SEARCH for: "${query}"`, 'action');
    params.deps.setCurrentThought(`Researching: ${query}...`);
    op = startSearchOp({
      query,
      intentId,
      deps: params.deps,
      makeId: params.makeId,
      publish: params.publish,
      timeoutMs: params.timeoutMs
    });
  } else {
    op.intentIds.add(intentId);
  }

  scheduleSoftTimeout({
    op,
    intentId,
    tool: 'SEARCH',
    payload: { query },
    timeoutMs: params.timeoutMs,
    makeId: params.makeId,
    publish: params.publish
  });

  return cleanText;
}
