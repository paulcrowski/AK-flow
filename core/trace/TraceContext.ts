export interface TraceContext {
  traceId: string;
  tickNumber: number;
  startedAt: number;
  agentId: string | null;
}

export function generateTraceId(startedAt: number, tickNumber: number): string {
  return `tick-${startedAt}-${tickNumber}`;
}
