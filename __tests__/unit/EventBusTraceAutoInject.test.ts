import { describe, it, expect, afterEach } from 'vitest';
import { eventBus } from '../../core/EventBus';
import { AgentType, PacketType, type CognitivePacket } from '../../types';
import { setFeatureFlagForTesting } from '../../core/config/featureFlags';
import { pushTraceId, popTraceId } from '../../core/trace/TraceContext';

describe('EventBus trace auto-inject', () => {
  afterEach(() => {
    try {
      popTraceId('test-trace');
    } catch {
      // ignore
    }
    eventBus.clear();
    setFeatureFlagForTesting('USE_TRACE_AUTO_INJECT', false);
  });

  it('should inject current traceId when enabled and packet has no traceId', () => {
    setFeatureFlagForTesting('USE_TRACE_AUTO_INJECT', true);
    pushTraceId('test-trace');

    let received: CognitivePacket | null = null;
    eventBus.subscribe(PacketType.SYSTEM_ALERT, (p) => {
      received = p;
    });

    eventBus.publishSync({
      id: 'p1',
      timestamp: 1,
      source: AgentType.CORTEX_FLOW,
      type: PacketType.SYSTEM_ALERT,
      payload: { event: 'X' },
      priority: 1
    });

    expect(received).not.toBeNull();
    expect(received!.traceId).toBe('test-trace');
  });

  it('should not override traceId if packet already has one', () => {
    setFeatureFlagForTesting('USE_TRACE_AUTO_INJECT', true);
    pushTraceId('test-trace');

    let received: CognitivePacket | null = null;
    eventBus.subscribe(PacketType.SYSTEM_ALERT, (p) => {
      received = p;
    });

    eventBus.publishSync({
      id: 'p2',
      traceId: 'explicit',
      timestamp: 1,
      source: AgentType.CORTEX_FLOW,
      type: PacketType.SYSTEM_ALERT,
      payload: { event: 'Y' },
      priority: 1
    });

    expect(received).not.toBeNull();
    expect(received!.traceId).toBe('explicit');
  });

  it('should not inject traceId when disabled', () => {
    setFeatureFlagForTesting('USE_TRACE_AUTO_INJECT', false);
    pushTraceId('test-trace');

    let received: CognitivePacket | null = null;
    eventBus.subscribe(PacketType.SYSTEM_ALERT, (p) => {
      received = p;
    });

    eventBus.publishSync({
      id: 'p3',
      timestamp: 1,
      source: AgentType.CORTEX_FLOW,
      type: PacketType.SYSTEM_ALERT,
      payload: { event: 'Z' },
      priority: 1
    });

    expect(received).not.toBeNull();
    expect(received!.traceId).toBeUndefined();
  });
});
