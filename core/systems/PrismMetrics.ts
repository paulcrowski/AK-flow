/**
 * PrismMetrics - Trust Index & Daily Penalty Caps
 * 
 * PRISM ARCHITECTURE (13/10) - Phase 5
 * 
 * This module provides:
 * 1. TrustIndex - single KPI for "is this working?"
 * 2. Daily penalty caps per stage
 * 3. Architecture issues log for integration bugs
 */

import { evaluationBus, EVALUATION_CONFIG } from './EvaluationBus';
import { EvaluationStage } from '../../types';
import { clamp01 } from '../../utils/math';

// ═══════════════════════════════════════════════════════════════════════════
// Configuration
// ═══════════════════════════════════════════════════════════════════════════

export const METRICS_CONFIG = {
  // Daily penalty caps per stage (prevents runaway punishment)
  MAX_DAILY_PENALTY: {
    TOOL: 5,
    ROUTER: 8,
    PRISM: 15,
    GUARD: 10,
    USER: 20
  } as Record<EvaluationStage, number>,
  
  // TrustIndex weights
  TRUST_WEIGHTS: {
    fact_mutation: 1.0,    // Most severe
    soft_fail: 0.5,
    retry: 0.3,
    identity_leak: 0.8
  },
  
  // Architecture issue threshold
  ARCHITECTURE_ISSUE_THRESHOLD: 0.7
};

// ═══════════════════════════════════════════════════════════════════════════
// Daily Penalty Tracking
// ═══════════════════════════════════════════════════════════════════════════

interface DailyPenalty {
  date: string;
  penalties: Record<EvaluationStage, number>;
}

let dailyPenalty: DailyPenalty = {
  date: new Date().toISOString().split('T')[0],
  penalties: { TOOL: 0, ROUTER: 0, PRISM: 0, GUARD: 0, USER: 0 }
};

/**
 * Reset daily penalties (for testing)
 */
export function resetDailyPenalties(): void {
  dailyPenalty = {
    date: new Date().toISOString().split('T')[0],
    penalties: { TOOL: 0, ROUTER: 0, PRISM: 0, GUARD: 0, USER: 0 }
  };
}

/**
 * Check if penalty is allowed for this stage today
 */
export function canApplyPenalty(stage: EvaluationStage, amount: number): boolean {
  resetIfNewDay();
  
  const current = dailyPenalty.penalties[stage];
  const max = METRICS_CONFIG.MAX_DAILY_PENALTY[stage];
  
  return (current + amount) <= max;
}

/**
 * Record penalty for stage
 */
export function recordPenalty(stage: EvaluationStage, amount: number): void {
  resetIfNewDay();
  dailyPenalty.penalties[stage] += amount;
}

/**
 * Get remaining penalty budget for stage
 */
export function getRemainingPenaltyBudget(stage: EvaluationStage): number {
  resetIfNewDay();
  return METRICS_CONFIG.MAX_DAILY_PENALTY[stage] - dailyPenalty.penalties[stage];
}

/**
 * Get all daily penalties
 */
export function getDailyPenalties(): Record<EvaluationStage, number> {
  resetIfNewDay();
  return { ...dailyPenalty.penalties };
}

function resetIfNewDay(): void {
  const today = new Date().toISOString().split('T')[0];
  if (dailyPenalty.date !== today) {
    dailyPenalty = {
      date: today,
      penalties: { TOOL: 0, ROUTER: 0, PRISM: 0, GUARD: 0, USER: 0 }
    };
    console.log('[PrismMetrics] 🔄 Daily penalty counters reset');
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Trust Index
// ═══════════════════════════════════════════════════════════════════════════

export interface TrustIndexResult {
  index: number;           // 0-1, higher is better
  factMutationRate: number;
  softFailRate: number;
  retryRate: number;
  identityLeakRate: number;
  totalEvents: number;
}

/**
 * Calculate TrustIndex - single KPI for system health
 * 
 * TrustIndex = 1 - (fact_mutation_rate + soft_fail_rate*0.5 + retry_rate*0.3 + identity_leak_rate*0.8)
 * 
 * Higher is better. 1.0 = perfect, 0.0 = disaster.
 */
export function calculateTrustIndex(): TrustIndexResult {
  const metrics = evaluationBus.getMetrics();
  const total = metrics.total_events;
  
  if (total === 0) {
    return {
      index: 1.0,  // No events = no problems
      factMutationRate: 0,
      softFailRate: 0,
      retryRate: 0,
      identityLeakRate: 0,
      totalEvents: 0
    };
  }
  
  // Calculate rates
  const factMutationRate = (metrics.events_by_tag['fact_mutation'] || 0) / total;
  const softFailRate = (metrics.events_by_tag['soft_fail'] || 0) / total;
  const retryRate = (metrics.events_by_tag['retry_triggered'] || 0) / total;
  const identityLeakRate = (metrics.events_by_tag['identity_leak'] || 0) / total;
  
  // Calculate index
  const penalty = 
    factMutationRate * METRICS_CONFIG.TRUST_WEIGHTS.fact_mutation +
    softFailRate * METRICS_CONFIG.TRUST_WEIGHTS.soft_fail +
    retryRate * METRICS_CONFIG.TRUST_WEIGHTS.retry +
    identityLeakRate * METRICS_CONFIG.TRUST_WEIGHTS.identity_leak;
  
  const index = clamp01(1 - penalty);
  
  return {
    index,
    factMutationRate,
    softFailRate,
    retryRate,
    identityLeakRate,
    totalEvents: total
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Architecture Issues Log
// ═══════════════════════════════════════════════════════════════════════════

export interface ArchitectureIssue {
  timestamp: number;
  type: 'SOURCE_CONFLICT' | 'INTEGRATION_ERROR' | 'REPEATED_FAILURE';
  description: string;
  severity: number;
  context?: Record<string, unknown>;
}

const architectureIssues: ArchitectureIssue[] = [];

/**
 * Log architecture issue (for human review)
 */
export function logArchitectureIssue(issue: Omit<ArchitectureIssue, 'timestamp'>): void {
  const fullIssue: ArchitectureIssue = {
    ...issue,
    timestamp: Date.now()
  };
  
  architectureIssues.push(fullIssue);
  
  // Keep only last 100 issues
  if (architectureIssues.length > 100) {
    architectureIssues.shift();
  }
  
  console.warn(
    `[PrismMetrics] 🚨 ARCHITECTURE ISSUE: ${issue.type} - ${issue.description} (severity: ${issue.severity})`
  );
}

/**
 * Get all architecture issues
 */
export function getArchitectureIssues(): ArchitectureIssue[] {
  return [...architectureIssues];
}

/**
 * Get recent architecture issues (last N)
 */
export function getRecentArchitectureIssues(count: number = 10): ArchitectureIssue[] {
  return architectureIssues.slice(-count);
}

/**
 * Clear architecture issues
 */
export function clearArchitectureIssues(): void {
  architectureIssues.length = 0;
}

// ═══════════════════════════════════════════════════════════════════════════
// Auto-detect Architecture Issues
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Check for repeated failures from same stage (potential integration bug)
 */
export function checkForRepeatedFailures(): void {
  const metrics = evaluationBus.getMetrics();
  
  for (const [stage, count] of Object.entries(metrics.events_by_stage)) {
    const negativeCount = metrics.negative_events;
    const stageNegativeRate = count / Math.max(1, metrics.total_events);
    
    // If one stage is generating >50% of all events and mostly negative
    if (stageNegativeRate > 0.5 && negativeCount > 10) {
      logArchitectureIssue({
        type: 'REPEATED_FAILURE',
        description: `Stage ${stage} generating ${(stageNegativeRate * 100).toFixed(0)}% of events`,
        severity: 0.8,
        context: { stage, count, total: metrics.total_events }
      });
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Dashboard Export
// ═══════════════════════════════════════════════════════════════════════════

export interface PrismDashboard {
  trustIndex: TrustIndexResult;
  dailyPenalties: Record<EvaluationStage, number>;
  remainingBudgets: Record<EvaluationStage, number>;
  recentIssues: ArchitectureIssue[];
  guardStats: ReturnType<typeof evaluationBus.getGuardStats>;
}

/**
 * Get full dashboard data
 */
export function getPrismDashboard(): PrismDashboard {
  return {
    trustIndex: calculateTrustIndex(),
    dailyPenalties: getDailyPenalties(),
    remainingBudgets: {
      TOOL: getRemainingPenaltyBudget('TOOL'),
      ROUTER: getRemainingPenaltyBudget('ROUTER'),
      PRISM: getRemainingPenaltyBudget('PRISM'),
      GUARD: getRemainingPenaltyBudget('GUARD'),
      USER: getRemainingPenaltyBudget('USER')
    },
    recentIssues: getRecentArchitectureIssues(5),
    guardStats: evaluationBus.getGuardStats()
  };
}
