/**
 * LimbicSystem.ts - The Emotions
 * 
 * Responsibility: Fear/Curiosity updates, emotional state transitions
 * 
 * This module contains pure functions for emotional state management.
 * All functions apply deltas with proper clamping to maintain 0-1 range.
 * 
 * BIOLOGICAL INSPIRATION:
 * - EMA smoothing (like synaptic integration)
 * - Refractory period (neurons need time to recharge)
 * - Habituation (repeated stimuli have diminishing effect)
 */

import { LimbicState } from '../../types';
import { getLimbicConfig } from '../config/systemConfig';

export interface EmotionalStimulus {
    surprise?: number;
    fear_delta?: number;
    curiosity_delta?: number;
    satisfaction_delta?: number;
    frustration_delta?: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// BIOLOGICAL EMOTIONAL DAMPER - Stateful synaptic memory
// ═══════════════════════════════════════════════════════════════════════════

interface SynapticMemory {
    lastFearDelta: number;
    lastCuriosityDelta: number;
    lastShiftTime: number;
    consecutiveSameDirection: { fear: number; curiosity: number };
}

// Module-level synaptic memory (like long-term potentiation state)
let synapticMemory: SynapticMemory = {
    lastFearDelta: 0,
    lastCuriosityDelta: 0,
    lastShiftTime: 0,
    consecutiveSameDirection: { fear: 0, curiosity: 0 }
};

/**
 * Reset synaptic memory (e.g., on kernel reset)
 */
export function resetSynapticMemory(): void {
    synapticMemory = {
        lastFearDelta: 0,
        lastCuriosityDelta: 0,
        lastShiftTime: 0,
        consecutiveSameDirection: { fear: 0, curiosity: 0 }
    };
}

/**
 * Biological damping of emotional input.
 * 
 * MECHANISMS:
 * 1. EMA Smoothing - new signal is blended with previous (synaptic integration)
 * 2. Refractory Period - recent shifts reduce sensitivity (neuron recharge)
 * 3. Habituation - same-direction shifts have diminishing returns
 * 
 * @param rawDelta - Raw delta from LLM
 * @param dimension - 'fear' or 'curiosity'
 * @returns Biologically damped delta
 */
function biologicalDamping(rawDelta: number, dimension: 'fear' | 'curiosity'): number {
    const config = getLimbicConfig();
    const now = Date.now();
    
    // 1. EMA SMOOTHING (α = 0.4 → 40% new, 60% old)
    // Like synaptic integration - signals blend over time
    const alpha = config.emaSmoothingAlpha ?? 0.4;
    const lastDelta = dimension === 'fear' 
        ? synapticMemory.lastFearDelta 
        : synapticMemory.lastCuriosityDelta;
    const smoothedDelta = alpha * rawDelta + (1 - alpha) * lastDelta;
    
    // 2. REFRACTORY PERIOD
    // After recent emotional shift, sensitivity is reduced (like neuron recharge)
    const timeSinceLastShift = now - synapticMemory.lastShiftTime;
    const refractoryMs = config.refractoryPeriodMs ?? 2000; // 2 seconds
    let refractoryFactor = 1.0;
    if (timeSinceLastShift < refractoryMs) {
        // Exponential recovery: 0 at t=0, ~1 at t=refractoryMs
        refractoryFactor = 1 - Math.exp(-3 * timeSinceLastShift / refractoryMs);
    }
    
    // 3. HABITUATION (Synaptic Fatigue)
    // Repeated same-direction shifts have diminishing effect
    const consecutive = synapticMemory.consecutiveSameDirection[dimension];
    const habituationFactor = 1 / (1 + consecutive * 0.2); // 20% reduction per consecutive
    
    // Combined biological damping
    const dampedDelta = smoothedDelta * refractoryFactor * habituationFactor;
    
    // Update synaptic memory
    if (dimension === 'fear') {
        synapticMemory.lastFearDelta = smoothedDelta;
    } else {
        synapticMemory.lastCuriosityDelta = smoothedDelta;
    }
    
    // Track same-direction shifts for habituation
    const sameDirection = (rawDelta > 0 && lastDelta > 0) || (rawDelta < 0 && lastDelta < 0);
    if (sameDirection && Math.abs(rawDelta) > 0.01) {
        synapticMemory.consecutiveSameDirection[dimension]++;
    } else {
        synapticMemory.consecutiveSameDirection[dimension] = 0; // Reset on direction change
    }
    
    synapticMemory.lastShiftTime = now;
    
    return dampedDelta;
}

export const LimbicSystem = {
    /**
     * Update emotional state based on stimulus.
     * 
     * CRITICAL LOGIC (Preserved from useCognitiveKernel.ts):
     * - All emotional values are clamped to [0, 1] range
     * - Surprise increases both fear and curiosity
     * - Deltas are additive
     */
    updateEmotionalState(
        currentLimbic: LimbicState,
        stimulus: EmotionalStimulus
    ): LimbicState {
        let fear = currentLimbic.fear;
        let curiosity = currentLimbic.curiosity;
        let satisfaction = currentLimbic.satisfaction;
        let frustration = currentLimbic.frustration;

        // Apply surprise (affects both fear and curiosity)
        if (stimulus.surprise !== undefined) {
            fear += stimulus.surprise * 0.1;
            curiosity += stimulus.surprise * 0.2;
        }

        // Apply direct deltas
        if (stimulus.fear_delta !== undefined) {
            fear += stimulus.fear_delta;
        }
        if (stimulus.curiosity_delta !== undefined) {
            curiosity += stimulus.curiosity_delta;
        }
        if (stimulus.satisfaction_delta !== undefined) {
            satisfaction += stimulus.satisfaction_delta;
        }
        if (stimulus.frustration_delta !== undefined) {
            frustration += stimulus.frustration_delta;
        }

        // Clamp all values to [0, 1]
        return {
            fear: Math.max(0, Math.min(1, fear)),
            curiosity: Math.max(0, Math.min(1, curiosity)),
            satisfaction: Math.max(0, Math.min(1, satisfaction)),
            frustration: Math.max(0, Math.min(1, frustration))
        };
    },

    /**
     * Apply emotional homeostasis (decay towards baseline).
     * 
     * LOGIC:
     * - Fear, Curiosity, Frustration decay to 0.0
     * - Satisfaction decays to 0.5
     * - Factor 0.995 provides slow, natural cooling
     */
    applyHomeostasis(current: LimbicState): LimbicState {
        const decay = (value: number, target: number) => {
            const factor = 0.995; // slow decay
            const next = value * factor + target * (1 - factor);
            return Math.min(1, Math.max(0, next));
        };

        return {
            fear: decay(current.fear, 0.0),
            curiosity: decay(current.curiosity, 0.0),
            frustration: decay(current.frustration, 0.0),
            satisfaction: decay(current.satisfaction, 0.5)
        };
    },

    /**
     * Apply mood shift from Cortex response.
     * 
     * BIOLOGICAL MODEL (replaces brute-force clamp):
     * 1. EMA Smoothing - blends new signal with previous (synaptic integration)
     * 2. Refractory Period - recent shifts reduce sensitivity (neuron recharge)
     * 3. Habituation - repeated same-direction shifts diminish (synaptic fatigue)
     * 4. Safety Net - final clamp only as last resort
     */
    applyMoodShift(
        currentLimbic: LimbicState,
        moodShift: { fear_delta?: number; curiosity_delta?: number }
    ): LimbicState {
        const config = getLimbicConfig();
        
        // Apply biological damping to raw LLM deltas
        let dampedFear: number | undefined;
        let dampedCuriosity: number | undefined;
        
        if (moodShift.fear_delta !== undefined) {
            dampedFear = biologicalDamping(moodShift.fear_delta, 'fear');
            
            // Log significant damping (for debugging)
            const dampingRatio = Math.abs(dampedFear) / (Math.abs(moodShift.fear_delta) + 0.001);
            if (dampingRatio < 0.5 && Math.abs(moodShift.fear_delta) > 0.1) {
                console.log(`[LimbicSystem] 🧠 BIOLOGICAL_DAMPING fear: ${moodShift.fear_delta.toFixed(3)} → ${dampedFear.toFixed(3)} (${(dampingRatio * 100).toFixed(0)}%)`);
            }
        }
        
        if (moodShift.curiosity_delta !== undefined) {
            dampedCuriosity = biologicalDamping(moodShift.curiosity_delta, 'curiosity');
            
            const dampingRatio = Math.abs(dampedCuriosity) / (Math.abs(moodShift.curiosity_delta) + 0.001);
            if (dampingRatio < 0.5 && Math.abs(moodShift.curiosity_delta) > 0.1) {
                console.log(`[LimbicSystem] 🧠 BIOLOGICAL_DAMPING curiosity: ${moodShift.curiosity_delta.toFixed(3)} → ${dampedCuriosity.toFixed(3)} (${(dampingRatio * 100).toFixed(0)}%)`);
            }
        }
        
        // Safety net: final clamp (should rarely trigger with biological damping)
        const MAX_DELTA = config.maxMoodShiftDelta;
        const safeClamp = (delta: number | undefined): number | undefined => {
            if (delta === undefined) return undefined;
            const clamped = Math.max(-MAX_DELTA, Math.min(MAX_DELTA, delta));
            if (clamped !== delta) {
                console.warn(`[LimbicSystem] ⚠️ SAFETY_NET_CLAMP: ${delta.toFixed(3)} → ${clamped.toFixed(3)}`);
            }
            return clamped;
        };
        
        return LimbicSystem.updateEmotionalState(currentLimbic, {
            fear_delta: safeClamp(dampedFear),
            curiosity_delta: safeClamp(dampedCuriosity)
        });
    },

    /**
     * Apply emotional response to speech output.
     */
    applySpeechResponse(currentLimbic: LimbicState): LimbicState {
        return {
            ...currentLimbic,
            satisfaction: Math.min(1, currentLimbic.satisfaction + 0.1),
            curiosity: Math.max(0, currentLimbic.curiosity - 0.2) // Curiosity satisfied by speaking
        };
    },

    /**
     * Apply emotional cost of visual generation.
     */
    applyVisualEmotionalCost(
        currentLimbic: LimbicState,
        bingeCount: number
    ): LimbicState {
        const satisfactionGain = 0.2 / (bingeCount + 1);

        return {
            ...currentLimbic,
            satisfaction: Math.min(1, currentLimbic.satisfaction + satisfactionGain),
            curiosity: Math.max(0.1, currentLimbic.curiosity - 0.5)
        };
    },

    /**
     * Apply cost for poetic/abstract thinking (High Entropy Tax).
     * Reduces energy and slightly impacts satisfaction (cognitive load).
     */
    applyPoeticCost(state: LimbicState, score: number): LimbicState {
        if (score <= 0) return state;

        // Energy cost: 1.0 per poetic point (Softened from 2.0)
        // Satisfaction cost: 0.03 per point (Softened from 0.05)
        // This makes "hallucinating" tiring but not forbidden.
        return {
            ...state,
            satisfaction: Math.max(0, state.satisfaction - (score * 0.03)),
            frustration: Math.min(1, state.frustration + (score * 0.01)) // Slight frustration from complexity
        };
    },

    /**
     * Set a specific emotional value directly (used for debug overrides).
     */
    setEmotionalValue(
        currentLimbic: LimbicState,
        key: keyof LimbicState,
        value: number
    ): LimbicState {
        return {
            ...currentLimbic,
            [key]: Math.max(0, Math.min(1, value))
        };
    }
};

// Export individual functions for backward compatibility
export const updateEmotionalState = LimbicSystem.updateEmotionalState;
export const applyMoodShift = LimbicSystem.applyMoodShift;
export const applySpeechResponse = LimbicSystem.applySpeechResponse;
export const applyVisualEmotionalCost = LimbicSystem.applyVisualEmotionalCost;
export const setEmotionalValue = LimbicSystem.setEmotionalValue;
export const applyHomeostasis = LimbicSystem.applyHomeostasis;
export const applyPoeticCost = LimbicSystem.applyPoeticCost;
