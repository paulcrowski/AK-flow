/**
 * KernelEngine Initial State
 * 
 * Centralne baseline'y dla wszystkich stanów kognitywnych.
 * Przeniesione z useCognitiveKernel.ts dla Single Source of Truth.
 * 
 * @module core/kernel/initialState
 */

import type { LimbicState, SomaState, NeurotransmitterState, GoalState, ResonanceField } from '../../types';
import type { KernelState } from './types';
import { DEFAULT_TRAIT_VECTOR } from '../types/TraitVector';

// Re-export for backward compatibility
export { DEFAULT_TRAIT_VECTOR };

// ═══════════════════════════════════════════════════════════════════════════
// BIOLOGICAL BASELINES
// ═══════════════════════════════════════════════════════════════════════════

export const INITIAL_LIMBIC: LimbicState = {
  fear: 0.1,
  curiosity: 0.8,       // High curiosity start (11/10 MODE)
  frustration: 0.0,
  satisfaction: 0.5
};

export const INITIAL_SOMA: SomaState = {
  cognitiveLoad: 10,
  energy: 100,
  isSleeping: false
};

export const INITIAL_NEURO: NeurotransmitterState = {
  dopamine: 55,
  serotonin: 60,
  norepinephrine: 50
};

export const INITIAL_RESONANCE: ResonanceField = {
  coherence: 1.0,
  intensity: 0.5,
  frequency: 1.0,
  timeDilation: 1.0
};

// ═══════════════════════════════════════════════════════════════════════════
// GOAL STATE BASELINE
// ═══════════════════════════════════════════════════════════════════════════

export const INITIAL_GOAL_STATE: GoalState = {
  activeGoal: null,
  backlog: [],
  lastUserInteractionAt: Date.now(),
  goalsFormedTimestamps: [],
  lastGoals: []
};

// ═══════════════════════════════════════════════════════════════════════════
// COMPLETE KERNEL STATE
// ═══════════════════════════════════════════════════════════════════════════

export const createInitialKernelState = (overrides?: Partial<KernelState>): KernelState => {
  const now = Date.now();
  
  return {
    // Biological substrates
    limbic: INITIAL_LIMBIC,
    soma: INITIAL_SOMA,
    neuro: INITIAL_NEURO,
    resonance: INITIAL_RESONANCE,
    
    // Personality & Goals
    traitVector: DEFAULT_TRAIT_VECTOR,
    goalState: { ...INITIAL_GOAL_STATE, lastUserInteractionAt: now },
    
    // Mode flags
    autonomousMode: false,      // SECURITY: Default OFF
    poeticMode: false,
    chemistryEnabled: true,
    
    // Temporal tracking
    lastSpeakTimestamp: 0,
    silenceStart: now,
    lastUserInteractionAt: now,
    
    // Counters
    consecutiveAgentSpeeches: 0,
    ticksSinceLastReward: 0,
    
    // History (bounded to 20)
    thoughtHistory: [],
    
    // Apply overrides
    ...overrides
  };
};

// ═══════════════════════════════════════════════════════════════════════════
// BASELINE NEURO (for sleep reset)
// ═══════════════════════════════════════════════════════════════════════════

export const BASELINE_NEURO: NeurotransmitterState = {
  dopamine: 55,
  serotonin: 60,
  norepinephrine: 50
};
