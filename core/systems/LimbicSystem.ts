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

/**
 * Update emotional state based on stimulus.
 * 
 * CRITICAL LOGIC (Preserved from useCognitiveKernel.ts):
 * - All emotional values are clamped to [0, 1] range
 * - Surprise increases both fear and curiosity
 * - Deltas are additive
 * 
 * @param currentLimbic - Current limbic state
 * @param stimulus - Emotional stimulus with optional deltas
 * @returns Updated limbic state
 */
export const updateEmotionalState = (
    currentLimbic: LimbicState,
    stimulus: EmotionalStimulus
): LimbicState => {
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
};

/**
 * Apply mood shift from Cortex response.
 * 
 * LOGIC (Preserved from useCognitiveKernel.ts):
 * - Used when processing Cortex responses with moodShift data
 * 
 * @param currentLimbic - Current limbic state
 * @param moodShift - Mood shift deltas from Cortex
 * @returns Updated limbic state
 */
export const applyMoodShift = (
    currentLimbic: LimbicState,
    moodShift: { fear_delta?: number; curiosity_delta?: number }
): LimbicState => {
    return updateEmotionalState(currentLimbic, {
        fear_delta: moodShift.fear_delta,
        curiosity_delta: moodShift.curiosity_delta
    });
};

/**
 * Apply emotional response to speech output.
 * 
 * LOGIC (Preserved from useCognitiveKernel.ts):
 * - Speaking reduces curiosity by 0.2
 * - Speaking increases satisfaction by 0.1
 * 
 * @param currentLimbic - Current limbic state
 * @returns Updated limbic state
 */
export const applySpeechResponse = (currentLimbic: LimbicState): LimbicState => {
    return {
        ...currentLimbic,
        curiosity: Math.max(0.2, currentLimbic.curiosity - 0.2),
        satisfaction: Math.min(1, currentLimbic.satisfaction + 0.1)
    };
};

/**
 * Apply emotional cost of visual generation.
 * 
 * LOGIC (Preserved from useCognitiveKernel.ts):
 * - Visual generation increases satisfaction (diminishing returns with binge count)
 * - Visual generation reduces curiosity significantly
 * 
 * @param currentLimbic - Current limbic state
 * @param bingeCount - Number of consecutive visual generations
 * @returns Updated limbic state
 */
export const applyVisualEmotionalCost = (
    currentLimbic: LimbicState,
    bingeCount: number
): LimbicState => {
    const satisfactionGain = 0.2 / (bingeCount + 1);

    return {
        ...currentLimbic,
        satisfaction: Math.min(1, currentLimbic.satisfaction + satisfactionGain),
        curiosity: Math.max(0.1, currentLimbic.curiosity - 0.5)
    };
};

/**
 * Set a specific emotional value directly (used for debug overrides).
 * 
 * @param currentLimbic - Current limbic state
 * @param key - Emotional dimension to set
 * @param value - Value to set (will be clamped to [0, 1])
 * @returns Updated limbic state
 */
export const setEmotionalValue = (
    currentLimbic: LimbicState,
    key: keyof LimbicState,
    value: number
): LimbicState => {
    return {
        ...currentLimbic,
        [key]: Math.max(0, Math.min(1, value))
    };
};
