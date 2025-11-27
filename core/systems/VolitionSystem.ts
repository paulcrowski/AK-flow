/**
 * VolitionSystem.ts - The Will
 * 
 * Responsibility: Voice pressure calculation, decision to speak
 * 
 * This module contains pure functions for volition evaluation.
 * Determines when the agent should speak based on internal pressure and content.
 */

export interface VolitionDecision {
    shouldSpeak: boolean;
    reason?: string;
}

/**
 * Evaluate whether the agent should speak based on voice pressure and content.
 * 
 * CRITICAL LOGIC (Preserved from useCognitiveKernel.ts):
 * - Voice pressure > 0.75 AND speech content is not empty => Speak
 * - Otherwise => Remain silent
 * 
 * @param voicePressure - Internal pressure to speak (0-1)
 * @param speechContent - The content to potentially speak
 * @returns VolitionDecision with shouldSpeak flag and optional reason
 */
export const evaluateVolition = (
    voicePressure: number,
    speechContent: string
): VolitionDecision => {
    const trimmedContent = speechContent.trim();

    // No content = no speech
    if (!trimmedContent) {
        return {
            shouldSpeak: false,
            reason: 'NO_CONTENT'
        };
    }

    // High pressure threshold
    if (voicePressure > 0.75) {
        return {
            shouldSpeak: true,
            reason: 'HIGH_PRESSURE'
        };
    }

    // Below threshold
    return {
        shouldSpeak: false,
        reason: 'LOW_PRESSURE'
    };
};

/**
 * Calculate silence duration in seconds.
 * 
 * @param silenceStartTimestamp - Timestamp when silence began (ms)
 * @param currentTimestamp - Current timestamp (ms), defaults to Date.now()
 * @returns Silence duration in seconds
 */
export const calculateSilenceDuration = (
    silenceStartTimestamp: number,
    currentTimestamp: number = Date.now()
): number => {
    return (currentTimestamp - silenceStartTimestamp) / 1000;
};

/**
 * Determine if the agent should initiate autonomous thought based on silence duration.
 * 
 * @param silenceDuration - Duration of silence in seconds
 * @param minSilenceThreshold - Minimum silence before thinking (default: 2s)
 * @returns True if agent should think
 */
export const shouldInitiateThought = (
    silenceDuration: number,
    minSilenceThreshold: number = 2
): boolean => {
    return silenceDuration > minSilenceThreshold;
};

/**
 * Determine if a heartbeat event should be published based on silence duration.
 * 
 * LOGIC (Preserved from useCognitiveKernel.ts):
 * - Silence > 10s AND (silence % 30) < 3 => Publish heartbeat
 * 
 * @param silenceDuration - Duration of silence in seconds
 * @returns True if heartbeat should be published
 */
export const shouldPublishHeartbeat = (silenceDuration: number): boolean => {
    return silenceDuration > 10 && (silenceDuration % 30) < 3;
};
