import { AgentType, PacketType, type CognitivePacket } from '../../../types';
import { eventBus } from '../../EventBus';
import { EVENTS } from '../../telemetry/events';
import { generateUUID } from '../../../utils/uuid';

export type UnsettledToolIntent = {
  intentId: string;
  tool?: string;
};

export const findUnsettledToolIntents = (
  events: CognitivePacket[],
  traceId: string
): UnsettledToolIntent[] => {
  if (!traceId) return [];

  const intents = new Map<string, string | undefined>();
  const settled = new Set<string>();

  for (const event of events) {
    if (event.traceId !== traceId) continue;

    if (event.type === PacketType.TOOL_INTENT) {
      const intentId = event.payload?.intentId as string | undefined;
      if (!intentId) continue;
      intents.set(intentId, event.payload?.tool as string | undefined);
      continue;
    }

    if (
      event.type === PacketType.TOOL_RESULT ||
      event.type === PacketType.TOOL_ERROR ||
      event.type === PacketType.TOOL_TIMEOUT
    ) {
      const intentId = event.payload?.intentId as string | undefined;
      if (!intentId) continue;
      settled.add(intentId);
    }
  }

  const unsettled: UnsettledToolIntent[] = [];
  for (const [intentId, tool] of intents.entries()) {
    if (!settled.has(intentId)) {
      unsettled.push({ intentId, tool });
    }
  }
  return unsettled;
};

export const scheduleToolIntentSettlementCheck = (params: {
  traceId: string;
  tickNumber: number;
  settleWindowMs: number;
}): void => {
  const { traceId, tickNumber } = params;
  if (!traceId) return;
  const settleWindowMs = Math.max(0, Math.floor(params.settleWindowMs || 0));

  setTimeout(() => {
    const unsettled = findUnsettledToolIntents(eventBus.getHistory(), traceId);
    if (unsettled.length === 0) return;

    eventBus.publish({
      id: generateUUID(),
      traceId,
      timestamp: Date.now(),
      source: AgentType.CORTEX_FLOW,
      type: PacketType.SYSTEM_ALERT,
      payload: {
        event: EVENTS.TOOL_INTENT_UNSETTLED,
        tickNumber,
        settleWindowMs,
        intentIds: unsettled.map((entry) => entry.intentId),
        tools: unsettled.map((entry) => entry.tool).filter(Boolean)
      },
      priority: 0.9
    });
  }, settleWindowMs);
};
