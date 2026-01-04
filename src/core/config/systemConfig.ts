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

export interface AutonomyConfig {
  exploreMinSilenceSec: number;
  actionLogDedupeMs: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// MASTER CONFIG - JEDYNE MIEJSCE DO EDYCJI PRZEŁĄCZNIKÓW
// ═══════════════════════════════════════════════════════════════════════════

export const SYSTEM_CONFIG = {
  // ═══════════════════════════════════════════════════════════════════════════
  // 5 GŁÓWNYCH FLAG (jedyne które można wyłączyć w produkcji)
  // ═══════════════════════════════════════════════════════════════════════════
  mainFeatures: {
    /** MASTER: ONE MIND architecture (trace+gate+memory+contract) */
    ONE_MIND_ENABLED: true,

    /** MASTER: Force evidence from memory/tools (no hallucinations) */
    GROUNDED_MODE: true,

    /** MASTER: Allow autonomous speech without user prompt */
    AUTONOMY_ENABLED: true,

    /** MASTER: Dream consolidation & topic shards */
    DREAM_ENABLED: true,

    /** MASTER: Verbose logging + trace overlay */
    DEBUG_MODE: false,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // SUB-CONFIG: ONE MIND (hardcoded ON when ONE_MIND_ENABLED)
  // ═══════════════════════════════════════════════════════════════════════════
  oneMind: {
    traceAutoInject: true,      // Był: USE_TRACE_AUTO_INJECT
    traceHandlerScope: true,    // Był: USE_TRACE_HANDLER_SCOPE
    traceExternalIds: true,     // Był: USE_TRACE_EXTERNAL_IDS
    traceMissingAlert: false,    // Był: USE_TRACE_MISSING_ALERT
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // SUB-CONFIG: MEMORY (hardcoded ON)
  // ═══════════════════════════════════════════════════════════════════════════
  memory: {
    supabaseFallback: true,       // Był: USE_CONV_SUPABASE_FALLBACK
    recallRecentFallback: true,   // Był: USE_MEMORY_RECALL_RECENT_FALLBACK
    globalRecallDefault: true,    // Był: USE_GLOBAL_RECALL_DEFAULT
    searchKnowledgeChunks: true,  // Był: USE_SEARCH_KNOWLEDGE_CHUNKS
    chunkHomeostasis: true,       // Był: USE_SEARCH_KNOWLEDGE_CHUNK_HOMEOSTASIS
    workspaceHomeostasis: true,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // SUB-CONFIG: CORTEX (minimalPrompt always ON, rest future)
  // ═══════════════════════════════════════════════════════════════════════════
  cortex: {
    minimalPrompt: true,          // Był: USE_MINIMAL_CORTEX_PROMPT (always ON)
    stateBuilder: false,          // Był: USE_CORTEX_STATE_BUILDER (future)
    metaStateHomeostasis: false,  // Był: USE_META_STATE_HOMEOSTASIS (future)
    identityCoherence: false,     // Był: USE_IDENTITY_COHERENCE_CHECK (future)
    styleExamples: false,         // Był: USE_STYLE_EXAMPLES (future)
    unifiedContextPrompt: false,  // New: build UnifiedContext prompt via PromptComposer (flagged)
  },

  // ─────────────────────────────────────────────────────────────────────────
  // LEGACY FEATURE FLAGS (backward compat - do usunięcia po migracji)
  // ─────────────────────────────────────────────────────────────────────────
  features: {
    /** @deprecated Use mainFeatures.ONE_MIND_ENABLED */
    USE_MINIMAL_CORTEX_PROMPT: true,
    /** @deprecated Use mainFeatures.ONE_MIND_ENABLED */
    USE_ONE_MIND_PIPELINE: true,
    /** @deprecated Use oneMind.traceAutoInject */
    USE_TRACE_AUTO_INJECT: true,
    /** @deprecated Use oneMind.traceHandlerScope */
    USE_TRACE_HANDLER_SCOPE: true,
    /** @deprecated Use oneMind.traceExternalIds */
    USE_TRACE_EXTERNAL_IDS: true,
    /** @deprecated Use oneMind.traceMissingAlert */
    USE_TRACE_MISSING_ALERT: true,
    /** @deprecated Use memory.supabaseFallback */
    USE_CONV_SUPABASE_FALLBACK: true,
    /** @deprecated Use cortex.stateBuilder */
    USE_CORTEX_STATE_BUILDER: false,
    /** @deprecated Use cortex.metaStateHomeostasis */
    USE_META_STATE_HOMEOSTASIS: false,
    /** @deprecated Use cortex.identityCoherence */
    USE_IDENTITY_COHERENCE_CHECK: false,
    /** @deprecated Use cortex.styleExamples */
    USE_STYLE_EXAMPLES: false,

    // P0.1.1: Stabilization flags (tools + action-first)
    P011_NORMALIZE_ARTIFACT_REF_ENABLED: true,
    P011_ACTION_FIRST_ENABLED: true,
    P011_FAIL_CLOSED_JSON_ENABLED: false,
    P011_WORK_FIRST_AUTONOMY_ENABLED: true,
    /** @deprecated Use memory.recallRecentFallback */
    USE_MEMORY_RECALL_RECENT_FALLBACK: true,
    /** @deprecated Use memory.searchKnowledgeChunks */
    USE_SEARCH_KNOWLEDGE_CHUNKS: true,
    /** @deprecated Use memory.chunkHomeostasis */
    USE_SEARCH_KNOWLEDGE_CHUNK_HOMEOSTASIS: true,
    /** @deprecated Use memory.globalRecallDefault */
    USE_GLOBAL_RECALL_DEFAULT: true,
    /** @deprecated Use mainFeatures.GROUNDED_MODE */
    USE_GROUNDED_STRICT_MODE: true,
    /** @deprecated Use mainFeatures.DREAM_ENABLED */
    USE_DREAM_TOPIC_SHARDS: true,
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

  siliconBeing: {
    enabled: true,
    chemistryEnabled: false,
    fileScanMaxDepth: 6,
    fileScanMaxCount: 2000
  },

  // ─────────────────────────────────────────────────────────────────────────
  // GOAL SYSTEM
  // ─────────────────────────────────────────────────────────────────────────
  goals: {
    /** Enable goal formation */
    enabled: true,

    /** Minimum silence before considering goal (ms) */
    minSilenceMs: 60_000,

    /** Cooldown after a curiosity goal when the user stayed silent (ms) */
    refractorySilenceMs: 2 * 60_000,

    /** Max goals per hour */
    maxPerHour: 5,
  },

  autonomy: {
    exploreMinSilenceSec: 25,
    actionLogDedupeMs: 5000,
  },

  // TICK COMMITTER (staleness guard for autonomous speech)
  tickCommitter: {
    /** Minimum time since user input before autonomous/goal speech is allowed (ms) */
    userInputStalenessMs: 2000,
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

    /** Base threshold for speaking (normal mode) */
    baseThreshold: 0.3,

    /** Base threshold for speaking (shadow mode - higher = harder to speak) */
    shadowModeBaseThreshold: 0.9,

    /** Narcissism penalty threshold (15% self-reference = boring) */
    narcissismPenaltyThreshold: 0.15,
  },

  // ─────────────────────────────────────────────────────────────────────────
  // VOLITION SYSTEM
  // ─────────────────────────────────────────────────────────────────────────
  volition: {
    /** Base voice pressure threshold for speaking */
    baseVoicePressureThreshold: 0.5,

    /** Additional threshold when fear is high (> 0.8) */
    fearInhibitionBonus: 0.2,

    /** Fear level that triggers inhibition */
    fearInhibitionTrigger: 0.8,

    /** Poetic penalty per score point (when not in poetic mode) */
    poeticPenaltyPerPoint: 0.1,
  },

  // ─────────────────────────────────────────────────────────────────────────
  // LIMBIC SYSTEM (Biological Emotional Regulation)
  // ─────────────────────────────────────────────────────────────────────────
  limbic: {
    /** Max emotional delta per tick - fallback safety net */
    maxMoodShiftDelta: 0.3,

    /** Homeostasis decay factor (0.995 = slow, 0.9 = fast) */
    homeostasisDecayFactor: 0.995,

    /** EMA smoothing alpha (0.4 = 40% new signal, 60% previous) */
    emaSmoothingAlpha: 0.4,

    /** Refractory period in ms (neurons need time to recharge) */
    refractoryPeriodMs: 2000,

    /** Habituation decay per consecutive same-direction shift */
    habituationDecayRate: 0.2,

    // ═══════════════════════════════════════════════════════════════════════
    // BASELINE ATTRACTORS (Tonic Activity - neurons are never "off")
    // ═══════════════════════════════════════════════════════════════════════
    /** Fear baseline - healthy vigilance, not paranoia */
    fearBaseline: 0.05,

    /** Curiosity baseline - always some drive to explore */
    curiosityBaseline: 0.3,

    /** Frustration baseline - zero tolerance is healthy */
    frustrationBaseline: 0.0,

    /** Satisfaction baseline - neutral contentment */
    satisfactionBaseline: 0.5,
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

  // ─────────────────────────────────────────────────────────────────────────
  // RNG (Deterministic Random Number Generator)
  // ─────────────────────────────────────────────────────────────────────────
  rng: {
    /** Seed for deterministic RNG. null = Math.random(), string = deterministic */
    seed: 'debug-test' as string | null,  // TESTING MODE - set to null for production
  },

  // ─────────────────────────────────────────────────────────────────────────
  // CONVERSATION MEMORY MANAGEMENT
  // ─────────────────────────────────────────────────────────────────────────
  conversation: {
    /** Max messages in kernel memory (RAM) */
    maxLength: 50,

    /** Archive to database for full history */
    archiveToDatabase: true,

    /** Truncation strategy */
    truncateStrategy: 'keep-recent' as const,
  },

  // ─────────────────────────────────────────────────────────────────────────
  // SOCIAL DYNAMICS (Soft Homeostasis for Autonomous Speech)
  // ─────────────────────────────────────────────────────────────────────────
  socialDynamics: {
    /** Enable social dynamics gating */
    enabled: true,

    /** Cost increment per speech (multiplied by consecutive count) */
    costPerSpeech: 0.15,

    /** Budget spent per speech */
    budgetPerSpeech: 0.2,

    /** Cost reduction when user responds (multiply factor) */
    userResponseRelief: 0.5,

    /** Budget boost when user responds */
    userResponseBudgetBoost: 0.3,

    /** Decay rate when user present (> 0.5 presence) */
    decayRateUserPresent: 0.95,

    /** Decay rate when user absent */
    decayRateUserAbsent: 0.99,

    /** Budget regeneration per tick */
    budgetRegenPerTick: 0.01,

    /** Time for presence to decay to 0 (ms) */
    presenceDecayTimeMs: 10 * 60 * 1000, // 10 minutes

    /** Minimum budget to allow speech */
    minBudgetToSpeak: 0.2,

    /** Base threshold for speech */
    baseThreshold: 0.6,

    /** Log social dynamics checks */
    logEnabled: true,
  },

  // ─────────────────────────────────────────────────────────────────────────
  // STYLE GUARD (Post-generation filter)
  // ─────────────────────────────────────────────────────────────────────────
  styleGuard: {
    /** Enable StyleGuard filtering - OFF by default to allow personality freedom */
    enabled: false,  // Let personality evolve naturally through conversation

    /** Minimum text length after filtering (below = suppress) */
    minTextLength: 10,

    /** Log when filtering is applied */
    logEnabled: true,
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
export type ExpressionConfig = typeof SYSTEM_CONFIG.expression;
export type SocialDynamicsConfig = typeof SYSTEM_CONFIG.socialDynamics;
export type StyleGuardConfig = typeof SYSTEM_CONFIG.styleGuard;
export type VolitionConfig = typeof SYSTEM_CONFIG.volition;
export type LimbicConfig = typeof SYSTEM_CONFIG.limbic;
export type TickCommitterConfig = typeof SYSTEM_CONFIG.tickCommitter;

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
 * Get expression policy config
 */
export function getExpressionConfig(): ExpressionConfig {
  return SYSTEM_CONFIG.expression;
}

/**
 * Get volition system config
 */
export function getVolitionConfig(): VolitionConfig {
  return SYSTEM_CONFIG.volition;
}

export function getAutonomyConfig(): AutonomyConfig {
  return SYSTEM_CONFIG.autonomy as AutonomyConfig;
}

export function getTickCommitterConfig(): TickCommitterConfig {
  return SYSTEM_CONFIG.tickCommitter;
}

/**
 * Get limbic system config
 */
export function getLimbicConfig(): LimbicConfig {
  return SYSTEM_CONFIG.limbic;
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
