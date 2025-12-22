/**
 * ChemistryBridge Tests
 * 
 * PRISM ARCHITECTURE (13/10) - Phase 4
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  calculateChemistryDelta,
  applyChemistryDelta,
  processEvaluationSignals,
  enableChemistryBridge,
  disableChemistryBridge,
  isChemistryBridgeEnabled,
  getChemistryBridgeStats
} from '@core/systems/ChemistryBridge';
import { evaluationBus, createEvaluationEvent } from '@core/systems/EvaluationBus';
import { NeurotransmitterState } from '@/types';
import { SYSTEM_CONFIG } from '@core/config/systemConfig';

describe('ChemistryBridge', () => {
  beforeEach(() => {
    evaluationBus.clear();
    disableChemistryBridge(); // Start disabled
  });

  afterEach(() => {
    disableChemistryBridge(); // Restore default
  });

  describe('Feature Flag', () => {
    it('starts disabled', () => {
      expect(isChemistryBridgeEnabled()).toBe(false);
    });

    it('can be enabled', () => {
      enableChemistryBridge();
      expect(isChemistryBridgeEnabled()).toBe(true);
    });

    it('can be disabled', () => {
      enableChemistryBridge();
      disableChemistryBridge();
      expect(isChemistryBridgeEnabled()).toBe(false);
    });
  });

  describe('calculateChemistryDelta', () => {
    it('returns zero when disabled', () => {
      evaluationBus.emit(createEvaluationEvent(
        'GOAL', 'USER', 0.8, 'positive', ['goal_success'], 0.9
      ));

      const delta = calculateChemistryDelta();

      expect(delta.dopamine).toBe(0);
      expect(delta.source).toBe('disabled');
    });

    it('returns zero when no events', () => {
      enableChemistryBridge();

      const delta = calculateChemistryDelta();

      expect(delta.dopamine).toBe(0);
      expect(delta.source).toBe('no_events');
    });

    it('returns positive delta for positive events', () => {
      enableChemistryBridge();
      evaluationBus.emit(createEvaluationEvent(
        'GOAL', 'USER', 0.8, 'positive', ['goal_success'], 0.9
      ));

      const delta = calculateChemistryDelta();

      expect(delta.dopamine).toBeGreaterThan(0);
      expect(delta.confidence).toBeGreaterThan(0);
    });

    it('returns negative delta for negative events', () => {
      enableChemistryBridge();
      evaluationBus.emit(createEvaluationEvent(
        'GUARD', 'PRISM', 0.8, 'negative', ['fact_mutation'], 1.0
      ));

      const delta = calculateChemistryDelta();

      expect(delta.dopamine).toBeLessThan(0);
    });

    it('respects MAX_DOPAMINE_DELTA', () => {
      enableChemistryBridge();
      // Emit many high-severity events
      for (let i = 0; i < 10; i++) {
        evaluationBus.emit(createEvaluationEvent(
          'GOAL', 'USER', 1.0, 'positive', ['goal_success'], 1.0
        ));
      }

      const delta = calculateChemistryDelta();

      expect(Math.abs(delta.dopamine)).toBeLessThanOrEqual(
        SYSTEM_CONFIG.chemistryBridge.maxDopamineDelta
      );
    });

    it('serotonin moves slower than dopamine', () => {
      enableChemistryBridge();
      evaluationBus.emit(createEvaluationEvent(
        'GOAL', 'USER', 0.8, 'positive', ['goal_success'], 0.9
      ));

      const delta = calculateChemistryDelta();

      expect(Math.abs(delta.serotonin)).toBeLessThan(Math.abs(delta.dopamine));
    });

    it('norepinephrine increases on negative events', () => {
      enableChemistryBridge();
      evaluationBus.emit(createEvaluationEvent(
        'GUARD', 'PRISM', 0.8, 'negative', ['fact_mutation'], 1.0
      ));

      const delta = calculateChemistryDelta();

      expect(delta.norepinephrine).toBeGreaterThanOrEqual(0);
    });
  });

  describe('applyChemistryDelta', () => {
    it('applies positive delta', () => {
      const current: NeurotransmitterState = {
        dopamine: 50,
        serotonin: 50,
        norepinephrine: 50
      };

      const delta = {
        dopamine: 5,
        serotonin: 2,
        norepinephrine: 1,
        confidence: 0.9,
        source: 'test'
      };

      const result = applyChemistryDelta(current, delta);

      expect(result.dopamine).toBe(55);
      expect(result.serotonin).toBe(52);
      expect(result.norepinephrine).toBe(51);
    });

    it('applies negative delta', () => {
      const current: NeurotransmitterState = {
        dopamine: 50,
        serotonin: 50,
        norepinephrine: 50
      };

      const delta = {
        dopamine: -10,
        serotonin: -3,
        norepinephrine: 0,
        confidence: 0.9,
        source: 'test'
      };

      const result = applyChemistryDelta(current, delta);

      expect(result.dopamine).toBe(40);
      expect(result.serotonin).toBe(47);
    });

    it('clamps to 0-100 range', () => {
      const current: NeurotransmitterState = {
        dopamine: 95,
        serotonin: 5,
        norepinephrine: 50
      };

      const delta = {
        dopamine: 20,  // Would exceed 100
        serotonin: -10, // Would go below 0
        norepinephrine: 0,
        confidence: 0.9,
        source: 'test'
      };

      const result = applyChemistryDelta(current, delta);

      expect(result.dopamine).toBe(100);
      expect(result.serotonin).toBe(0);
    });

    it('does not mutate input', () => {
      const current: NeurotransmitterState = {
        dopamine: 50,
        serotonin: 50,
        norepinephrine: 50
      };

      const delta = {
        dopamine: 10,
        serotonin: 5,
        norepinephrine: 2,
        confidence: 0.9,
        source: 'test'
      };

      applyChemistryDelta(current, delta);

      expect(current.dopamine).toBe(50); // Unchanged
    });
  });

  describe('processEvaluationSignals', () => {
    it('combines calculate and apply', () => {
      enableChemistryBridge();
      evaluationBus.emit(createEvaluationEvent(
        'GOAL', 'USER', 0.5, 'positive', ['goal_success'], 0.8
      ));

      const current: NeurotransmitterState = {
        dopamine: 50,
        serotonin: 50,
        norepinephrine: 50
      };

      const { newState, delta } = processEvaluationSignals(current);

      expect(delta.dopamine).toBeGreaterThan(0);
      expect(newState.dopamine).toBeGreaterThan(50);
    });
  });

  describe('getChemistryBridgeStats', () => {
    it('returns stats', () => {
      enableChemistryBridge();
      evaluationBus.emit(createEvaluationEvent(
        'GOAL', 'USER', 0.5, 'positive', ['goal_success'], 0.8
      ));

      const stats = getChemistryBridgeStats();

      expect(stats.enabled).toBe(true);
      expect(stats.totalEvents).toBe(1);
      expect(stats.positiveEvents).toBe(1);
    });
  });

  describe('Stage-Aware Weights', () => {
    it('TOOL errors have minimal impact', () => {
      enableChemistryBridge();
      evaluationBus.emit(createEvaluationEvent(
        'PARSER', 'TOOL', 0.8, 'negative', ['parse_error'], 1.0
      ));
      const toolDelta = calculateChemistryDelta();

      evaluationBus.clear();

      evaluationBus.emit(createEvaluationEvent(
        'GUARD', 'PRISM', 0.8, 'negative', ['fact_mutation'], 1.0
      ));
      const prismDelta = calculateChemistryDelta();

      // PRISM (0.10) should have more impact than TOOL (0.02)
      expect(Math.abs(prismDelta.dopamine)).toBeGreaterThan(Math.abs(toolDelta.dopamine));
    });

    it('USER events have highest impact', () => {
      enableChemistryBridge();
      evaluationBus.emit(createEvaluationEvent(
        'USER', 'USER', 0.8, 'negative', ['goal_failure'], 1.0
      ));
      const userDelta = calculateChemistryDelta();

      evaluationBus.clear();

      evaluationBus.emit(createEvaluationEvent(
        'GUARD', 'GUARD', 0.8, 'negative', ['persona_drift'], 1.0
      ));
      const guardDelta = calculateChemistryDelta();

      // USER (0.15) should have more impact than GUARD (0.05)
      expect(Math.abs(userDelta.dopamine)).toBeGreaterThan(Math.abs(guardDelta.dopamine));
    });
  });
});
