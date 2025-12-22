import { describe, it, expect, beforeEach } from 'vitest';
import { LimbicSystem } from '@core/systems/LimbicSystem';
import type { LimbicState } from '@/types';

describe('LimbicSystem.applyHomeostasis', () => {
    it('should decay values toward baselines', () => {
        const next = LimbicSystem.applyHomeostasis({
            fear: 1,
            curiosity: 1,
            satisfaction: 1,
            frustration: 1
        });

        expect(next.fear).toBeLessThan(1);
        expect(next.curiosity).toBeLessThan(1);
        expect(next.frustration).toBeLessThan(1);
        expect(next.satisfaction).toBeLessThan(1);
    });

    it('should clamp values within [0,1]', () => {
        const next = LimbicSystem.applyHomeostasis({
            fear: 10,
            curiosity: -5,
            satisfaction: 2,
            frustration: -1
        } as any);

        expect(next.fear).toBeGreaterThanOrEqual(0);
        expect(next.fear).toBeLessThanOrEqual(1);
        expect(next.curiosity).toBeGreaterThanOrEqual(0);
        expect(next.curiosity).toBeLessThanOrEqual(1);
        expect(next.satisfaction).toBeGreaterThanOrEqual(0);
        expect(next.satisfaction).toBeLessThanOrEqual(1);
        expect(next.frustration).toBeGreaterThanOrEqual(0);
        expect(next.frustration).toBeLessThanOrEqual(1);
    });
});
