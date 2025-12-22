/**
 * MetaStateService - Homeostaza stanów meta
 * 
 * Aktualizuje meta-states z:
 * - EMA smoothing (wygładzanie zmian)
 * - Homeostaza (powrót do baseline)
 * - Clamping (0-100)
 * 
 * @module core/services/MetaStateService
 */

import type { MetaStates, MetaStatesDelta, BehaviorInterpretation } from '../types/MetaStates';
import { META_STATES_BASELINE } from '../types/MetaStates';

/**
 * Konfiguracja homeostazy
 */
export interface MetaStateConfig {
  /** Baseline dla energii (domyślnie 70) */
  baselineEnergy: number;
  /** Baseline dla pewności (domyślnie 60) */
  baselineConfidence: number;
  /** Baseline dla stresu (domyślnie 20) */
  baselineStress: number;
  /** Szybkość powrotu do baseline (0.05 = 5%/tick) */
  homeostasisRate: number;
  /** Współczynnik EMA smoothing (0.3 = 30% nowej wartości) */
  emaAlpha: number;
}

const DEFAULT_CONFIG: MetaStateConfig = {
  baselineEnergy: META_STATES_BASELINE.energy,
  baselineConfidence: META_STATES_BASELINE.confidence,
  baselineStress: META_STATES_BASELINE.stress,
  homeostasisRate: 0.05,
  emaAlpha: 0.3
};

/**
 * Clamp wartości do zakresu 0-100
 */
function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Aktualizuje meta-states z homeostazą i EMA smoothing.
 * Zapobiega chaotycznym skokom i zapewnia "samoleczenie".
 */
export function updateMetaStates(
  current: MetaStates,
  deltas: MetaStatesDelta,
  config: MetaStateConfig = DEFAULT_CONFIG
): MetaStates {
  // 1. Zastosuj delty z EMA smoothing
  const withDeltas: MetaStates = {
    energy: clamp(current.energy + (deltas.energy_delta ?? 0) * config.emaAlpha),
    confidence: clamp(current.confidence + (deltas.confidence_delta ?? 0) * config.emaAlpha),
    stress: clamp(current.stress + (deltas.stress_delta ?? 0) * config.emaAlpha)
  };

  // 2. Homeostaza – powoli wracaj do baseline
  const applyHomeostasis = (value: number, baseline: number): number => {
    const diff = baseline - value;
    return value + diff * config.homeostasisRate;
  };

  return {
    energy: clamp(applyHomeostasis(withDeltas.energy, config.baselineEnergy)),
    confidence: clamp(applyHomeostasis(withDeltas.confidence, config.baselineConfidence)),
    stress: clamp(applyHomeostasis(withDeltas.stress, config.baselineStress))
  };
}

/**
 * Interpretacja meta-states na tryb behawioralny.
 */
export function interpretMetaStates(states: MetaStates): BehaviorInterpretation {
  // Niska energia → tryb odpoczynku
  if (states.energy < 20) {
    return { mode: 'rest', reasoning: 'Low energy - minimal responses' };
  }

  // Wysoki stres + niska pewność → tryb audytora (ostrożność)
  if (states.stress > 60 && states.confidence < 40) {
    return { mode: 'auditor', reasoning: 'High stress + low confidence - verify before speaking' };
  }

  // Wysoka pewność + niski stres → tryb kreatywny
  if (states.confidence > 70 && states.stress < 30) {
    return { mode: 'creative', reasoning: 'High confidence, low stress - can explore' };
  }

  return { mode: 'cautious', reasoning: 'Balanced state - proceed carefully' };
}

/**
 * Tworzy domyślne meta-states
 */
export function createDefaultMetaStates(): MetaStates {
  return { ...META_STATES_BASELINE };
}

/**
 * Sprawdza czy agent potrzebuje odpoczynku
 */
export function needsRest(states: MetaStates): boolean {
  return states.energy < 20 || states.stress > 80;
}
