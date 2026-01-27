import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { eventBus } from '@core/EventBus';
import { AgentType, PacketType, type CognitivePacket } from '@/types';
import { EVENTS } from '@core/telemetry/events';
import { findUnsettledToolIntents, scheduleToolIntentSettlementCheck } from '@core/systems/eventloop/ToolIntentSettlement';

describe('ToolIntentSettlement', () => {
  beforeEach(() => {
    eventBus.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('finds unsettled intents for a trace', () => {
    const traceId = 'trace-1';
    const events: CognitivePacket[] = [
      {
        id: 'intent-1',
        traceId,
        timestamp: Date.now(),
        source: AgentType.CORTEX_FLOW,
        type: PacketType.TOOL_INTENT,
        payload: { tool: 'READ_FILE', intentId: 'intent-1', arg: 'x' },
        priority: 0.8
      },
      {
        id: 'result-2',
        traceId,
        timestamp: Date.now(),
        source: AgentType.CORTEX_FLOW,
        type: PacketType.TOOL_RESULT,
        payload: { tool: 'LIST_DIR', intentId: 'intent-2' },
        priority: 0.7
      }
    ];

    const unsettled = findUnsettledToolIntents(events, traceId);
    expect(unsettled).toEqual([{ intentId: 'intent-1', tool: 'READ_FILE' }]);
  });

  it('emits TOOL_INTENT_UNSETTLED when settle window expires', () => {
    const traceId = 'trace-2';
    eventBus.publishSync({
      id: 'intent-1',
      traceId,
      timestamp: Date.now(),
      source: AgentType.CORTEX_FLOW,
      type: PacketType.TOOL_INTENT,
      payload: { tool: 'READ_FILE', intentId: 'intent-1', arg: 'x' },
      priority: 0.8
    });

    scheduleToolIntentSettlementCheck({ traceId, tickNumber: 5, settleWindowMs: 50 });

    vi.advanceTimersByTime(60);

    const alerts = eventBus.getHistory().filter(
      (event) => event.type === PacketType.SYSTEM_ALERT && event.payload?.event === EVENTS.TOOL_INTENT_UNSETTLED
    );

    expect(alerts).toHaveLength(1);
    expect(alerts[0].payload?.intentIds).toContain('intent-1');
  });

  it('does not emit when intent is settled', () => {
    const traceId = 'trace-3';
    eventBus.publishSync({
      id: 'intent-1',
      traceId,
      timestamp: Date.now(),
      source: AgentType.CORTEX_FLOW,
      type: PacketType.TOOL_INTENT,
      payload: { tool: 'READ_FILE', intentId: 'intent-1', arg: 'x' },
      priority: 0.8
    });
    eventBus.publishSync({
      id: 'result-1',
      traceId,
      timestamp: Date.now(),
      source: AgentType.CORTEX_FLOW,
      type: PacketType.TOOL_RESULT,
      payload: { tool: 'READ_FILE', intentId: 'intent-1' },
      priority: 0.7
    });

    scheduleToolIntentSettlementCheck({ traceId, tickNumber: 1, settleWindowMs: 30 });

    vi.advanceTimersByTime(40);

    const alerts = eventBus.getHistory().filter(
      (event) => event.type === PacketType.SYSTEM_ALERT && event.payload?.event === EVENTS.TOOL_INTENT_UNSETTLED
    );
    expect(alerts).toHaveLength(0);
  });
});
