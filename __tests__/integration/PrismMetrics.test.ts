/**
 * PrismMetrics Tests
 * 
 * PRISM ARCHITECTURE (13/10) - Phase 5
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  canApplyPenalty,
  recordPenalty,
  getRemainingPenaltyBudget,
  getDailyPenalties,
  calculateTrustIndex,
  logArchitectureIssue,
  getArchitectureIssues,
  clearArchitectureIssues,
  getPrismDashboard,
  resetDailyPenalties,
  METRICS_CONFIG
} from '@core/systems/PrismMetrics';
import { evaluationBus, createEvaluationEvent } from '@core/systems/EvaluationBus';

describe('PrismMetrics', () => {
  beforeEach(() => {
    evaluationBus.clear();
    clearArchitectureIssues();
    resetDailyPenalties();
  });

  describe('Daily Penalty Caps', () => {
    it('allows penalty within budget', () => {
      expect(canApplyPenalty('TOOL', 3)).toBe(true);
    });

    it('blocks penalty exceeding budget', () => {
      // TOOL max is 5
      recordPenalty('TOOL', 4);
      expect(canApplyPenalty('TOOL', 2)).toBe(false);
      expect(canApplyPenalty('TOOL', 1)).toBe(true);
    });

    it('tracks penalties per stage independently', () => {
      recordPenalty('TOOL', 5);
      recordPenalty('PRISM', 10);

      expect(getRemainingPenaltyBudget('TOOL')).toBe(0);
      expect(getRemainingPenaltyBudget('PRISM')).toBe(5); // Max is 15
      expect(getRemainingPenaltyBudget('USER')).toBe(20); // Untouched
    });

    it('returns all daily penalties', () => {
      recordPenalty('TOOL', 2);
      recordPenalty('GUARD', 5);

      const penalties = getDailyPenalties();

      expect(penalties.TOOL).toBe(2);
      expect(penalties.GUARD).toBe(5);
      expect(penalties.PRISM).toBe(0);
    });
  });

  describe('TrustIndex', () => {
    it('returns 1.0 when no events', () => {
      const result = calculateTrustIndex();

      expect(result.index).toBe(1.0);
      expect(result.totalEvents).toBe(0);
    });

    it('decreases with fact mutations', () => {
      evaluationBus.emit(createEvaluationEvent(
        'GUARD', 'PRISM', 0.8, 'negative', ['fact_mutation'], 1.0
      ));

      const result = calculateTrustIndex();

      expect(result.index).toBeLessThan(1.0);
      expect(result.factMutationRate).toBeGreaterThan(0);
    });

    it('decreases with identity leaks', () => {
      evaluationBus.emit(createEvaluationEvent(
        'GUARD', 'PRISM', 0.7, 'negative', ['identity_leak'], 1.0
      ));

      const result = calculateTrustIndex();

      expect(result.index).toBeLessThan(1.0);
      expect(result.identityLeakRate).toBeGreaterThan(0);
    });

    it('stays high with positive events', () => {
      for (let i = 0; i < 10; i++) {
        evaluationBus.emit(createEvaluationEvent(
          'GOAL', 'USER', 0.5, 'positive', ['goal_success'], 0.9
        ));
      }

      const result = calculateTrustIndex();

      expect(result.index).toBe(1.0); // No negative tags
    });

    it('clamps to 0-1 range', () => {
      // Emit many negative events
      for (let i = 0; i < 20; i++) {
        evaluationBus.emit(createEvaluationEvent(
          'GUARD', 'PRISM', 1.0, 'negative', ['fact_mutation', 'identity_leak'], 1.0
        ));
      }

      const result = calculateTrustIndex();

      expect(result.index).toBeGreaterThanOrEqual(0);
      expect(result.index).toBeLessThanOrEqual(1);
    });
  });

  describe('Architecture Issues', () => {
    it('logs architecture issue', () => {
      logArchitectureIssue({
        type: 'SOURCE_CONFLICT',
        description: 'SYSTEM and WORLD_VERIFIED disagree on time',
        severity: 0.8
      });

      const issues = getArchitectureIssues();

      expect(issues).toHaveLength(1);
      expect(issues[0].type).toBe('SOURCE_CONFLICT');
      expect(issues[0].timestamp).toBeGreaterThan(0);
    });

    it('keeps only last 100 issues', () => {
      for (let i = 0; i < 110; i++) {
        logArchitectureIssue({
          type: 'INTEGRATION_ERROR',
          description: `Issue ${i}`,
          severity: 0.5
        });
      }

      const issues = getArchitectureIssues();

      expect(issues.length).toBeLessThanOrEqual(100);
    });

    it('clears issues', () => {
      logArchitectureIssue({
        type: 'REPEATED_FAILURE',
        description: 'Test',
        severity: 0.5
      });

      clearArchitectureIssues();

      expect(getArchitectureIssues()).toHaveLength(0);
    });
  });

  describe('Dashboard', () => {
    it('returns complete dashboard', () => {
      evaluationBus.emit(createEvaluationEvent(
        'GOAL', 'USER', 0.5, 'positive', ['goal_success'], 0.9
      ));
      recordPenalty('TOOL', 2);

      const dashboard = getPrismDashboard();

      expect(dashboard.trustIndex).toBeDefined();
      expect(dashboard.trustIndex.totalEvents).toBe(1);
      expect(dashboard.dailyPenalties.TOOL).toBe(2);
      expect(dashboard.remainingBudgets.TOOL).toBe(3);
      expect(dashboard.guardStats).toBeDefined();
    });
  });

  describe('Config', () => {
    it('has penalty caps for all stages', () => {
      const stages = ['TOOL', 'ROUTER', 'PRISM', 'GUARD', 'USER'];
      for (const stage of stages) {
        expect(METRICS_CONFIG.MAX_DAILY_PENALTY[stage as keyof typeof METRICS_CONFIG.MAX_DAILY_PENALTY]).toBeDefined();
      }
    });

    it('TOOL has lowest cap, USER has highest', () => {
      expect(METRICS_CONFIG.MAX_DAILY_PENALTY.TOOL).toBeLessThan(METRICS_CONFIG.MAX_DAILY_PENALTY.USER);
    });
  });
});
