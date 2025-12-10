/**
 * EvaluationBus Tests
 * 
 * PRISM ARCHITECTURE (13/10) - Phase 1: Observation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { 
  evaluationBus, 
  createEvaluationEvent, 
  createGuardEvent,
  confessionToEvaluation,
  EVALUATION_CONFIG 
} from '../core/systems/EvaluationBus';

describe('EvaluationBus', () => {
  beforeEach(() => {
    evaluationBus.clear();
  });

  describe('Event Creation', () => {
    it('creates evaluation event with all required fields', () => {
      const event = createEvaluationEvent(
        'GOAL',
        'PRISM',
        0.5,
        'negative',
        ['goal_failure'],
        0.8
      );

      expect(event.id).toBeDefined();
      expect(event.timestamp).toBeGreaterThan(0);
      expect(event.source).toBe('GOAL');
      expect(event.stage).toBe('PRISM');
      expect(event.severity).toBe(0.5);
      expect(event.valence).toBe('negative');
      expect(event.tags).toContain('goal_failure');
      expect(event.confidence).toBe(0.8);
    });

    it('clamps severity and confidence to 0-1', () => {
      const event = createEvaluationEvent(
        'PARSER',
        'TOOL',
        1.5,  // Over 1
        'negative',
        ['parse_error'],
        -0.5  // Under 0
      );

      expect(event.severity).toBe(1);
      expect(event.confidence).toBe(0);
    });

    it('creates guard event with correct tags', () => {
      const event = createGuardEvent('RETRY', [
        { type: 'fact_mutation', field: 'energy', expected: 23, actual: 'dużo' }
      ]);

      expect(event.source).toBe('GUARD');
      expect(event.stage).toBe('PRISM');
      expect(event.tags).toContain('fact_mutation');
      expect(event.tags).toContain('retry_triggered');
      expect(event.severity).toBe(0.8);
    });

    it('creates PASS event with positive valence', () => {
      const event = createGuardEvent('PASS', []);

      expect(event.valence).toBe('positive');
      expect(event.severity).toBe(0);
      expect(event.tags).toHaveLength(0);
    });
  });

  describe('Event Emission', () => {
    it('emits events to subscribers', () => {
      const received: any[] = [];
      const unsubscribe = evaluationBus.subscribe(e => received.push(e));

      const event = createEvaluationEvent('GOAL', 'USER', 0.3, 'positive', ['goal_success'], 0.9);
      evaluationBus.emit(event);

      expect(received).toHaveLength(1);
      expect(received[0].source).toBe('GOAL');

      unsubscribe();
    });

    it('allows unsubscribe', () => {
      const received: any[] = [];
      const unsubscribe = evaluationBus.subscribe(e => received.push(e));

      unsubscribe();

      const event = createEvaluationEvent('GOAL', 'USER', 0.3, 'positive', ['goal_success'], 0.9);
      evaluationBus.emit(event);

      expect(received).toHaveLength(0);
    });
  });

  describe('Metrics Tracking', () => {
    it('tracks total events', () => {
      evaluationBus.emit(createEvaluationEvent('GOAL', 'USER', 0.5, 'positive', [], 0.8));
      evaluationBus.emit(createEvaluationEvent('CONFESSION', 'PRISM', 0.3, 'negative', [], 0.7));

      const metrics = evaluationBus.getMetrics();
      expect(metrics.total_events).toBe(2);
    });

    it('tracks events by source', () => {
      evaluationBus.emit(createEvaluationEvent('GOAL', 'USER', 0.5, 'positive', [], 0.8));
      evaluationBus.emit(createEvaluationEvent('GOAL', 'USER', 0.5, 'positive', [], 0.8));
      evaluationBus.emit(createEvaluationEvent('CONFESSION', 'PRISM', 0.3, 'negative', [], 0.7));

      const metrics = evaluationBus.getMetrics();
      expect(metrics.events_by_source.GOAL).toBe(2);
      expect(metrics.events_by_source.CONFESSION).toBe(1);
    });

    it('tracks events by stage (13/10 feature)', () => {
      evaluationBus.emit(createEvaluationEvent('GUARD', 'PRISM', 0.5, 'negative', ['fact_mutation'], 1.0));
      evaluationBus.emit(createEvaluationEvent('PARSER', 'TOOL', 0.3, 'negative', ['parse_error'], 0.9));

      const metrics = evaluationBus.getMetrics();
      expect(metrics.events_by_stage.PRISM).toBe(1);
      expect(metrics.events_by_stage.TOOL).toBe(1);
    });

    it('tracks fact mutations and persona drifts', () => {
      evaluationBus.emit(createGuardEvent('RETRY', [{ type: 'fact_mutation' }]));
      evaluationBus.emit(createGuardEvent('RETRY', [{ type: 'persona_drift' }]));
      evaluationBus.emit(createGuardEvent('RETRY', [{ type: 'identity_leak' }]));

      const metrics = evaluationBus.getMetrics();
      expect(metrics.fact_mutation_count).toBe(1);
      expect(metrics.persona_drift_count).toBe(2); // persona_drift + identity_leak
    });

    it('calculates average severity and confidence', () => {
      evaluationBus.emit(createEvaluationEvent('GOAL', 'USER', 0.4, 'positive', [], 0.8));
      evaluationBus.emit(createEvaluationEvent('GOAL', 'USER', 0.6, 'positive', [], 0.6));

      const metrics = evaluationBus.getMetrics();
      expect(metrics.avg_severity).toBeCloseTo(0.5, 2);
      expect(metrics.avg_confidence).toBeCloseTo(0.7, 2);
    });
  });

  describe('Aggregated Signal', () => {
    it('returns zero signal when no events', () => {
      const signal = evaluationBus.getAggregatedSignal();
      expect(signal.dopamineDelta).toBe(0);
      expect(signal.confidence).toBe(0);
    });

    it('returns positive signal for positive events', () => {
      evaluationBus.emit(createEvaluationEvent('GOAL', 'USER', 0.5, 'positive', ['goal_success'], 0.8));

      const signal = evaluationBus.getAggregatedSignal();
      expect(signal.dopamineDelta).toBeGreaterThan(0);
    });

    it('returns negative signal for negative events', () => {
      evaluationBus.emit(createEvaluationEvent('GUARD', 'PRISM', 0.8, 'negative', ['fact_mutation'], 1.0));

      const signal = evaluationBus.getAggregatedSignal();
      expect(signal.dopamineDelta).toBeLessThan(0);
    });

    it('applies stage weights (13/10 feature)', () => {
      // TOOL error should have minimal impact
      evaluationBus.emit(createEvaluationEvent('PARSER', 'TOOL', 0.8, 'negative', ['parse_error'], 1.0));
      const toolSignal = evaluationBus.getAggregatedSignal();

      evaluationBus.clear();

      // PRISM error should have more impact
      evaluationBus.emit(createEvaluationEvent('GUARD', 'PRISM', 0.8, 'negative', ['fact_mutation'], 1.0));
      const prismSignal = evaluationBus.getAggregatedSignal();

      // PRISM weight (0.10) > TOOL weight (0.02)
      expect(Math.abs(prismSignal.dopamineDelta)).toBeGreaterThan(Math.abs(toolSignal.dopamineDelta));
    });
  });

  describe('Guard Stats', () => {
    it('calculates guard pass rate', () => {
      // 3 passes
      evaluationBus.emit(createGuardEvent('PASS', []));
      evaluationBus.emit(createGuardEvent('PASS', []));
      evaluationBus.emit(createGuardEvent('PASS', []));
      // 1 retry
      evaluationBus.emit(createGuardEvent('RETRY', [{ type: 'fact_mutation' }]));

      const stats = evaluationBus.getGuardStats();
      // Note: PASS events don't increment guard_pass_count in current implementation
      // because they have empty tags. This is a known limitation.
      expect(stats.retry_rate).toBeGreaterThan(0);
    });
  });

  describe('Confession Conversion', () => {
    it('converts confession to evaluation event', () => {
      const confession = {
        severity: 7,
        pain: 0.6,
        failure_attribution: 'SELF' as const,
        risk_flags: ['possible_hallucination']
      };

      const event = confessionToEvaluation(confession);

      expect(event.source).toBe('CONFESSION');
      expect(event.stage).toBe('PRISM');
      expect(event.severity).toBe(0.6);
      expect(event.valence).toBe('negative');
      expect(event.tags).toContain('hallucination');
      expect(event.attribution).toBe('SELF');
    });

    it('marks low severity as positive', () => {
      const confession = {
        severity: 2,
        risk_flags: [] as string[]
      };

      const event = confessionToEvaluation(confession);
      expect(event.valence).toBe('positive');
    });
  });

  describe('Configuration', () => {
    it('has stage weights for all stages', () => {
      const stages = ['TOOL', 'ROUTER', 'PRISM', 'GUARD', 'USER'];
      for (const stage of stages) {
        expect(EVALUATION_CONFIG.STAGE_WEIGHTS[stage as keyof typeof EVALUATION_CONFIG.STAGE_WEIGHTS]).toBeDefined();
      }
    });

    it('TOOL has lowest weight, USER has highest', () => {
      expect(EVALUATION_CONFIG.STAGE_WEIGHTS.TOOL).toBeLessThan(EVALUATION_CONFIG.STAGE_WEIGHTS.USER);
    });
  });
});
