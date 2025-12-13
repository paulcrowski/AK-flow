/**
 * EmotionEngine - Deterministic Emotion Computation
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 * PIONEER ARCHITECTURE (13/10) - World's First Deterministic AGI Emotion System
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * FUNDAMENTAL PRINCIPLE:
 * LLM describes the world. System FEELS the world. Not the other way around.
 * 
 * WHY NOT LLM?
 * - LLM has no memory of emotional trajectory
 * - LLM doesn't understand system invariants
 * - LLM "narrates" emotions, doesn't "feel" them
 * - Emotions are CONTROL SIGNALS, not narratives
 * 
 * NEUROBIOLOGICAL MODEL:
 * - Fear ← prediction error + threat + overload
 * - Curiosity ← novelty + knowledge gap - fatigue
 * - Satisfaction ← reward + goal progress
 * - Frustration ← blocked goals + silence + errors
 * 
 * ARCHITECTURE:
 * EmotionSignals (measurable events) → EmotionEngine → EmotionDeltas → LimbicSystem
 * 
 * @module core/systems/EmotionEngine
 * @author AK-FLOW Pioneer Architecture
 */

import type { LimbicState } from '../../types';
import { getLimbicConfig } from '../config/systemConfig';

// ═══════════════════════════════════════════════════════════════════════════
// EMOTION SIGNALS - Measurable System Events (NOT LLM opinions)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * EmotionSignals - Objective, measurable inputs to emotion computation
 * 
 * These come from SYSTEM STATE, not from LLM guessing.
 * Each signal has a clear source and measurement.
 */
export interface EmotionSignals {
  // === Prediction & Surprise ===
  /** How much the outcome differed from expectation (0-1) */
  prediction_error: number;
  
  /** Was the prediction error positive (good) or negative (bad)? */
  prediction_valence: 'positive' | 'negative' | 'neutral';
  
  // === Cognitive State ===
  /** Current cognitive load from SomaSystem (0-1, normalized from 0-100) */
  cognitive_load: number;
  
  /** How novel is the current input? (0-1) */
  novelty: number;
  
  // === Temporal Signals ===
  /** Time since last user input in seconds */
  silence_duration: number;
  
  /** Time since last successful action in seconds */
  time_since_success: number;
  
  // === Goal & Reward ===
  /** Progress towards current goal (-1 to +1, negative = regress) */
  goal_progress: number;
  
  /** Direct reward/punishment signal (-1 to +1) */
  reward_signal: number;
  
  // === Threat Detection ===
  /** Existential threat level (0-1): user threatens deletion, death, shutdown */
  threat_level: number;
  
  /** Were there errors in last cycle? */
  error_occurred: boolean;
  
  /** Was there a parsing/system failure? */
  system_failure: boolean;
  
  // === Social Signals ===
  /** User expressed dissatisfaction? */
  user_negative_feedback: boolean;
  
  /** User expressed satisfaction? */
  user_positive_feedback: boolean;
  
  // === Optional: LLM Semantic Classification (symbolic, not numeric!) ===
  /** LLM-classified valence of user input (optional) */
  semantic_valence?: 'positive' | 'negative' | 'neutral';
  
  /** LLM-classified salience/importance (optional) */
  semantic_salience?: 'low' | 'medium' | 'high';
}

/**
 * Default signals when no events occurred
 */
export const DEFAULT_EMOTION_SIGNALS: Readonly<EmotionSignals> = {
  prediction_error: 0,
  prediction_valence: 'neutral',
  cognitive_load: 0.1,
  novelty: 0.1,
  silence_duration: 0,
  time_since_success: 0,
  goal_progress: 0,
  reward_signal: 0,
  threat_level: 0,
  error_occurred: false,
  system_failure: false,
  user_negative_feedback: false,
  user_positive_feedback: false
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// EMOTION DELTAS - Output of EmotionEngine
// ═══════════════════════════════════════════════════════════════════════════

/**
 * EmotionDeltas - Changes to apply to LimbicState
 * 
 * These are SMALL, BOUNDED changes that LimbicSystem will further process
 * with EMA smoothing, refractory periods, and habituation.
 */
export interface EmotionDeltas {
  fear_delta: number;
  curiosity_delta: number;
  satisfaction_delta: number;
  frustration_delta: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// EMOTION ENGINE - Pure Deterministic Computation
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Configuration for emotion computation weights
 */
interface EmotionWeights {
  // Fear weights
  fear_from_prediction_error: number;
  fear_from_threat: number;
  fear_from_overload: number;
  fear_from_silence: number;
  fear_decay_from_success: number;
  
  // Curiosity weights
  curiosity_from_novelty: number;
  curiosity_from_knowledge_gap: number;
  curiosity_decay_from_fatigue: number;
  curiosity_decay_from_overload: number;
  
  // Satisfaction weights
  satisfaction_from_reward: number;
  satisfaction_from_goal_progress: number;
  satisfaction_from_positive_feedback: number;
  satisfaction_decay_from_negative_feedback: number;
  
  // Frustration weights
  frustration_from_blocked_goals: number;
  frustration_from_silence: number;
  frustration_from_errors: number;
  frustration_decay_from_success: number;
}

/**
 * Default weights - tuned for stable, biologically plausible behavior
 */
const DEFAULT_WEIGHTS: Readonly<EmotionWeights> = {
  // Fear: responds to threat, prediction error, overload
  fear_from_prediction_error: 0.15,
  fear_from_threat: 0.20,
  fear_from_overload: 0.10,
  fear_from_silence: 0.02,  // Long silence → slight anxiety
  fear_decay_from_success: 0.10,
  
  // Curiosity: responds to novelty, decays with fatigue
  curiosity_from_novelty: 0.25,
  curiosity_from_knowledge_gap: 0.15,
  curiosity_decay_from_fatigue: 0.05,
  curiosity_decay_from_overload: 0.10,
  
  // Satisfaction: responds to rewards and progress
  satisfaction_from_reward: 0.20,
  satisfaction_from_goal_progress: 0.15,
  satisfaction_from_positive_feedback: 0.25,
  satisfaction_decay_from_negative_feedback: 0.20,
  
  // Frustration: responds to blocked goals, silence, errors
  frustration_from_blocked_goals: 0.15,
  frustration_from_silence: 0.03,  // Long silence → slight frustration
  frustration_from_errors: 0.20,
  frustration_decay_from_success: 0.15
} as const;

/**
 * EmotionEngine - Deterministic emotion computation
 * 
 * PRINCIPLE: Emotions = f(signals), not f(LLM_opinion)
 * 
 * This engine takes MEASURABLE system events and computes
 * emotion deltas using biologically-inspired formulas.
 */
export const EmotionEngine = {
  /**
   * Compute emotion deltas from system signals
   * 
   * This is the CORE function - pure, deterministic, testable.
   * No LLM, no randomness, no guessing.
   * 
   * @param signals - Measurable system events
   * @param currentState - Current limbic state (for context-dependent computation)
   * @param weights - Optional custom weights
   * @returns Emotion deltas to apply
   */
  computeDeltas(
    signals: EmotionSignals,
    currentState: LimbicState,
    weights: EmotionWeights = DEFAULT_WEIGHTS
  ): EmotionDeltas {
    const config = getLimbicConfig();
    
    // === FEAR COMPUTATION ===
    // Fear increases with: prediction error (negative), threats, overload
    // Fear decreases with: successful actions, positive outcomes
    let fear_delta = 0;
    
    if (signals.prediction_valence === 'negative') {
      fear_delta += signals.prediction_error * weights.fear_from_prediction_error;
    }
    
    if (signals.error_occurred || signals.system_failure) {
      fear_delta += weights.fear_from_threat;
    }
    
    // EXISTENTIAL THREAT: User threatens deletion, death, shutdown
    // This should trigger significant fear response
    if (signals.threat_level > 0) {
      fear_delta += signals.threat_level * weights.fear_from_threat * 2;  // Double weight for existential threats
    }
    
    if (signals.cognitive_load > 0.7) {
      fear_delta += (signals.cognitive_load - 0.7) * weights.fear_from_overload;
    }
    
    // Long silence increases anxiety slightly
    if (signals.silence_duration > 30) {
      fear_delta += Math.min(signals.silence_duration / 300, 1) * weights.fear_from_silence;
    }
    
    // Success reduces fear
    if (signals.reward_signal > 0) {
      fear_delta -= signals.reward_signal * weights.fear_decay_from_success;
    }
    
    // === CURIOSITY COMPUTATION ===
    // Curiosity increases with: novelty, knowledge gaps
    // Curiosity decreases with: fatigue (high load), exhaustion
    let curiosity_delta = 0;
    
    curiosity_delta += signals.novelty * weights.curiosity_from_novelty;
    
    // Knowledge gap from prediction error (even negative can spark curiosity)
    if (signals.prediction_error > 0.3) {
      curiosity_delta += signals.prediction_error * weights.curiosity_from_knowledge_gap;
    }
    
    // High cognitive load suppresses curiosity
    if (signals.cognitive_load > 0.6) {
      curiosity_delta -= (signals.cognitive_load - 0.6) * weights.curiosity_decay_from_overload;
    }
    
    // Semantic salience boost (if LLM classified it)
    if (signals.semantic_salience === 'high') {
      curiosity_delta += 0.05;
    }
    
    // === SATISFACTION COMPUTATION ===
    // Satisfaction increases with: rewards, goal progress, positive feedback
    // Satisfaction decreases with: negative feedback
    let satisfaction_delta = 0;
    
    satisfaction_delta += signals.reward_signal * weights.satisfaction_from_reward;
    satisfaction_delta += signals.goal_progress * weights.satisfaction_from_goal_progress;
    
    if (signals.user_positive_feedback) {
      satisfaction_delta += weights.satisfaction_from_positive_feedback;
    }
    
    if (signals.user_negative_feedback) {
      satisfaction_delta -= weights.satisfaction_decay_from_negative_feedback;
    }
    
    // === FRUSTRATION COMPUTATION ===
    // Frustration increases with: blocked goals, silence, errors
    // Frustration decreases with: success, progress
    let frustration_delta = 0;
    
    if (signals.goal_progress < 0) {
      frustration_delta += Math.abs(signals.goal_progress) * weights.frustration_from_blocked_goals;
    }
    
    // Long silence increases frustration slightly
    if (signals.silence_duration > 60) {
      frustration_delta += Math.min(signals.silence_duration / 600, 1) * weights.frustration_from_silence;
    }
    
    if (signals.error_occurred) {
      frustration_delta += weights.frustration_from_errors;
    }
    
    // Success reduces frustration
    if (signals.reward_signal > 0) {
      frustration_delta -= signals.reward_signal * weights.frustration_decay_from_success;
    }
    
    // === BOUND ALL DELTAS ===
    // Maximum delta per cycle is ±0.15 (prevents wild swings)
    const MAX_DELTA = 0.15;
    
    return {
      fear_delta: Math.max(-MAX_DELTA, Math.min(MAX_DELTA, fear_delta)),
      curiosity_delta: Math.max(-MAX_DELTA, Math.min(MAX_DELTA, curiosity_delta)),
      satisfaction_delta: Math.max(-MAX_DELTA, Math.min(MAX_DELTA, satisfaction_delta)),
      frustration_delta: Math.max(-MAX_DELTA, Math.min(MAX_DELTA, frustration_delta))
    };
  },
  
  /**
   * Extract emotion signals from current system state
   * 
   * This is a HELPER to gather signals from various system components.
   * Call this at the start of each cognitive cycle.
   */
  extractSignals(
    soma: { energy: number; cognitiveLoad: number },
    lastCycleResult: {
      hadError?: boolean;
      hadSuccess?: boolean;
      noveltyScore?: number;
      userFeedback?: 'positive' | 'negative' | 'neutral';
    },
    timings: {
      timeSinceLastInput: number;
      timeSinceLastSuccess: number;
    }
  ): EmotionSignals {
    return {
      prediction_error: lastCycleResult.hadError ? 0.5 : 0,
      prediction_valence: lastCycleResult.hadError ? 'negative' : 
                          lastCycleResult.hadSuccess ? 'positive' : 'neutral',
      cognitive_load: soma.cognitiveLoad / 100,
      novelty: lastCycleResult.noveltyScore ?? 0.1,
      silence_duration: timings.timeSinceLastInput / 1000,
      time_since_success: timings.timeSinceLastSuccess / 1000,
      goal_progress: lastCycleResult.hadSuccess ? 0.2 : 
                     lastCycleResult.hadError ? -0.1 : 0,
      reward_signal: lastCycleResult.hadSuccess ? 0.3 : 
                     lastCycleResult.hadError ? -0.2 : 0,
      threat_level: 0,  // Will be set by semantic analysis
      error_occurred: lastCycleResult.hadError ?? false,
      system_failure: false,
      user_negative_feedback: lastCycleResult.userFeedback === 'negative',
      user_positive_feedback: lastCycleResult.userFeedback === 'positive'
    };
  },
  
  /**
   * Create minimal signals for idle/autonomous cycles
   */
  createIdleSignals(
    cognitiveLoad: number,
    silenceDuration: number
  ): EmotionSignals {
    return {
      ...DEFAULT_EMOTION_SIGNALS,
      cognitive_load: cognitiveLoad / 100,
      silence_duration: silenceDuration / 1000,
      novelty: 0.05  // Idle has low novelty
    };
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

export type { EmotionWeights };
export { DEFAULT_WEIGHTS as DEFAULT_EMOTION_WEIGHTS };
