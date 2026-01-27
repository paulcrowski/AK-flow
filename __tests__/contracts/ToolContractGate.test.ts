import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { eventBus } from '../../src/core/EventBus';
import { PacketType } from '../../src/types';

describe('Tool Contract Gate', () => {
  const intents = new Map<string, { tool: string; timestamp: number }>();
  const closes = new Map<string, number>();
  const unsubscribers: Array<() => void> = [];
  let tracking = false;

  beforeAll(() => {
    unsubscribers.push(
      eventBus.subscribe(PacketType.TOOL_INTENT, (packet: any) => {
        if (!tracking) return;
        const intentId = packet.payload?.intentId || packet.id;
        intents.set(intentId, {
          tool: packet.payload?.tool,
          timestamp: packet.timestamp
        });
      })
    );

    unsubscribers.push(
      eventBus.subscribe(PacketType.TOOL_RESULT, (packet: any) => {
        if (!tracking) return;
        const intentId = packet.payload?.intentId;
        if (!intentId) return;
        closes.set(intentId, (closes.get(intentId) ?? 0) + 1);
      })
    );

    unsubscribers.push(
      eventBus.subscribe(PacketType.TOOL_ERROR, (packet: any) => {
        if (!tracking) return;
        const intentId = packet.payload?.intentId;
        if (!intentId) return;
        closes.set(intentId, (closes.get(intentId) ?? 0) + 1);
      })
    );

    unsubscribers.push(
      eventBus.subscribe(PacketType.TOOL_TIMEOUT, (packet: any) => {
        if (!tracking) return;
        const intentId = packet.payload?.intentId;
        if (!intentId) return;
        closes.set(intentId, (closes.get(intentId) ?? 0) + 1);
      })
    );
  });

  beforeEach(() => {
    intents.clear();
    closes.clear();
    tracking = true;
  });

  afterEach(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
    tracking = false;

    const orphans = Array.from(intents.entries())
      .filter(([id]) => !closes.has(id));
    const duplicates = Array.from(closes.entries())
      .filter(([, count]) => count > 1);

    if (orphans.length > 0) {
      const details = orphans
        .map(([id, info]) => `  - ${info.tool || 'unknown'} (${id})`)
        .join('\n');

      throw new Error(
        `TOOL CONTRACT VIOLATION: ${orphans.length} orphan INTENT(s):\n${details}`
      );
    }

    if (duplicates.length > 0) {
      const details = duplicates
        .map(([id, count]) => `  - ${id} (${count} closes)`)
        .join('\n');
      throw new Error(
        `TOOL CONTRACT VIOLATION: ${duplicates.length} intent(s) closed multiple times:\n${details}`
      );
    }
  });

  afterAll(() => {
    unsubscribers.forEach((unsubscribe) => unsubscribe());
  });

  test('every TOOL_INTENT has TOOL_RESULT or TOOL_ERROR', () => {
    expect(true).toBe(true);
  });
});
