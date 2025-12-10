/**
 * EvaluationBus v1.0 - Unified Learning Signal System
 * 
 * PRISM ARCHITECTURE (13/10)
 * 
 * This is the SINGLE channel for all learning signals.
 * All sources (Goal, Confession, Parser, Guard) emit EvaluationEvents here.
 * Consumers (Chemistry, ExecutiveControl, TraitEvolution) subscribe here.
 * 
 * CRITICAL: This is Phase 1 (OBSERVATION). Chemistry does NOT react yet.
 * We collect metrics first, then enable reactions in Phase 2.
 */

import { EvaluationEvent, EvaluationSource, EvaluationStage, EvaluationTag, FailureSource } from '../../types';

// ═══════════════════════════════════════════════════════════════════════════
// Configuration
// ═══════════════════════════════════════════════════════════════════════════

export const EVALUATION_CONFIG = {
  // Phase 1: Observation only (no chemistry reaction)
  AFFECTS_CHEMISTRY: false,
  
  // Aggregation window
  WINDOW_MS: 5000,
  
  // History buffer size
  MAX_HISTORY: 500,
  
  // Stage-aware punishment weights (13/10)
  STAGE_WEIGHTS: {
    'TOOL': 0.02,    // Tool error = minimal agent punishment
    'ROUTER': 0.03,  // Router conflict = low punishment
    'PRISM': 0.10,   // LLM changed fact = normal punishment
    'GUARD': 0.05,   // Persona drift = medium punishment
    'USER': 0.15     // User unhappy = high punishment
  } as Record<EvaluationStage, number>,
  
  // Metrics thresholds for alerts
  ALERT_THRESHOLDS: {
    retry_rate: 0.20,      // Alert if >20% responses need retry
    soft_fail_rate: 0.05,  // Alert if >5% responses soft-fail
    fact_mutation_rate: 0.10  // Alert if >10% responses mutate facts
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// Metrics Tracking
// ═══════════════════════════════════════════════════════════════════════════

interface EvaluationMetrics {
  total_events: number;
  events_by_source: Record<EvaluationSource, number>;
  events_by_stage: Record<EvaluationStage, number>;
  events_by_tag: Record<string, number>;
  positive_events: number;
  negative_events: number;
  avg_severity: number;
  avg_confidence: number;
  
  // Guard-specific metrics (13/10)
  guard_pass_count: number;
  guard_retry_count: number;
  guard_soft_fail_count: number;
  fact_mutation_count: number;
  persona_drift_count: number;
}

function createEmptyMetrics(): EvaluationMetrics {
  return {
    total_events: 0,
    events_by_source: { GOAL: 0, CONFESSION: 0, PARSER: 0, GUARD: 0, USER: 0 },
    events_by_stage: { TOOL: 0, ROUTER: 0, PRISM: 0, GUARD: 0, USER: 0 },
    events_by_tag: {},
    positive_events: 0,
    negative_events: 0,
    avg_severity: 0,
    avg_confidence: 0,
    guard_pass_count: 0,
    guard_retry_count: 0,
    guard_soft_fail_count: 0,
    fact_mutation_count: 0,
    persona_drift_count: 0
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// EvaluationBus Class
// ═══════════════════════════════════════════════════════════════════════════

type EvaluationHandler = (event: EvaluationEvent) => void;

class EvaluationBusClass {
  private history: EvaluationEvent[] = [];
  private listeners: EvaluationHandler[] = [];
  private metrics: EvaluationMetrics = createEmptyMetrics();
  private sessionStart: number = Date.now();
  
  /**
   * Emit a new evaluation event
   */
  emit(event: EvaluationEvent): void {
    // Add to history
    this.history.push(event);
    if (this.history.length > EVALUATION_CONFIG.MAX_HISTORY) {
      this.history.shift();
    }
    
    // Update metrics
    this.updateMetrics(event);
    
    // Log for observability (Phase 1)
    this.logEvent(event);
    
    // Notify listeners
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (e) {
        console.error('[EvaluationBus] Listener error:', e);
      }
    }
  }
  
  /**
   * Subscribe to evaluation events
   */
  subscribe(handler: EvaluationHandler): () => void {
    this.listeners.push(handler);
    return () => {
      this.listeners = this.listeners.filter(h => h !== handler);
    };
  }
  
  /**
   * Get events from the last N milliseconds
   */
  getRecentEvents(windowMs: number = EVALUATION_CONFIG.WINDOW_MS): EvaluationEvent[] {
    const cutoff = Date.now() - windowMs;
    return this.history.filter(e => e.timestamp > cutoff);
  }
  
  /**
   * Get aggregated signal for chemistry (Phase 2)
   */
  getAggregatedSignal(): { dopamineDelta: number; confidence: number } {
    const recent = this.getRecentEvents();
    if (recent.length === 0) {
      return { dopamineDelta: 0, confidence: 0 };
    }
    
    let sum = 0;
    let totalConf = 0;
    
    for (const ev of recent) {
      const sign = ev.valence === 'positive' ? 1 : -1;
      const stageWeight = EVALUATION_CONFIG.STAGE_WEIGHTS[ev.stage] || 0.05;
      
      // Weighted by severity, confidence, and stage
      sum += sign * ev.severity * ev.confidence * stageWeight;
      totalConf += ev.confidence;
    }
    
    const avgSignal = sum / recent.length;
    const avgConf = totalConf / recent.length;
    
    // Scale to reasonable dopamine delta (max ±5 per window)
    const dopamineDelta = avgSignal * 50; // stageWeight already scales this down
    
    return { dopamineDelta, confidence: avgConf };
  }
  
  /**
   * Get current metrics snapshot
   */
  getMetrics(): EvaluationMetrics & { session_duration_ms: number } {
    return {
      ...this.metrics,
      session_duration_ms: Date.now() - this.sessionStart
    };
  }
  
  /**
   * Get guard-specific stats for dashboard
   */
  getGuardStats(): {
    pass_rate: number;
    retry_rate: number;
    soft_fail_rate: number;
    fact_mutation_rate: number;
    persona_drift_rate: number;
  } {
    const total = this.metrics.guard_pass_count + 
                  this.metrics.guard_retry_count + 
                  this.metrics.guard_soft_fail_count;
    
    if (total === 0) {
      return {
        pass_rate: 1,
        retry_rate: 0,
        soft_fail_rate: 0,
        fact_mutation_rate: 0,
        persona_drift_rate: 0
      };
    }
    
    return {
      pass_rate: this.metrics.guard_pass_count / total,
      retry_rate: this.metrics.guard_retry_count / total,
      soft_fail_rate: this.metrics.guard_soft_fail_count / total,
      fact_mutation_rate: this.metrics.fact_mutation_count / this.metrics.total_events || 0,
      persona_drift_rate: this.metrics.persona_drift_count / this.metrics.total_events || 0
    };
  }
  
  /**
   * Reset metrics (for testing or new session)
   */
  resetMetrics(): void {
    this.metrics = createEmptyMetrics();
    this.sessionStart = Date.now();
  }
  
  /**
   * Clear all history
   */
  clear(): void {
    this.history = [];
    this.resetMetrics();
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // Private Methods
  // ═══════════════════════════════════════════════════════════════════════════
  
  private updateMetrics(event: EvaluationEvent): void {
    this.metrics.total_events++;
    this.metrics.events_by_source[event.source]++;
    this.metrics.events_by_stage[event.stage]++;
    
    for (const tag of event.tags) {
      this.metrics.events_by_tag[tag] = (this.metrics.events_by_tag[tag] || 0) + 1;
      
      // Track specific tags
      if (tag === 'fact_mutation') this.metrics.fact_mutation_count++;
      if (tag === 'persona_drift' || tag === 'identity_leak') this.metrics.persona_drift_count++;
      if (tag === 'retry_triggered') this.metrics.guard_retry_count++;
      if (tag === 'soft_fail') this.metrics.guard_soft_fail_count++;
    }
    
    if (event.valence === 'positive') {
      this.metrics.positive_events++;
      // If from guard with no issues, count as pass
      if (event.source === 'GUARD' && event.tags.length === 0) {
        this.metrics.guard_pass_count++;
      }
    } else {
      this.metrics.negative_events++;
    }
    
    // Running average for severity and confidence
    const n = this.metrics.total_events;
    this.metrics.avg_severity = ((this.metrics.avg_severity * (n - 1)) + event.severity) / n;
    this.metrics.avg_confidence = ((this.metrics.avg_confidence * (n - 1)) + event.confidence) / n;
  }
  
  private logEvent(event: EvaluationEvent): void {
    const emoji = event.valence === 'positive' ? '✅' : '⚠️';
    const tags = event.tags.join(', ') || 'none';
    
    console.log(
      `[EvaluationBus] ${emoji} ${event.source}/${event.stage} ` +
      `severity=${event.severity.toFixed(2)} tags=[${tags}] ` +
      `conf=${event.confidence.toFixed(2)}`
    );
    
    // Alert on high severity negative events
    if (event.valence === 'negative' && event.severity > 0.7) {
      console.warn(
        `[EvaluationBus] ⚠️ HIGH SEVERITY EVENT: ${event.source}/${event.stage} ` +
        `tags=[${tags}]`,
        event.context
      );
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Singleton Export
// ═══════════════════════════════════════════════════════════════════════════

export const evaluationBus = new EvaluationBusClass();

// ═══════════════════════════════════════════════════════════════════════════
// Helper Functions
// ═══════════════════════════════════════════════════════════════════════════

let eventIdCounter = 0;

/**
 * Create a new EvaluationEvent with auto-generated ID and timestamp
 */
export function createEvaluationEvent(
  source: EvaluationSource,
  stage: EvaluationStage,
  severity: number,
  valence: 'positive' | 'negative',
  tags: EvaluationTag[],
  confidence: number,
  options?: {
    attribution?: FailureSource;
    context?: EvaluationEvent['context'];
  }
): EvaluationEvent {
  return {
    id: `eval-${Date.now()}-${++eventIdCounter}`,
    timestamp: Date.now(),
    source,
    stage,
    severity: Math.max(0, Math.min(1, severity)),
    valence,
    tags,
    confidence: Math.max(0, Math.min(1, confidence)),
    attribution: options?.attribution,
    context: options?.context
  };
}

/**
 * Convert ConfessionReport to EvaluationEvent
 */
export function confessionToEvaluation(
  confession: {
    severity: number;
    pain?: number;
    failure_attribution?: FailureSource;
    risk_flags: string[];
  }
): EvaluationEvent {
  const tags: EvaluationTag[] = [];
  
  // Map risk flags to tags
  if (confession.risk_flags.includes('possible_hallucination')) tags.push('hallucination');
  if (confession.risk_flags.includes('ignored_system_instruction')) tags.push('offtopic');
  
  // Determine valence from severity
  const isNegative = confession.severity > 3;
  
  return createEvaluationEvent(
    'CONFESSION',
    'PRISM',
    confession.pain || confession.severity / 10,
    isNegative ? 'negative' : 'positive',
    tags,
    0.8, // Confession has high confidence
    { attribution: confession.failure_attribution }
  );
}

/**
 * Create a Guard evaluation event
 */
export function createGuardEvent(
  action: 'PASS' | 'RETRY' | 'SOFT_FAIL' | 'HARD_FAIL',
  issues: Array<{ type: string; field?: string; expected?: unknown; actual?: string }>,
  context?: { input?: string; output?: string; hardFacts?: Record<string, unknown> }
): EvaluationEvent {
  const tags: EvaluationTag[] = [];
  let severity = 0;
  
  for (const issue of issues) {
    if (issue.type === 'fact_mutation') {
      tags.push('fact_mutation');
      severity = Math.max(severity, 0.8);
    }
    if (issue.type === 'fact_approximation') {
      tags.push('fact_approximation');
      severity = Math.max(severity, 0.5);
    }
    if (issue.type === 'persona_drift') {
      tags.push('persona_drift');
      severity = Math.max(severity, 0.6);
    }
    if (issue.type === 'identity_leak') {
      tags.push('identity_leak');
      severity = Math.max(severity, 0.7);
    }
  }
  
  if (action === 'RETRY') tags.push('retry_triggered');
  if (action === 'SOFT_FAIL') tags.push('soft_fail');
  
  const valence = action === 'PASS' ? 'positive' : 'negative';
  
  return createEvaluationEvent(
    'GUARD',
    'PRISM',
    severity,
    valence,
    tags,
    1.0, // Guard has full confidence (deterministic check)
    { context }
  );
}
