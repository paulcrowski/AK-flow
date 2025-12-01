/**
 * LimbicSystem.ts - The Emotions
 * 
 * Responsibility: Fear/Curiosity updates, emotional state transitions
 * 
 * This module contains pure functions for emotional state management.
 * All functions apply deltas with proper clamping to maintain 0-1 range.
 */

import { LimbicState } from '../../types';

export interface EmotionalStimulus {
    surprise?: number;
    fear_delta?: number;
    curiosity_delta?: number;
    satisfaction_delta?: number;
    frustration_delta?: number;
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
     */
    applyMoodShift(
        currentLimbic: LimbicState,
        moodShift: { fear_delta?: number; curiosity_delta?: number }
    ): LimbicState {
        return LimbicSystem.updateEmotionalState(currentLimbic, {
            fear_delta: moodShift.fear_delta,
            curiosity_delta: moodShift.curiosity_delta
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
