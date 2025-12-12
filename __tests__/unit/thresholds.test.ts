/**
 * thresholds.test.ts - Unit tests for dynamic threshold calculations
 */
import { describe, it, expect } from 'vitest';
import {
    computeDialogThreshold,
    isUserSilent,
    DIALOG_THRESHOLDS
} from '../../core/utils/thresholds';
import { NeurotransmitterState, LimbicState } from '../../types';

const defaultNeuro: NeurotransmitterState = {
    dopamine: 50,
    serotonin: 60,
    norepinephrine: 50
};

const defaultLimbic: LimbicState = {
    fear: 0,
    curiosity: 0.5,
    frustration: 0,
    satisfaction: 0.5
};

describe('thresholds', () => {
    describe('computeDialogThreshold', () => {
        it('returns base threshold for neutral state', () => {
            const neutralNeuro: NeurotransmitterState = {
                dopamine: 0,
                serotonin: 50,
                norepinephrine: 50
            };
            const neutralLimbic: LimbicState = {
                fear: 0,
                curiosity: 0,
                frustration: 0,
                satisfaction: 0
            };

            const threshold = computeDialogThreshold(neutralNeuro, neutralLimbic);
            expect(threshold).toBe(DIALOG_THRESHOLDS.BASE_MS);
        });

        it('increases threshold with high dopamine', () => {
            const highDopamineNeuro: NeurotransmitterState = {
                ...defaultNeuro,
                dopamine: 100
            };

            const threshold = computeDialogThreshold(highDopamineNeuro, defaultLimbic);
            expect(threshold).toBeGreaterThan(DIALOG_THRESHOLDS.BASE_MS);
        });

        it('clamps to MIN_DIALOG_MS', () => {
            const lowNeuro: NeurotransmitterState = { dopamine: 0, serotonin: 0, norepinephrine: 0 };
            const lowLimbic: LimbicState = { fear: 0, curiosity: 0, frustration: 0, satisfaction: 0 };

            const threshold = computeDialogThreshold(lowNeuro, lowLimbic);
            expect(threshold).toBeGreaterThanOrEqual(DIALOG_THRESHOLDS.MIN_MS);
        });

        it('clamps to MAX_DIALOG_MS', () => {
            const highNeuro: NeurotransmitterState = { dopamine: 100, serotonin: 100, norepinephrine: 100 };
            const highLimbic: LimbicState = { fear: 0, curiosity: 1, frustration: 0, satisfaction: 1 };

            const threshold = computeDialogThreshold(highNeuro, highLimbic);
            expect(threshold).toBeLessThanOrEqual(DIALOG_THRESHOLDS.MAX_MS);
        });
    });

    describe('isUserSilent', () => {
        it('returns false when user just interacted', () => {
            const now = Date.now();
            const lastInteraction = now - 1000;

            const result = isUserSilent(lastInteraction, defaultNeuro, defaultLimbic, now);
            expect(result).toBe(false);
        });

        it('returns true when user has been silent for a long time', () => {
            const now = Date.now();
            const lastInteraction = now - 300_000;

            const result = isUserSilent(lastInteraction, defaultNeuro, defaultLimbic, now);
            expect(result).toBe(true);
        });
    });
});
