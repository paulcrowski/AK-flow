// core/constants.ts - Central timing & metabolic constants for cognitive loop

export const VISUAL_BASE_COOLDOWN_MS = 60000; // 1 minute base cooldown

// Biological clock intervals
export const MIN_TICK_MS = 1000;
export const MAX_TICK_MS = 15000;
export const AWAKE_TICK_MS = 3000;
export const SLEEP_TICK_MS = 4000;
export const WAKE_TRANSITION_TICK_MS = 2000;

// Soma / metabolism
export const METABOLIC_SLEEP_TRIGGER_ENERGY = 20; // Energy < 20 => sleep
export const METABOLIC_WAKE_TRIGGER_ENERGY = 95;  // Energy >= 95 => wake
export const METABOLIC_AWAKE_DRAIN_RATE = 0.1;    // base drain per tick
export const METABOLIC_SLEEP_REGEN_RATE = 7;      // regen per tick

// Visual energy cost
export const VISUAL_ENERGY_COST_BASE = 15;

// Volition / speech
export const SPEECH_REFRACTORY_MS = 1800;
export const SILENCE_BONUS_MAX = 0.3;
export const SILENCE_BONUS_FULL_SECONDS = 60; // 60s -> max bonus
