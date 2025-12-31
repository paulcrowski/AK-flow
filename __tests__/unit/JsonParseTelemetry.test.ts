import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { cleanJSON } from '@llm/gemini/json';
import { eventBus } from '@core/EventBus';
import { PacketType } from '@/types';

describe('JSON parse telemetry', () => {
  const defaultVal = { ok: false };
  let originalEnv: string | undefined;

  beforeEach(() => {
    eventBus.clear();
    originalEnv = process.env.NODE_ENV;
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    eventBus.clear();
    vi.restoreAllMocks();
  });

  it('publishes JSON_PARSE_FAILURE and skips console.warn in production', () => {
    process.env.NODE_ENV = 'production';
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = cleanJSON('{bad}', defaultVal, undefined, 'unit-test');

    expect(result).toEqual(defaultVal);

    const event = eventBus
      .getHistory()
      .find((e) => e.type === PacketType.PREDICTION_ERROR && e.payload?.metric === 'JSON_PARSE_FAILURE');
    expect(event).toBeDefined();
    expect(event!.payload.callsite).toBe('unit-test');
    expect(warnSpy).not.toHaveBeenCalled();
  });
});
