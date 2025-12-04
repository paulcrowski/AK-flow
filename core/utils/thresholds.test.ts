/**
 * thresholds.test.ts - Unit tests for dynamic threshold calculations
 * 
 * Tests the shared threshold logic used across EventLoop and useCognitiveKernel.
 */

import { describe, it, expect } from 'vitest';
import { 
  computeDialogThreshold, 
  isUserSilent, 
  DIALOG_THRESHOLDS 
} from './thresholds';
import { NeurotransmitterState, LimbicState } from '../../types';

// Default test fixtures
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
    it('should return base threshold for neutral state', () => {
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
      expect(threshold).toBe(DIALOG_THRESHOLDS.BASE_MS); // 60000
    });

    it('should increase threshold with high dopamine', () => {
      const highDopamineNeuro: NeurotransmitterState = {
        ...defaultNeuro,
        dopamine: 100
      };
      
      const threshold = computeDialogThreshold(highDopamineNeuro, defaultLimbic);
      expect(threshold).toBeGreaterThan(DIALOG_THRESHOLDS.BASE_MS);
    });

    it('should increase threshold with high satisfaction', () => {
      const highSatisfactionLimbic: LimbicState = {
        ...defaultLimbic,
        satisfaction: 1.0
      };
      
      const threshold = computeDialogThreshold(defaultNeuro, highSatisfactionLimbic);
      expect(threshold).toBeGreaterThan(DIALOG_THRESHOLDS.BASE_MS);
    });

    it('should clamp to MIN_DIALOG_MS', () => {
      // Even with very low values, should not go below minimum
      const lowNeuro: NeurotransmitterState = {
        dopamine: 0,
        serotonin: 0,
        norepinephrine: 0
      };
      const lowLimbic: LimbicState = {
        fear: 0,
        curiosity: 0,
        frustration: 0,
        satisfaction: 0
      };
      
      const threshold = computeDialogThreshold(lowNeuro, lowLimbic);
      expect(threshold).toBeGreaterThanOrEqual(DIALOG_THRESHOLDS.MIN_MS);
    });

    it('should clamp to MAX_DIALOG_MS', () => {
      // With very high values, should not exceed maximum
      const highNeuro: NeurotransmitterState = {
        dopamine: 100,
        serotonin: 100,
        norepinephrine: 100
      };
      const highLimbic: LimbicState = {
        fear: 0,
        curiosity: 1,
        frustration: 0,
        satisfaction: 1
      };
      
      const threshold = computeDialogThreshold(highNeuro, highLimbic);
      expect(threshold).toBeLessThanOrEqual(DIALOG_THRESHOLDS.MAX_MS);
    });
  });

  describe('isUserSilent', () => {
    it('should return false when user just interacted', () => {
      const now = Date.now();
      const lastInteraction = now - 1000; // 1 second ago
      
      const result = isUserSilent(lastInteraction, defaultNeuro, defaultLimbic, now);
      expect(result).toBe(false);
    });

    it('should return true when user has been silent for a long time', () => {
      const now = Date.now();
      const lastInteraction = now - 300_000; // 5 minutes ago
      
      const result = isUserSilent(lastInteraction, defaultNeuro, defaultLimbic, now);
      expect(result).toBe(true);
    });

    it('should consider dynamic threshold based on state', () => {
      const now = Date.now();
      const lastInteraction = now - 90_000; // 90 seconds ago
      
      // With low dopamine/satisfaction, threshold is lower, so user is "silent"
      const lowNeuro: NeurotransmitterState = { dopamine: 0, serotonin: 50, norepinephrine: 50 };
      const lowLimbic: LimbicState = { fear: 0, curiosity: 0, frustration: 0, satisfaction: 0 };
      
      const resultLow = isUserSilent(lastInteraction, lowNeuro, lowLimbic, now);
      expect(resultLow).toBe(true); // 90s > 60s threshold
      
      // With high dopamine/satisfaction, threshold is higher, so user is NOT "silent"
      const highNeuro: NeurotransmitterState = { dopamine: 100, serotonin: 50, norepinephrine: 50 };
      const highLimbic: LimbicState = { fear: 0, curiosity: 0, frustration: 0, satisfaction: 1 };
      
      const resultHigh = isUserSilent(lastInteraction, highNeuro, highLimbic, now);
      expect(resultHigh).toBe(false); // 90s < ~108s threshold
    });
  });
});
