export interface TraceContext {
  traceId: string;
  tickNumber: number;
  startedAt: number;
  agentId: string | null;
}

export function generateTraceId(startedAt: number, tickNumber: number): string {
  return `tick-${startedAt}-${tickNumber}`;
}

let externalTraceCounter = 0;

export function generateExternalTraceId(timestamp: number = Date.now()): string {
  externalTraceCounter = (externalTraceCounter + 1) % 1000000;
  return `ext-${timestamp}-${externalTraceCounter}`;
}

const traceStack: string[] = [];

export function pushTraceId(traceId: string): void {
  traceStack.push(traceId);
}

export function popTraceId(traceId: string): void {
  if (traceStack.length === 0) return;

  const last = traceStack[traceStack.length - 1];
  if (last === traceId) {
    traceStack.pop();
    return;
  }

  const idx = traceStack.lastIndexOf(traceId);
  if (idx !== -1) traceStack.splice(idx, 1);
}

export function getCurrentTraceId(): string | null {
  if (traceStack.length === 0) return null;
  return traceStack[traceStack.length - 1] ?? null;
}
