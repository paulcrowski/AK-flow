import { describe, it, expect } from 'vitest';
import { normalizeTokenUsagePayload } from '@core/telemetry/tokenUsage';

describe('Token usage normalization', () => {
  it('maps promptTokens/outputTokens/totalTokens to canonical fields', () => {
    const payload = { promptTokens: 12, outputTokens: 34, totalTokens: 46 };
    const normalized = normalizeTokenUsagePayload(payload, { traceId: 'trace-1' });

    expect(normalized.tokens_in).toBe(12);
    expect(normalized.tokens_out).toBe(34);
    expect(normalized.tokens_total).toBe(46);
  });

  it('preserves in/out/total values', () => {
    const payload = { in: 5, out: 6, total: 11 };
    const normalized = normalizeTokenUsagePayload(payload);

    expect(normalized.tokens_in).toBe(5);
    expect(normalized.tokens_out).toBe(6);
    expect(normalized.tokens_total).toBe(11);
  });
});
