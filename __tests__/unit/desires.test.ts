import { describe, it, expect } from 'vitest';
import { computeDesires } from '@core/systems/AutonomyRepertoire';

describe('computeDesires', () => {
  it('low energy increases rest', () => {
    const d = computeDesires(
      { energy: 20, cognitiveLoad: 50, isSleeping: false },
      { curiosity: 0.5, satisfaction: 0.5, frustration: 0.2, fear: 0.1 },
      { dopamine: 50, serotonin: 50, norepinephrine: 50 }
    );
    expect(d.rest).toBeGreaterThan(0.5);
  });

  it('high curiosity + low satisfaction increases explore', () => {
    const d = computeDesires(
      { energy: 80, cognitiveLoad: 20, isSleeping: false },
      { curiosity: 0.8, satisfaction: 0.2, frustration: 0.1, fear: 0.1 },
      { dopamine: 30, serotonin: 50, norepinephrine: 50 }
    );
    expect(d.explore).toBeGreaterThan(0.5);
  });

  it('desires are always 0-1', () => {
    const d = computeDesires(
      { energy: 100, cognitiveLoad: 0, isSleeping: false },
      { curiosity: 1, satisfaction: 0, frustration: 0, fear: 0 },
      { dopamine: 0, serotonin: 50, norepinephrine: 50 }
    );
    expect(d.explore).toBeGreaterThanOrEqual(0);
    expect(d.explore).toBeLessThanOrEqual(1);
    expect(d.resolve).toBeGreaterThanOrEqual(0);
    expect(d.resolve).toBeLessThanOrEqual(1);
    expect(d.create).toBeGreaterThanOrEqual(0);
    expect(d.create).toBeLessThanOrEqual(1);
    expect(d.rest).toBeGreaterThanOrEqual(0);
    expect(d.rest).toBeLessThanOrEqual(1);
  });
});
