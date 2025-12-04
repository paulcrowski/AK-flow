/**
 * thresholds.ts - Shared threshold calculations
 * 
 * Single source of truth for dynamic thresholds used across the system.
 * Eliminates duplication between EventLoop.ts and useCognitiveKernel.ts.
 */

import { NeurotransmitterState } from '../../types';
import { LimbicState } from '../../types';

// Dialog Threshold Constants
const BASE_DIALOG_MS = 60_000;   // 60 seconds base
const MIN_DIALOG_MS = 30_000;   // 30 seconds minimum
const MAX_DIALOG_MS = 180_000;  // 180 seconds maximum

/**
 * Computes dynamic dialog threshold based on agent's internal state.
 * 
 * Higher dopamine/satisfaction = agent waits longer before considering user "silent"
 * Lower dopamine/satisfaction = agent recognizes silence faster
 * 
 * @param neuro - Current neurotransmitter state
 * @param limbic - Current limbic (emotional) state
 * @returns Threshold in milliseconds (30,000 - 180,000)
 */
export function computeDialogThreshold(
    neuro: NeurotransmitterState,
    limbic: LimbicState
): number {
    // Formula: base * (1 + dopamine/200 + satisfaction/5)
    // At dopamine=100, satisfaction=1: factor = 1 + 0.5 + 0.2 = 1.7 → 102s
    // At dopamine=50, satisfaction=0.5: factor = 1 + 0.25 + 0.1 = 1.35 → 81s
    // At dopamine=0, satisfaction=0: factor = 1 → 60s
    const factor = 1 + neuro.dopamine / 200 + limbic.satisfaction / 5;
    const threshold = BASE_DIALOG_MS * factor;
    return Math.max(MIN_DIALOG_MS, Math.min(MAX_DIALOG_MS, threshold));
}

/**
 * Determines if user is considered "silent" based on dynamic threshold.
 * 
 * @param lastUserInteractionAt - Timestamp of last user input
 * @param neuro - Current neurotransmitter state
 * @param limbic - Current limbic state
 * @param now - Current timestamp (default: Date.now())
 * @returns true if user has been silent longer than dynamic threshold
 */
export function isUserSilent(
    lastUserInteractionAt: number,
    neuro: NeurotransmitterState,
    limbic: LimbicState,
    now: number = Date.now()
): boolean {
    const timeSinceLastInput = now - lastUserInteractionAt;
    const threshold = computeDialogThreshold(neuro, limbic);
    return timeSinceLastInput > threshold;
}

// Export constants for testing/debugging
export const DIALOG_THRESHOLDS = {
    BASE_MS: BASE_DIALOG_MS,
    MIN_MS: MIN_DIALOG_MS,
    MAX_MS: MAX_DIALOG_MS
} as const;
