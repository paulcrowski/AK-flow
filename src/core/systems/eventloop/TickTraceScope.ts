import type { TraceContext } from '../../trace/TraceContext';

export type TickTraceScopeDeps = {
  generateTraceId: (startedAt: number, tickNumber: number) => string;
  pushTraceId: (traceId: string) => void;
  popTraceId: (traceId: string) => void;
  publishTickStart: (traceId: string, tickNumber: number, startedAt: number) => void;
  publishTickEnd: (
    traceId: string,
    tickNumber: number,
    endedAt: number,
    durationMs: number,
    skipped: boolean,
    skipReason: string | null
  ) => void;
};

export type TickTraceScope = {
  trace: TraceContext;
  finalize: (input: { skipped: boolean; skipReason: string | null }) => void;
};

export function createTickTraceScope(input: {
  agentId: string | null;
  tickNumber: number;
  startedAt: number;
  /** True when this tick is responding to user input */
  isUserFacing?: boolean;
  deps: TickTraceScopeDeps;
}): TickTraceScope {
  const traceId = input.deps.generateTraceId(input.startedAt, input.tickNumber);

  const trace: TraceContext = {
    traceId,
    tickNumber: input.tickNumber,
    startedAt: input.startedAt,
    agentId: input.agentId,
    isUserFacing: input.isUserFacing ?? false
  };

  input.deps.pushTraceId(trace.traceId);
  input.deps.publishTickStart(trace.traceId, trace.tickNumber, trace.startedAt);

  function finalize(finalState: { skipped: boolean; skipReason: string | null }): void {
    const endedAt = Date.now();
    input.deps.publishTickEnd(
      trace.traceId,
      trace.tickNumber,
      endedAt,
      endedAt - trace.startedAt,
      finalState.skipped,
      finalState.skipReason
    );
    input.deps.popTraceId(trace.traceId);
  }

  return { trace, finalize };
}
