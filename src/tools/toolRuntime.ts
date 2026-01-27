import { AgentType, PacketType } from '../types';

export type InFlightOp<T> = {
  promise: Promise<T>;
  startedAt: number;
  intentIds: Set<string>;
  timeoutEmitted: Set<string>;
  settled: boolean;
  primaryIntentId?: string;
  startedTraceId?: string;
  startedSessionId?: string;
};

export type ToolRuntimeState = {
  searchInFlight: Map<string, InFlightOp<any>>;
  visualInFlight: Map<string, InFlightOp<any>>;
};

export const createToolRuntimeState = (): ToolRuntimeState => ({
  searchInFlight: new Map(),
  visualInFlight: new Map()
});

export const withTimeout = <T>(promise: Promise<T>, ms: number, toolName: string): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`TOOL_TIMEOUT: ${toolName} exceeded ${ms}ms`)), ms)
    )
  ]);
};

export function scheduleSoftTimeout(params: {
  op: InFlightOp<any>;
  intentId: string;
  tool: 'SEARCH' | 'VISUALIZE';
  payload: any;
  timeoutMs: number;
  makeId: () => string;
  publish: (packet: any) => void;
}) {
  const { op, intentId, tool, payload, timeoutMs, makeId, publish } = params;

  const elapsed = Date.now() - op.startedAt;
  const remaining = timeoutMs - elapsed;

  const emit = () => {
    if (op.settled) return;
    if (!op.intentIds.has(intentId)) return;
    if (op.timeoutEmitted.has(intentId)) return;

    op.timeoutEmitted.add(intentId);
    publish({
      id: makeId(),
      timestamp: Date.now(),
      source: tool === 'SEARCH' ? AgentType.CORTEX_FLOW : AgentType.VISUAL_CORTEX,
      type: PacketType.TOOL_TIMEOUT,
      payload: {
        tool,
        intentId,
        ...payload,
        error: `TOOL_TIMEOUT: ${tool} exceeded ${timeoutMs}ms`
      },
      priority: 0.9
    });
  };

  if (remaining <= 0) {
    emit();
  } else {
    setTimeout(emit, remaining);
  }
}
