import { describe, it, expect } from 'vitest';
import { SYSTEM_CONFIG } from '@core/config/systemConfig';
import { ExecutiveGate } from '@core/systems/ExecutiveGate';

describe('ExecutiveGate config wiring', () => {
  it('uses config for goal relevance weights and recency decay', () => {
    const now = Date.now();
    const candidate = {
      type: 'goal_driven' as const,
      timestamp: now,
      metadata: { novelty: 0, salience: 0 }
    };

    const original = (SYSTEM_CONFIG as any).executiveGate;
    try {
      (SYSTEM_CONFIG as any).executiveGate = {
        goalRelevanceWeights: { goalDriven: 1, autonomous: 0 },
        recencyDecayMs: 10_000
      };

      const strengthFull = ExecutiveGate.computeCandidateStrength(candidate, now);
      expect(strengthFull).toBeCloseTo(0.3, 5);

      (SYSTEM_CONFIG as any).executiveGate = {
        goalRelevanceWeights: { goalDriven: 0.5, autonomous: 0 },
        recencyDecayMs: 10_000
      };

      const strengthHalf = ExecutiveGate.computeCandidateStrength(candidate, now);
      expect(strengthHalf).toBeCloseTo(0.2, 5);
    } finally {
      (SYSTEM_CONFIG as any).executiveGate = original;
    }
  });
});
