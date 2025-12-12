import { describe, it, expect } from 'vitest';
import { calculateMetabolicState } from '../../core/systems/SomaSystem';
import type { SomaState } from '../types';

const awakeFull: SomaState = {
    energy: 100,
    cognitiveLoad: 0,
    isSleeping: false
};

const sleepy: SomaState = {
    energy: 10,
    cognitiveLoad: 0,
    isSleeping: false
};

describe('SomaSystem.calculateMetabolicState', () => {
    it('should trigger sleep when energy below threshold', () => {
        const result = calculateMetabolicState(sleepy, 0);
        expect(result.shouldSleep).toBe(true);
        expect(result.newState.isSleeping).toBe(true);
    });

    it('should drain energy when awake', () => {
        const result = calculateMetabolicState(awakeFull, 1);
        expect(result.newState.energy).toBeLessThan(awakeFull.energy);
        expect(result.newState.isSleeping).toBe(false);
    });

    it('should regenerate energy during sleep', () => {
        const sleeping: SomaState = { energy: 90, cognitiveLoad: 0, isSleeping: true };
        const result = calculateMetabolicState(sleeping, 0);
        expect(result.newState.energy).toBeGreaterThanOrEqual(90);
    });
});
