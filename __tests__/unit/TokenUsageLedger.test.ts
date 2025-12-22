import { describe, it, expect, beforeEach } from 'vitest';
import { TokenUsageLedger } from '@core/telemetry/TokenUsageLedger';

describe('TokenUsageLedger', () => {
  beforeEach(() => {
    TokenUsageLedger.reset();
  });

  it('should accumulate totals and per-op aggregates', () => {
    TokenUsageLedger.record({ agentId: 'a1', op: 'op1', inTokens: 10, outTokens: 5, totalTokens: 15, at: 1 });
    TokenUsageLedger.record({ agentId: 'a1', op: 'op1', inTokens: 2, outTokens: 3, totalTokens: 5, at: 2 });
    TokenUsageLedger.record({ agentId: 'a1', op: 'op2', inTokens: 1, outTokens: 1, totalTokens: 2, at: 3 });

    const snap = TokenUsageLedger.snapshot();
    expect(snap.totals.totalTokens).toBe(22);
    expect(snap.byOp.op1.totalTokens).toBe(20);
    expect(snap.byOp.op2.totalTokens).toBe(2);
    expect(snap.recent.length).toBe(3);
  });

  it('should clamp invalid values to 0', () => {
    TokenUsageLedger.record({ agentId: null, op: 'x', inTokens: -1, outTokens: 'nope', totalTokens: NaN });
    const snap = TokenUsageLedger.snapshot();
    expect(snap.totals.inTokens).toBe(0);
    expect(snap.totals.outTokens).toBe(0);
    expect(snap.totals.totalTokens).toBe(0);
  });
});
