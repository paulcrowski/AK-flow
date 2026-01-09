import { describe, it, expect } from 'vitest';
import { normalizeToolName, TOOL_COST } from '@core/systems/EventLoop';

describe('tool energy costs', () => {
  it('READ_FILE costs 3 energy', () => {
    const cost = TOOL_COST[normalizeToolName('READ_FILE')];
    expect(cost).toBe(3);
  });

  it('READ_FILE_CHUNK normalizes to READ_FILE', () => {
    expect(normalizeToolName('READ_FILE_CHUNK')).toBe('READ_FILE');
  });
});
