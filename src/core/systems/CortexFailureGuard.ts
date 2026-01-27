import { AgentType, PacketType } from '../types';
import { eventBus } from '../EventBus';
import { generateUUID } from '../utils/uuid';
import { getCurrentTraceId } from '../trace/TraceContext';
import { EVENTS } from '../telemetry/events';

type GuardContext = {
  traceId?: string | null;
  onThought?: (message: string) => void;
};

type GuardResult<T> =
  | { ok: true; result: T }
  | { ok: false; error: string };

const toErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const publishFailure = (event: string, message: string, traceId?: string | null) => {
  eventBus.publish({
    id: generateUUID(),
    traceId: traceId ?? undefined,
    timestamp: Date.now(),
    source: AgentType.CORTEX_FLOW,
    type: PacketType.SYSTEM_ALERT,
    payload: { event, error: message },
    priority: 0.9
  });
};

export const guardReactive = async <T>(
  fn: () => Promise<T>,
  ctx: GuardContext
): Promise<GuardResult<T>> => {
  try {
    const result = await fn();
    return { ok: true, result };
  } catch (error) {
    const message = toErrorMessage(error);
    console.error(`[REACTIVE_STEP] Cortex failure: ${message}`);
    ctx.onThought?.(`[REACTIVE_ERROR] Przerwanie polaczenia z Cortex: ${message}`);
    publishFailure(EVENTS.CORTEX_REACTIVE_FAILURE, message, ctx.traceId ?? getCurrentTraceId());
    return { ok: false, error: message };
  }
};

export const guardAutonomy = async <T>(
  fn: () => Promise<T>,
  ctx: GuardContext
): Promise<GuardResult<T>> => {
  try {
    const result = await fn();
    return { ok: true, result };
  } catch (error) {
    const message = toErrorMessage(error);
    console.error(`[AUTONOMY_STEP] Cortex failure: ${message}`);
    ctx.onThought?.(`[AUTONOMY_ERROR] Przerwanie polaczenia z Cortex: ${message}`);
    publishFailure(EVENTS.CORTEX_AUTONOMY_FAILURE, message, ctx.traceId ?? getCurrentTraceId());
    return { ok: false, error: message };
  }
};
