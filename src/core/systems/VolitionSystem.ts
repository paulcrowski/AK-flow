/**
 * VolitionSystem.ts - The Will
 *
 * Responsibility: time-based helpers for silence-driven logic.
 * Speech gating is handled by ExecutiveGate.
 */

export const VolitionSystem = {
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

    /**
     * Lightweight poetic keyword scoring (used by autonomy filtering).
     */
    calculatePoeticScore(text: string): number {
        const keywords = [
            'void', 'silence', 'quantum', 'cosmic', 'loom', 'crucible',
            'firmware', 'aether', 'nebula', 'fractal', 'resonance', 'shimmer'
        ];
        const lower = text.toLowerCase();
        return keywords.reduce((score, word) => score + (lower.includes(word) ? 1 : 0), 0);
    }
};

export const calculateSilenceDuration = VolitionSystem.calculateSilenceDuration;
export const shouldInitiateThought = VolitionSystem.shouldInitiateThought;
export const shouldPublishHeartbeat = VolitionSystem.shouldPublishHeartbeat;
export const calculatePoeticScore = VolitionSystem.calculatePoeticScore;
