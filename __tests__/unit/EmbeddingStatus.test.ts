import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createCortexTextService } from '@llm/gemini/CortexTextService';
import { eventBus } from '@core/EventBus';
import { PacketType } from '@/types';

describe('Embedding status telemetry', () => {
  beforeEach(() => {
    eventBus.clear();
  });

  it('emits EMBEDDINGS_STATUS on provider error', async () => {
    const ai = {
      models: {
        embedContent: vi.fn().mockRejectedValue(new Error('safety blocked'))
      }
    } as any;

    const service = createCortexTextService(ai);
    const result = await service.generateEmbedding('hello');

    expect(result).toBeNull();

    const statusEvents = eventBus
      .getHistory()
      .filter((p) => p.type === PacketType.SYSTEM_ALERT && p.payload?.event === 'EMBEDDINGS_STATUS');

    expect(statusEvents.length).toBeGreaterThan(0);
    const payload = statusEvents[statusEvents.length - 1].payload as any;
    console.log('[EMBEDDINGS_STATUS]', payload);
    expect(payload.cooldownActive).toBe(true);
    expect(payload.failCount).toBeGreaterThan(0);
  });
});
