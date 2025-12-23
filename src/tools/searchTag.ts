import { CortexService } from '../llm/gemini';
import { persistSearchKnowledgeChunk } from '../services/SearchKnowledgeChunker';
import { AgentType, PacketType } from '../types';
import { getCurrentTraceId } from '../core/trace/TraceContext';
import type { ToolParserDeps } from './toolParser';
import { searchInFlight, scheduleSoftTimeout } from './toolRuntime';

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

function publishSearchResult(params: {
  publish: (packet: any) => void;
  makeId: () => string;
  query: string;
  intentId: string;
  sourcesCount: number;
  synthesisLength: number;
  late: boolean;
}) {
  params.publish({
    id: params.makeId(),
    timestamp: Date.now(),
    source: AgentType.CORTEX_FLOW,
    type: PacketType.TOOL_RESULT,
    payload: {
      tool: 'SEARCH',
      query: params.query,
      intentId: params.intentId,
      sourcesCount: params.sourcesCount,
      synthesisLength: params.synthesisLength,
      late: params.late
    },
    priority: 0.8
  });
}

function publishSearchError(params: {
  publish: (packet: any) => void;
  makeId: () => string;
  query: string;
  intentId: string;
  error: string;
}) {
  params.publish({
    id: params.makeId(),
    timestamp: Date.now(),
    source: AgentType.CORTEX_FLOW,
    type: PacketType.TOOL_ERROR,
    payload: { tool: 'SEARCH', query: params.query, intentId: params.intentId, error: params.error },
    priority: 0.9
  });
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

  void promise
    .then((research) => {
      op.settled = true;

      if (!research || !research.synthesis) {
        for (const id of op.intentIds) {
          publishSearchError({
            publish: params.publish,
            makeId: params.makeId,
            query: params.query,
            intentId: id,
            error: 'Empty result'
          });
        }
        params.deps.addMessage('assistant', 'Mój moduł SEARCH jest teraz wyłączony.', 'thought');
        return;
      }

      for (const id of op.intentIds) {
        publishSearchResult({
          publish: params.publish,
          makeId: params.makeId,
          query: params.query,
          intentId: id,
          sourcesCount: research.sources?.length || 0,
          synthesisLength: research.synthesis.length,
          late: op.timeoutEmitted.has(id)
        });
      }

      if (op.timeoutEmitted.size > 0) {
        params.deps.addMessage(
          'assistant',
          `SEARCH wynik dotarł po TIMEOUT (dołączony). query="${params.query}"`,
          'thought'
        );
      }

      params.deps.addMessage('assistant', research.synthesis, 'intel', undefined, research.sources);

      void persistSearchKnowledgeChunk({
        query: params.query,
        synthesis: research.synthesis,
        sources: research.sources,
        traceId: op.startedTraceId,
        sessionId: op.startedSessionId,
        toolIntentId: op.primaryIntentId
      });
    })
    .catch((error: any) => {
      op.settled = true;

      console.warn('[ToolParser] Research failed:', error);

      for (const id of op.intentIds) {
        publishSearchError({
          publish: params.publish,
          makeId: params.makeId,
          query: params.query,
          intentId: id,
          error: error?.message || 'Unknown error'
        });
      }

      params.deps.addMessage('assistant', 'Mój moduł SEARCH jest teraz wyłączony.', 'thought');
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

  const intentId = params.makeId();
  params.publish({
    id: intentId,
    timestamp: Date.now(),
    source: AgentType.CORTEX_FLOW,
    type: PacketType.TOOL_INTENT,
    payload: { tool: 'SEARCH', query },
    priority: 0.8
  });

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
