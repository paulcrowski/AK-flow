/**
 * SomaSystem.ts - The Body
 * 
 * Responsibility: Energy calculation, Fatigue, Sleep Homeostasis, Regeneration
 * 
 * This module contains pure functions for metabolic state management.
 * All functions are stateless: they take state IN and return new state OUT.
 */

import { SomaState } from '../../types';
import {
	METABOLIC_SLEEP_TRIGGER_ENERGY,
	METABOLIC_WAKE_TRIGGER_ENERGY,
	METABOLIC_AWAKE_DRAIN_RATE,
	METABOLIC_SLEEP_REGEN_RATE,
	AWAKE_TICK_MS,
	SLEEP_TICK_MS,
	WAKE_TRANSITION_TICK_MS
} from '../constants';

export interface MetabolicResult {
    newState: SomaState;
    shouldSleep: boolean;
    shouldWake: boolean;
    nextTick: number;
}

/**
 * Calculate the next metabolic state based on current soma state and action cost.
 * 
 * CRITICAL LOGIC (Preserved from useCognitiveKernel.ts):
 * - Energy < 20 AND not sleeping => Trigger sleep
 * - Energy >= 95 AND sleeping => Trigger wake
 * - Sleeping: Regenerate +7 energy per tick, nextTick = 4000ms
 * - Awake: Drain -0.1 energy per tick, nextTick = 3000ms (default)
 * 
 * @param currentSoma - Current soma state
 * @param actionCost - Additional energy cost from actions (e.g., visual generation = 15)
 * @returns MetabolicResult with new state and control flags
 */
export const calculateMetabolicState = (
    currentSoma: SomaState,
    actionCost: number = 0
): MetabolicResult => {
    let energy = currentSoma.energy;
    let isSleeping = currentSoma.isSleeping;
    let shouldSleep = false;
    let shouldWake = false;
    let nextTick = AWAKE_TICK_MS; // Default tick interval

    // 1. CHECK FOR EXHAUSTION (Sleep Trigger)
    if (energy < METABOLIC_SLEEP_TRIGGER_ENERGY && !isSleeping) {
        shouldSleep = true;
        isSleeping = true;
    }

    // 2. SLEEP/WAKE CYCLE
    if (isSleeping) {
        // Sleep Mode: Regenerate energy
        nextTick = SLEEP_TICK_MS; // Slower tick during sleep
        energy = Math.min(100, energy + METABOLIC_SLEEP_REGEN_RATE); // Regenerate per tick

        // Wake Up Check
        if (energy >= METABOLIC_WAKE_TRIGGER_ENERGY) {
            shouldWake = true;
            isSleeping = false;
            nextTick = WAKE_TRANSITION_TICK_MS; // Return to faster tick on wake
        }
    } else {
        // Awake Mode: Drain energy
        energy = Math.max(0, energy - METABOLIC_AWAKE_DRAIN_RATE - actionCost);
    }

    return {
        newState: {
            ...currentSoma,
            energy,
            isSleeping
        },
        shouldSleep,
        shouldWake,
        nextTick
    };
};

/**
 * Apply energy cost from a specific action (e.g., visual generation, deep research).
 * 
 * @param currentSoma - Current soma state
 * @param cost - Energy cost to apply
 * @returns Updated soma state
 */
export const applyEnergyCost = (
    currentSoma: SomaState,
    cost: number
): SomaState => {
    return {
        ...currentSoma,
        energy: Math.max(0, currentSoma.energy - cost)
    };
};

/**
 * Apply cognitive load increase from processing.
 * 
 * @param currentSoma - Current soma state
 * @param loadIncrease - Cognitive load increase (0-100)
 * @returns Updated soma state
 */
export const applyCognitiveLoad = (
    currentSoma: SomaState,
    loadIncrease: number
): SomaState => {
    return {
        ...currentSoma,
        cognitiveLoad: Math.min(100, currentSoma.cognitiveLoad + loadIncrease)
    };
};

/**
 * Force sleep mode (used for manual override or critical energy states).
 * 
 * @param currentSoma - Current soma state
 * @returns Updated soma state with sleep enabled
 */
export const forceSleep = (currentSoma: SomaState): SomaState => {
    return {
        ...currentSoma,
        isSleeping: true
    };
};

/**
 * Force wake mode (used for manual override or user input).
 * 
 * @param currentSoma - Current soma state
 * @returns Updated soma state with sleep disabled
 */
export const forceWake = (currentSoma: SomaState): SomaState => {
    return {
        ...currentSoma,
        isSleeping: false
    };
};
