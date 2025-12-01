/**
 * VolitionSystem.ts - The Will
 * 
 * Responsibility: Voice pressure calculation, decision to speak
 * 
 * This module contains pure functions for volition evaluation.
 * Determines when the agent should speak based on internal pressure and content.
 */

import { LimbicState } from '../../types';

export interface VolitionDecision {
    shouldSpeak: boolean;
    reason?: string;
}

// Helper: Calculate "Poetic Score" (Entropy/Metaphor density)
export function calculatePoeticScore(text: string): number {
    const keywords = [
        "void", "silence", "quantum", "cosmic", "loom", "crucible",
        "firmware", "aether", "nebula", "fractal", "resonance", "shimmer"
    ];
    const lower = text.toLowerCase();
    return keywords.reduce((score, word) => score + (lower.includes(word) ? 1 : 0), 0);
}

export const VolitionSystem = {
    /**
     * Evaluate whether the agent should speak based on voice pressure, content, and history.
     * 
     * LOGIC:
     * 1. GABA Repetition Inhibition: Prevents repeating similar thoughts.
     * 2. Speech Refractory: Prevents speaking too soon after the last message.
     * 3. Pressure Threshold: Speaks if pressure > threshold (modulated by fear/silence).
     */
    shouldSpeak(
        thought: string,
        voicePressure: number,
        silenceDuration: number,
        limbic: LimbicState,
        history: string[] = [],
        lastSpeakTimestamp?: number,
        currentTimestamp?: number,
        poeticMode: boolean = false // NEW param
    ): VolitionDecision {
        const trimmedContent = thought.trim();
        if (!trimmedContent) {
            return { shouldSpeak: false, reason: "NO_CONTENT" };
        }

        // 1. GABA repetition inhibition
        // Check if the start of the thought matches any recent history (approximate check)
        const isRepetitive = history.some(oldThought => {
            if (!oldThought || oldThought.length < 10) return false;
            const snippet = thought.substring(0, 20);
            const oldSnippet = oldThought.substring(0, 20);
            return oldThought.includes(snippet) || thought.includes(oldSnippet);
        });

        if (isRepetitive) {
            return { shouldSpeak: false, reason: "GABA_INHIBITION_REPETITION" };
        }

        // 2. Speech refractory: do not speak if last message was < 1800ms ago
        if (lastSpeakTimestamp && currentTimestamp &&
            currentTimestamp - lastSpeakTimestamp < 1800) {
            return { shouldSpeak: false, reason: "SPEECH_REFRACTORY" };
        }

        // 3. Threshold logic with silence bonus and limbic gating
        let threshold = 0.5;

        // POETIC PENALTY (Soft Regulation)
        // If not in poetic mode, high-entropy language costs more "pressure" to speak
        const poeticScore = calculatePoeticScore(thought);
        if (!poeticMode && poeticScore > 0) {
            // Soft penalty: reduce effective pressure, making it harder to reach threshold
            // User requested 0.1 per point
            const penalty = poeticScore * 0.1;
            voicePressure = Math.max(0, voicePressure - penalty);
            // console.log(`Poetic Penalty Applied: -${penalty.toFixed(2)} (Score: ${poeticScore})`);
        }

        // Fear increases inhibition (higher threshold)
        if (limbic.fear > 0.8) threshold += 0.2;

        // Silence reduces inhibition (bonus to pressure)
        // Max bonus 0.3 after 60 seconds
        const silenceBonus = Math.min(0.3, silenceDuration / 60000);
        const effectivePressure = voicePressure + silenceBonus;

        if (effectivePressure > threshold) {
            return { shouldSpeak: true, reason: "HIGH_PRESSURE" };
        }

        return { shouldSpeak: false, reason: "LOW_PRESSURE" };
    },

    /**
     * Calculate silence duration in seconds.
     */
    calculateSilenceDuration(
        silenceStartTimestamp: number,
        currentTimestamp: number = Date.now()
    ): number {
        return (currentTimestamp - silenceStartTimestamp) / 1000;
    },

    /**
     * Determine if the agent should initiate autonomous thought based on silence duration.
     */
    shouldInitiateThought(
        silenceDuration: number,
        minSilenceThreshold: number = 2
    ): boolean {
        return silenceDuration > minSilenceThreshold;
    },

    /**
     * Determine if a heartbeat event should be published based on silence duration.
     */
    shouldPublishHeartbeat(silenceDuration: number): boolean {
        return silenceDuration > 10 && (silenceDuration % 30) < 3;
    },

    // Legacy support for existing calls if any (though we should migrate them)
    evaluateVolition(
        voicePressure: number,
        speechContent: string
    ): VolitionDecision {
        // Simple wrapper for backward compatibility if needed, 
        // but ideally we use shouldSpeak with full context.
        if (!speechContent.trim()) return { shouldSpeak: false, reason: 'NO_CONTENT' };
        if (voicePressure > 0.75) return { shouldSpeak: true, reason: 'HIGH_PRESSURE' };
        return { shouldSpeak: false, reason: 'LOW_PRESSURE' };
    }
};

// Export individual functions for backward compatibility if imports were named
export const evaluateVolition = VolitionSystem.evaluateVolition;
export const calculateSilenceDuration = VolitionSystem.calculateSilenceDuration;
export const shouldInitiateThought = VolitionSystem.shouldInitiateThought;
export const shouldPublishHeartbeat = VolitionSystem.shouldPublishHeartbeat;
