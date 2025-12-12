/**
 * MetaStateService Tests
 * 
 * Testy dla homeostazy i interpretacji meta-states.
 */

import { describe, it, expect } from 'vitest';
import {
  updateMetaStates,
  interpretMetaStates,
  createDefaultMetaStates,
  needsRest
} from '../../core/services/MetaStateService';
import type { MetaStates } from '../../core/types/MetaStates';

describe('MetaStateService', () => {
  describe('updateMetaStates', () => {
    it('should apply deltas with EMA smoothing', () => {
      const current: MetaStates = { energy: 50, confidence: 50, stress: 50 };
      const deltas = { energy_delta: 10, confidence_delta: 10, stress_delta: 10 };
      
      const result = updateMetaStates(current, deltas);
      
      // With EMA alpha 0.3, delta of 10 becomes 3
      // Then homeostasis pulls toward baseline
      expect(result.energy).toBeGreaterThan(50);
      expect(result.energy).toBeLessThan(60);
    });

    it('should clamp values to 0-100', () => {
      const current: MetaStates = { energy: 95, confidence: 5, stress: 95 };
      const deltas = { energy_delta: 20, confidence_delta: -20, stress_delta: 20 };
      
      const result = updateMetaStates(current, deltas);
      
      expect(result.energy).toBeLessThanOrEqual(100);
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.stress).toBeLessThanOrEqual(100);
    });

    it('should apply homeostasis toward baseline', () => {
      const current: MetaStates = { energy: 30, confidence: 90, stress: 80 };
      const deltas = {}; // No deltas, just homeostasis
      
      const result = updateMetaStates(current, deltas);
      
      // Energy should increase toward baseline (70)
      expect(result.energy).toBeGreaterThan(30);
      // Confidence should decrease toward baseline (60)
      expect(result.confidence).toBeLessThan(90);
      // Stress should decrease toward baseline (20)
      expect(result.stress).toBeLessThan(80);
    });

    it('should handle empty deltas', () => {
      const current: MetaStates = { energy: 70, confidence: 60, stress: 20 };
      const deltas = {};
      
      const result = updateMetaStates(current, deltas);
      
      // At baseline, should stay roughly the same
      expect(result.energy).toBeCloseTo(70, 0);
      expect(result.confidence).toBeCloseTo(60, 0);
      expect(result.stress).toBeCloseTo(20, 0);
    });
  });

  describe('interpretMetaStates', () => {
    it('should return rest mode when energy is low', () => {
      const states: MetaStates = { energy: 15, confidence: 50, stress: 30 };
      const result = interpretMetaStates(states);
      
      expect(result.mode).toBe('rest');
    });

    it('should return auditor mode when stress high and confidence low', () => {
      const states: MetaStates = { energy: 50, confidence: 30, stress: 70 };
      const result = interpretMetaStates(states);
      
      expect(result.mode).toBe('auditor');
    });

    it('should return creative mode when confidence high and stress low', () => {
      const states: MetaStates = { energy: 80, confidence: 80, stress: 20 };
      const result = interpretMetaStates(states);
      
      expect(result.mode).toBe('creative');
    });

    it('should return cautious mode for balanced states', () => {
      const states: MetaStates = { energy: 50, confidence: 50, stress: 50 };
      const result = interpretMetaStates(states);
      
      expect(result.mode).toBe('cautious');
    });
  });

  describe('createDefaultMetaStates', () => {
    it('should return baseline values', () => {
      const result = createDefaultMetaStates();
      
      expect(result.energy).toBe(70);
      expect(result.confidence).toBe(60);
      expect(result.stress).toBe(20);
    });
  });

  describe('needsRest', () => {
    it('should return true when energy is very low', () => {
      const states: MetaStates = { energy: 15, confidence: 50, stress: 30 };
      expect(needsRest(states)).toBe(true);
    });

    it('should return true when stress is very high', () => {
      const states: MetaStates = { energy: 50, confidence: 50, stress: 85 };
      expect(needsRest(states)).toBe(true);
    });

    it('should return false for normal states', () => {
      const states: MetaStates = { energy: 50, confidence: 50, stress: 50 };
      expect(needsRest(states)).toBe(false);
    });
  });
});
