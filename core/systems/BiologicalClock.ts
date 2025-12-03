/**
 * BiologicalClock.ts - The Heart
 * 
 * Responsibility: setTimeout loop management, Time Dilation math
 * 
 * This module contains pure functions for tick interval calculation.
 * Manages the timing of the cognitive loop based on resonance field state.
 */

import { ResonanceField } from '../../types';
import { MIN_TICK_MS, MAX_TICK_MS, AWAKE_TICK_MS, SLEEP_TICK_MS, WAKE_TRANSITION_TICK_MS } from '../constants';

/**
 * Calculate the next tick interval based on resonance field and base interval.
 * 
 * Time Dilation Logic:
 * - timeDilation = 1.0 => Normal speed
 * - timeDilation < 1.0 => Faster (Bullet Time)
 * - timeDilation > 1.0 => Slower (Deep Sleep)
 * 
 * @param resonanceField - Current resonance field state
 * @param baseInterval - Base tick interval in milliseconds
 * @returns Calculated tick interval, clamped to [MIN_TICK_MS, MAX_TICK_MS]
 */
export const calculateNextTick = (
    resonanceField: ResonanceField,
    baseInterval: number
): number => {
    const dilatedInterval = baseInterval * resonanceField.timeDilation;
    return Math.max(MIN_TICK_MS, Math.min(MAX_TICK_MS, dilatedInterval));
};

/**
 * Get default tick interval for awake state.
 * 
 * @returns Default awake tick interval (from constants)
 */
export const getDefaultAwakeTick = (): number => {
    return AWAKE_TICK_MS;
};

/**
 * Get default tick interval for sleep state.
 * 
 * @returns Default sleep tick interval (from constants)
 */
export const getDefaultSleepTick = (): number => {
    return SLEEP_TICK_MS;
};

/**
 * Get default tick interval for wake transition.
 * 
 * @returns Default wake transition tick interval (from constants)
 */
export const getWakeTransitionTick = (): number => {
    return WAKE_TRANSITION_TICK_MS;
};

/**
 * Determine if enough time has passed for a periodic event.
 * 
 * @param lastEventTimestamp - Timestamp of last event (ms)
 * @param intervalMs - Required interval between events (ms)
 * @param currentTimestamp - Current timestamp (ms), defaults to Date.now()
 * @returns True if interval has elapsed
 */
export const hasIntervalElapsed = (
    lastEventTimestamp: number,
    intervalMs: number,
    currentTimestamp: number = Date.now()
): boolean => {
    return (currentTimestamp - lastEventTimestamp) >= intervalMs;
};
