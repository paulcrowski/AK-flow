/**
 * ChemistryBridge - Connects EvaluationBus to NeurotransmitterSystem
 * 
 * PRISM ARCHITECTURE (13/10) - Phase 4
 * 
 * This module bridges learning signals to chemistry.
 * Single responsibility: convert EvaluationEvents to dopamine/serotonin deltas.
 * 
 * MODULAR: Does NOT modify NeurotransmitterSystem.
 * Just provides delta calculations that can be applied externally.
 */

import { NeurotransmitterState } from '../../types';
import { evaluationBus, EVALUATION_CONFIG } from './EvaluationBus';
import { clampNeuro } from './NeurotransmitterSystem';
import { createLogger } from '../services/LoggerService';

// ═══════════════════════════════════════════════════════════════════════════
// Configuration
// ═══════════════════════════════════════════════════════════════════════════

import { SYSTEM_CONFIG } from '../config/systemConfig';

const log = createLogger('ChemistryBridge');

// DEPRECATED: Use SYSTEM_CONFIG.chemistryBridge instead
const CHEMISTRY_BRIDGE_CONFIG = {
  get ENABLED() { return SYSTEM_CONFIG.chemistryBridge.enabled; },
  set ENABLED(v: boolean) { (SYSTEM_CONFIG.chemistryBridge as any).enabled = v; },
  
  get MAX_DOPAMINE_DELTA() { return SYSTEM_CONFIG.chemistryBridge.maxDopamineDelta; },
  get MAX_SEROTONIN_DELTA() { return SYSTEM_CONFIG.chemistryBridge.maxSerotoninDelta; },
  
  // Stage-aware weights (from 13/10 spec)
  STAGE_WEIGHTS: EVALUATION_CONFIG.STAGE_WEIGHTS,
  
  // Baseline targets
  get DOPAMINE_BASELINE() { return SYSTEM_CONFIG.chemistryBridge.dopamineBaseline; },
  get SEROTONIN_BASELINE() { return SYSTEM_CONFIG.chemistryBridge.serotoninBaseline; },
  
  // Log all chemistry changes
  get LOG_ENABLED() { return SYSTEM_CONFIG.chemistryBridge.logEnabled; }
};

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

export interface ChemistryDelta {
  dopamine: number;
  serotonin: number;
  norepinephrine: number;
  confidence: number;
  source: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// Main Bridge Function
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Calculate chemistry delta from recent EvaluationBus events
 * 
 * This is the main bridge function. Call periodically (e.g., every tick)
 * to get chemistry adjustments based on learning signals.
 * 
 * @returns ChemistryDelta with dopamine/serotonin changes
 */
export function calculateChemistryDelta(): ChemistryDelta {
  // Skip if disabled
  if (!CHEMISTRY_BRIDGE_CONFIG.ENABLED) {
    return { dopamine: 0, serotonin: 0, norepinephrine: 0, confidence: 0, source: 'disabled' };
  }
  
  const signal = evaluationBus.getAggregatedSignal();
  
  if (signal.confidence === 0) {
    return { dopamine: 0, serotonin: 0, norepinephrine: 0, confidence: 0, source: 'no_events' };
  }
  
  // Dopamine: responds to success/failure signals
  // Positive events → dopamine up, negative → dopamine down
  const dopamineDelta = clampDelta(
    signal.dopamineDelta,
    CHEMISTRY_BRIDGE_CONFIG.MAX_DOPAMINE_DELTA
  );
  
  // Serotonin: responds to stability/consistency
  // High confidence positive → serotonin up (feeling stable)
  // High confidence negative → serotonin down (feeling unstable)
  const serotoninDelta = clampDelta(
    signal.dopamineDelta * 0.3, // Serotonin moves slower
    CHEMISTRY_BRIDGE_CONFIG.MAX_SEROTONIN_DELTA
  );
  
  // Norepinephrine: responds to alertness needs
  // Negative events → slight norepinephrine up (more alert)
  const norepinephrineDelta = signal.dopamineDelta < 0 
    ? Math.min(2, Math.abs(signal.dopamineDelta) * 0.2)
    : 0;
  
  const delta: ChemistryDelta = {
    dopamine: dopamineDelta,
    serotonin: serotoninDelta,
    norepinephrine: norepinephrineDelta,
    confidence: signal.confidence,
    source: 'evaluation_bus'
  };
  
  // Log if enabled
  if (CHEMISTRY_BRIDGE_CONFIG.LOG_ENABLED && (dopamineDelta !== 0 || serotoninDelta !== 0)) {
    logChemistryDelta(delta);
  }
  
  return delta;
}

/**
 * Apply chemistry delta to current state
 * 
 * Pure function - does not mutate input.
 * 
 * @param current - Current neurotransmitter state
 * @param delta - Delta to apply
 * @returns New neurotransmitter state
 */
export function applyChemistryDelta(
  current: NeurotransmitterState,
  delta: ChemistryDelta
): NeurotransmitterState {
  return {
    dopamine: clampNeuro(current.dopamine + delta.dopamine),
    serotonin: clampNeuro(current.serotonin + delta.serotonin),
    norepinephrine: clampNeuro(current.norepinephrine + delta.norepinephrine)
  };
}

/**
 * One-shot: Calculate and apply delta
 * 
 * Convenience function that combines calculate + apply.
 */
export function processEvaluationSignals(
  current: NeurotransmitterState
): { newState: NeurotransmitterState; delta: ChemistryDelta } {
  const delta = calculateChemistryDelta();
  const newState = applyChemistryDelta(current, delta);
  return { newState, delta };
}

// ═══════════════════════════════════════════════════════════════════════════
// Subscription Mode (Alternative to polling)
// ═══════════════════════════════════════════════════════════════════════════

type ChemistryCallback = (delta: ChemistryDelta) => void;
let activeSubscription: (() => void) | null = null;

/**
 * Subscribe to chemistry updates
 * 
 * Alternative to polling calculateChemistryDelta().
 * Callback fires on every EvaluationEvent.
 */
export function subscribeToChemistry(callback: ChemistryCallback): () => void {
  if (activeSubscription) {
    activeSubscription(); // Unsubscribe previous
  }
  
  activeSubscription = evaluationBus.subscribe((event) => {
    if (!CHEMISTRY_BRIDGE_CONFIG.ENABLED) return;
    
    // Calculate immediate delta for this single event
    const stageWeight = CHEMISTRY_BRIDGE_CONFIG.STAGE_WEIGHTS[event.stage] || 0.05;
    const sign = event.valence === 'positive' ? 1 : -1;
    
    const dopamineDelta = clampDelta(
      sign * event.severity * event.confidence * stageWeight * 50,
      CHEMISTRY_BRIDGE_CONFIG.MAX_DOPAMINE_DELTA
    );
    
    const delta: ChemistryDelta = {
      dopamine: dopamineDelta,
      serotonin: dopamineDelta * 0.3,
      norepinephrine: dopamineDelta < 0 ? Math.abs(dopamineDelta) * 0.2 : 0,
      confidence: event.confidence,
      source: `${event.source}/${event.stage}`
    };
    
    callback(delta);
  });
  
  return () => {
    if (activeSubscription) {
      activeSubscription();
      activeSubscription = null;
    }
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Utility Functions
// ═══════════════════════════════════════════════════════════════════════════

function clampDelta(delta: number, max: number): number {
  return Math.max(-max, Math.min(max, delta));
}

function logChemistryDelta(delta: ChemistryDelta): void {
  log.debug(
    `Δdopamine=${delta.dopamine.toFixed(2)}, ` +
      `Δserotonin=${delta.serotonin.toFixed(2)}, ` +
      `conf=${delta.confidence.toFixed(2)}, source=${delta.source}`
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Feature Flag Control
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Enable chemistry reactions (Phase 4 activation)
 */
export function enableChemistryBridge(): void {
  CHEMISTRY_BRIDGE_CONFIG.ENABLED = true;
  log.info('ENABLED - Chemistry now reacts to EvaluationBus');
}

/**
 * Disable chemistry reactions
 */
export function disableChemistryBridge(): void {
  CHEMISTRY_BRIDGE_CONFIG.ENABLED = false;
  log.info('DISABLED - Chemistry ignores EvaluationBus');
}

/**
 * Check if bridge is enabled
 */
export function isChemistryBridgeEnabled(): boolean {
  return CHEMISTRY_BRIDGE_CONFIG.ENABLED;
}

// ═══════════════════════════════════════════════════════════════════════════
// Metrics
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get chemistry bridge stats
 */
export function getChemistryBridgeStats() {
  const evalMetrics = evaluationBus.getMetrics();
  const guardStats = evaluationBus.getGuardStats();
  
  return {
    enabled: CHEMISTRY_BRIDGE_CONFIG.ENABLED,
    totalEvents: evalMetrics.total_events,
    positiveEvents: evalMetrics.positive_events,
    negativeEvents: evalMetrics.negative_events,
    avgSeverity: evalMetrics.avg_severity,
    guardPassRate: guardStats.pass_rate,
    guardRetryRate: guardStats.retry_rate
  };
}
