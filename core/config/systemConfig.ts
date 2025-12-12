/**
 * SystemConfig - SINGLE SOURCE OF TRUTH dla wszystkich przełączników
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 * ALARM 3 FIX: Centralizacja konfiguracji
 * 
 * ZASADA: Wszystkie przełączniki w JEDNYM miejscu.
 * Moduły IMPORTUJĄ stąd, NIE definiują własnych.
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * @module core/config/systemConfig
 */

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface FeatureFlagConfig {
  enabled: boolean;
  description: string;
  addedAt: string;
  experimental: boolean;
}

export interface ModuleConfig {
  enabled: boolean;
  logEnabled: boolean;
  [key: string]: unknown;
}

// ═══════════════════════════════════════════════════════════════════════════
// MASTER CONFIG - JEDYNE MIEJSCE DO EDYCJI PRZEŁĄCZNIKÓW
// ═══════════════════════════════════════════════════════════════════════════

export const SYSTEM_CONFIG = {
  // ─────────────────────────────────────────────────────────────────────────
  // FEATURE FLAGS (Główne funkcje)
  // ─────────────────────────────────────────────────────────────────────────
  features: {
    /** Persona-Less Cortex - stateless LLM architecture */
    USE_MINIMAL_CORTEX_PROMPT: true,
    
    /** Build CortexState from database (future) */
    USE_CORTEX_STATE_BUILDER: false,
    
    /** Homeostasis dla meta-states */
    USE_META_STATE_HOMEOSTASIS: false,
    
    /** Sprawdzanie koherencji shardów przed dodaniem */
    USE_IDENTITY_COHERENCE_CHECK: false,
    
    /** Style examples w payload */
    USE_STYLE_EXAMPLES: false,
  },

  // ─────────────────────────────────────────────────────────────────────────
  // PRISM (PersonaGuard & Fact Preservation)
  // ─────────────────────────────────────────────────────────────────────────
  prism: {
    /** Enable PersonaGuard checking */
    guardEnabled: true,
    
    /** Enable retry on guard failure */
    retryEnabled: true,
    
    /** Log all guard checks */
    logAllChecks: true,
    
    /** Max retries before giving up */
    maxRetries: 2,
  },

  // ─────────────────────────────────────────────────────────────────────────
  // PRISM PIPELINE (Wrapper)
  // ─────────────────────────────────────────────────────────────────────────
  prismPipeline: {
    /** Enable pipeline */
    enabled: true,
    
    /** Log pipeline activity */
    logEnabled: true,
  },

  // ─────────────────────────────────────────────────────────────────────────
  // FACT ECHO (JSON-based fact validation)
  // ─────────────────────────────────────────────────────────────────────────
  factEcho: {
    /** Enable FactEcho validation */
    enabled: true,
    
    /** Require ALL facts to be echoed (strict mode) */
    strictMode: false,
    
    /** Log all checks */
    logEnabled: true,
    
    /** Soft fail response */
    softFailResponse: 'Przepraszam, muszę się zresetować.',
  },

  // ─────────────────────────────────────────────────────────────────────────
  // CHEMISTRY BRIDGE (Dopamine/Serotonin reactions)
  // ─────────────────────────────────────────────────────────────────────────
  chemistryBridge: {
    /** Enable chemistry reactions to EvaluationBus */
    enabled: false,  // Phase 4: Start disabled
    
    /** Max delta per aggregation window */
    maxDopamineDelta: 10,
    maxSerotoninDelta: 5,
    
    /** Aggregation window in ms */
    aggregationWindowMs: 5000,
    
    /** Baselines */
    dopamineBaseline: 55,
    serotoninBaseline: 60,
    
    /** Log chemistry changes */
    logEnabled: true,
  },

  // ─────────────────────────────────────────────────────────────────────────
  // GOAL SYSTEM
  // ─────────────────────────────────────────────────────────────────────────
  goals: {
    /** Enable goal formation */
    enabled: true,
    
    /** Minimum silence before considering goal (ms) */
    minSilenceMs: 60_000,
    
    /** Max goals per hour */
    maxPerHour: 5,
  },

  // ─────────────────────────────────────────────────────────────────────────
  // RPE (Reward Prediction Error) - Dopamine decay
  // ─────────────────────────────────────────────────────────────────────────
  rpe: {
    /** Dopamine baseline */
    dopamineBaseline: 55,
    
    /** Dopamine floor (never go below) */
    dopamineFloor: 45,
    
    /** Ticks before decay starts */
    decayStartTicks: 2,
    
    /** Max decay per tick */
    maxDecayPerTick: 4,
  },

  // ─────────────────────────────────────────────────────────────────────────
  // EXPRESSION POLICY
  // ─────────────────────────────────────────────────────────────────────────
  expression: {
    /** Novelty threshold for shadow mode speech */
    shadowModeNoveltyThreshold: 0.1,
    
    /** Consecutive speeches before narcissism breaker */
    narcissismBreakerThreshold: 4,
  },

  // ─────────────────────────────────────────────────────────────────────────
  // TELEMETRY & LOGGING
  // ─────────────────────────────────────────────────────────────────────────
  telemetry: {
    /** Log PROMPT_HARDFACTS before LLM calls */
    logPromptHardFacts: true,
    
    /** Log DOPAMINE_TICK every tick */
    logDopamineTick: true,
    
    /** Log identity issues */
    logIdentityIssues: true,
  },
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// TYPE EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

export type SystemConfigType = typeof SYSTEM_CONFIG;
export type FeatureFlags = typeof SYSTEM_CONFIG.features;
export type PrismConfig = typeof SYSTEM_CONFIG.prism;
export type FactEchoConfig = typeof SYSTEM_CONFIG.factEcho;
export type ChemistryConfig = typeof SYSTEM_CONFIG.chemistryBridge;
export type GoalsConfig = typeof SYSTEM_CONFIG.goals;
export type RPEConfig = typeof SYSTEM_CONFIG.rpe;

// ═══════════════════════════════════════════════════════════════════════════
// ACCESSOR FUNCTIONS (Type-safe getters)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Check if a feature is enabled
 */
export function isFeatureEnabled(feature: keyof FeatureFlags): boolean {
  return SYSTEM_CONFIG.features[feature] ?? false;
}

/**
 * Get prism config
 */
export function getPrismConfig(): PrismConfig {
  return SYSTEM_CONFIG.prism;
}

/**
 * Get fact echo config
 */
export function getFactEchoConfig(): FactEchoConfig {
  return SYSTEM_CONFIG.factEcho;
}

/**
 * Get chemistry config
 */
export function getChemistryConfig(): ChemistryConfig {
  return SYSTEM_CONFIG.chemistryBridge;
}

/**
 * Get goals config
 */
export function getGoalsConfig(): GoalsConfig {
  return SYSTEM_CONFIG.goals;
}

/**
 * Get RPE config
 */
export function getRPEConfig(): RPEConfig {
  return SYSTEM_CONFIG.rpe;
}

/**
 * Get full config snapshot (for logging/debugging)
 */
export function getFullConfig(): SystemConfigType {
  return SYSTEM_CONFIG;
}

// ═══════════════════════════════════════════════════════════════════════════
// RUNTIME OVERRIDE (ONLY FOR TESTING)
// ═══════════════════════════════════════════════════════════════════════════

const runtimeOverrides: Partial<Record<string, unknown>> = {};

/**
 * Override config value at runtime (TESTING ONLY)
 */
export function setConfigOverride(path: string, value: unknown): void {
  if (process.env.NODE_ENV !== 'test') {
    console.warn('[SystemConfig] setConfigOverride should only be used in tests!');
  }
  runtimeOverrides[path] = value;
  console.log(`[SystemConfig] OVERRIDE: ${path} = ${value}`);
}

/**
 * Clear all runtime overrides
 */
export function clearConfigOverrides(): void {
  Object.keys(runtimeOverrides).forEach(key => delete runtimeOverrides[key]);
}
