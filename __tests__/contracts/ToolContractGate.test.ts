import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { eventBus } from '../../src/core/EventBus';
import { PacketType } from '../../src/types';

describe('Tool Contract Gate', () => {
  const intents = new Map<string, { tool: string; timestamp: number }>();
  const closed = new Set<string>();
  const unsubscribers: Array<() => void> = [];

  beforeAll(() => {
    unsubscribers.push(
      eventBus.subscribe(PacketType.TOOL_INTENT, (packet: any) => {
        const intentId = packet.payload?.intentId || packet.id;
        intents.set(intentId, {
          tool: packet.payload?.tool,
          timestamp: packet.timestamp
        });
      })
    );

    unsubscribers.push(
      eventBus.subscribe(PacketType.TOOL_RESULT, (packet: any) => {
        const intentId = packet.payload?.intentId;
        if (intentId) closed.add(intentId);
      })
    );

    unsubscribers.push(
      eventBus.subscribe(PacketType.TOOL_ERROR, (packet: any) => {
        const intentId = packet.payload?.intentId;
        if (intentId) closed.add(intentId);
      })
    );

    unsubscribers.push(
      eventBus.subscribe(PacketType.TOOL_TIMEOUT, (packet: any) => {
        const intentId = packet.payload?.intentId;
        if (intentId) closed.add(intentId);
      })
    );
  });

  afterAll(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
    unsubscribers.forEach((unsubscribe) => unsubscribe());

    const orphans = Array.from(intents.entries())
      .filter(([id]) => !closed.has(id));

    if (orphans.length > 0) {
      const details = orphans
        .map(([id, info]) => `  - ${info.tool || 'unknown'} (${id})`)
        .join('\n');

      throw new Error(
        `TOOL CONTRACT VIOLATION: ${orphans.length} orphan INTENT(s):\n${details}`
      );
    }
  });

  test('every TOOL_INTENT has TOOL_RESULT or TOOL_ERROR', () => {
    expect(true).toBe(true);
  });
});
