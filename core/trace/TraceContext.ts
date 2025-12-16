export interface TraceContext {
  traceId: string;
  tickNumber: number;
  startedAt: number;
  agentId: string | null;
}

export function generateTraceId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 8);
  return `tick-${timestamp}-${random}`;
}
