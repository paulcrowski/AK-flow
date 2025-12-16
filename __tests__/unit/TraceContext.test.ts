import { describe, it, expect } from 'vitest';
import { generateTraceId } from '../../core/trace/TraceContext';

describe('TraceContext', () => {
  it('should generate deterministic trace id from startedAt + tickNumber', () => {
    expect(generateTraceId(1700000000000, 1)).toBe('tick-1700000000000-1');
    expect(generateTraceId(1700000000000, 2)).toBe('tick-1700000000000-2');
  });
});
