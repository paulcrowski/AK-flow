/**
 * KernelEngine Initial State
 * 
 * Centralne baseline'y dla wszystkich stanów kognitywnych.
 * Przeniesione z useCognitiveKernel.ts dla Single Source of Truth.
 * 
 * @module core/kernel/initialState
 */

import type { LimbicState, SomaState, NeurotransmitterState, GoalState, ResonanceField } from '../../types';
import { createInitialSynapticMemory } from '../../types';
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
  satisfaction: 0.5,
  synapticMemory: createInitialSynapticMemory()
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
// SOCIAL DYNAMICS BASELINE (Soft Homeostasis)
// ═══════════════════════════════════════════════════════════════════════════

import type { SocialDynamics } from './types';

export const INITIAL_SOCIAL_DYNAMICS: SocialDynamics = {
  socialCost: 0.05,                 // Baseline (never fully zero)
  autonomyBudget: 1.0,              // Full budget at start
  userPresenceScore: 0.5,           // Neutral presence
  consecutiveWithoutResponse: 0     // No unanswered speeches
};

// ═══════════════════════════════════════════════════════════════════════════
// GOAL STATE BASELINE
// ═══════════════════════════════════════════════════════════════════════════

export const INITIAL_GOAL_STATE: GoalState = {
  activeGoal: null,
  backlog: [],
  lastUserInteractionAt: Date.now(),
  goalsFormedTimestamps: [],
  lastGoalFormedAt: null,
  lastGoals: []
};

// ═══════════════════════════════════════════════════════════════════════════
// COMPLETE KERNEL STATE
// ═══════════════════════════════════════════════════════════════════════════

export const createInitialKernelState = (overrides?: Partial<KernelState>): KernelState => {
  const now = Date.now();
  const baseLimbic: LimbicState = {
    ...INITIAL_LIMBIC,
    synapticMemory: createInitialSynapticMemory()
  };
  
  const baseState: KernelState = {
    // Biological substrates
    limbic: baseLimbic,
    soma: INITIAL_SOMA,
    neuro: INITIAL_NEURO,
    resonance: INITIAL_RESONANCE,
    
    // Personality & Goals
    traitVector: DEFAULT_TRAIT_VECTOR,
    goalState: { ...INITIAL_GOAL_STATE, lastUserInteractionAt: now },
    workingSet: null,
    
    // Mode flags
    autonomousMode: false,      // SECURITY: Default OFF
    poeticMode: false,
    chemistryEnabled: true,
    hasConsolidatedThisSleep: false,
    
    // Temporal tracking
    lastSpeakTimestamp: 0,
    silenceStart: now,
    lastUserInteractionAt: now,
    
    // Counters
    consecutiveAgentSpeeches: 0,
    ticksSinceLastReward: 0,
    
    // Social dynamics (soft homeostasis)
    socialDynamics: INITIAL_SOCIAL_DYNAMICS,
    
    // History (bounded to 20)
    thoughtHistory: [],
    
    // Conversation (bounded to 50 turns)
    conversation: [],

    // Library anchor
    lastLibraryDocId: null,
  };

  return {
    ...baseState,
    ...overrides,
    limbic: {
      ...baseState.limbic,
      ...(overrides?.limbic ?? {}),
      synapticMemory: overrides?.limbic?.synapticMemory ?? baseState.limbic.synapticMemory
    }
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
