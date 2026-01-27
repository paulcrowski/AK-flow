import { describe, it, expect, vi } from 'vitest';
import { applyTrajectoryUpdate } from '@core/systems/eventloop/trajectory';

describe('AgentTrajectory', () => {
  it('stamps tick number and updatedAt', () => {
    vi.useFakeTimers();
    const now = Date.now();
    vi.setSystemTime(now);

    const result = applyTrajectoryUpdate(null, { nextStep: 'observe' }, 4);

    expect(result.nextStep).toBe('observe');
    expect(result.tickNumber).toBe(4);
    expect(result.updatedAt).toBe(now);

    vi.useRealTimers();
  });

  it('keeps existing fields when patch is partial', () => {
    const base = applyTrajectoryUpdate(null, { nextStep: 'reactive', outcome: 'ready' }, 1, 1000);
    const updated = applyTrajectoryUpdate(base, { outcome: 'done' }, 2, 2000);

    expect(updated.nextStep).toBe('reactive');
    expect(updated.outcome).toBe('done');
    expect(updated.tickNumber).toBe(2);
    expect(updated.updatedAt).toBe(2000);
  });
});
