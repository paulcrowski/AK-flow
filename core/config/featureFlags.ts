/**
 * Feature Flags - Kontrola wdrażania nowych funkcji
 * 
 * NOWA ARCHITEKTURA (2025-12-17):
 * - 5 GŁÓWNYCH FLAG w mainFeatures (jedyne do produkcyjnego toggle)
 * - SUB-CONFIG w oneMind/memory/cortex (hardcoded gdy parent ON)
 * - LEGACY features[] dla backward compatibility (do usunięcia)
 * 
 * @module core/config/featureFlags
 */

import { SYSTEM_CONFIG } from './systemConfig';

// ═══════════════════════════════════════════════════════════════════════════
// NOWE TYPY
// ═══════════════════════════════════════════════════════════════════════════

export type MainFeature = keyof typeof SYSTEM_CONFIG.mainFeatures;
export type OneMindSub = keyof typeof SYSTEM_CONFIG.oneMind;
export type MemorySub = keyof typeof SYSTEM_CONFIG.memory;
export type CortexSub = keyof typeof SYSTEM_CONFIG.cortex;

const LEGACY_MAIN_MAP: Partial<Record<MainFeature, keyof typeof SYSTEM_CONFIG.features>> = {
  ONE_MIND_ENABLED: 'USE_ONE_MIND_PIPELINE',
  GROUNDED_MODE: 'USE_GROUNDED_STRICT_MODE',
  DREAM_ENABLED: 'USE_DREAM_TOPIC_SHARDS'
};

const LEGACY_ONE_MIND_SUB_MAP: Partial<Record<OneMindSub, keyof typeof SYSTEM_CONFIG.features>> = {
  traceAutoInject: 'USE_TRACE_AUTO_INJECT',
  traceHandlerScope: 'USE_TRACE_HANDLER_SCOPE',
  traceExternalIds: 'USE_TRACE_EXTERNAL_IDS',
  traceMissingAlert: 'USE_TRACE_MISSING_ALERT'
};

const LEGACY_MEMORY_SUB_MAP: Partial<Record<MemorySub, keyof typeof SYSTEM_CONFIG.features>> = {
  supabaseFallback: 'USE_CONV_SUPABASE_FALLBACK',
  recallRecentFallback: 'USE_MEMORY_RECALL_RECENT_FALLBACK',
  globalRecallDefault: 'USE_GLOBAL_RECALL_DEFAULT',
  searchKnowledgeChunks: 'USE_SEARCH_KNOWLEDGE_CHUNKS',
  chunkHomeostasis: 'USE_SEARCH_KNOWLEDGE_CHUNK_HOMEOSTASIS'
};

const LEGACY_CORTEX_SUB_MAP: Partial<Record<CortexSub, keyof typeof SYSTEM_CONFIG.features>> = {
  minimalPrompt: 'USE_MINIMAL_CORTEX_PROMPT',
  stateBuilder: 'USE_CORTEX_STATE_BUILDER',
  metaStateHomeostasis: 'USE_META_STATE_HOMEOSTASIS',
  identityCoherence: 'USE_IDENTITY_COHERENCE_CHECK',
  styleExamples: 'USE_STYLE_EXAMPLES'
};

function legacyFlagValue(key: keyof typeof SYSTEM_CONFIG.features | undefined, fallback: boolean): boolean {
  if (!key) return fallback;
  return (SYSTEM_CONFIG.features as Record<string, boolean>)[key] ?? fallback;
}

// ═══════════════════════════════════════════════════════════════════════════
// NOWE ACCESSORY (5 GŁÓWNYCH FLAG)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Sprawdza główną flagę (5 flag produkcyjnych)
 * @example isMainFeatureEnabled('ONE_MIND_ENABLED')
 */
export function isMainFeatureEnabled(flag: MainFeature): boolean {
  const base = SYSTEM_CONFIG.mainFeatures[flag] ?? false;
  const legacyKey = LEGACY_MAIN_MAP[flag];
  return base && legacyFlagValue(legacyKey, true);
}

/**
 * Sprawdza sub-flagę ONE MIND (zawsze true gdy ONE_MIND_ENABLED)
 * @example isOneMindSubEnabled('traceAutoInject')
 */
export function isOneMindSubEnabled(sub: OneMindSub): boolean {
  if (!SYSTEM_CONFIG.mainFeatures.ONE_MIND_ENABLED) return false;
  const base = SYSTEM_CONFIG.oneMind[sub] ?? false;
  const legacyKey = LEGACY_ONE_MIND_SUB_MAP[sub];
  return base && legacyFlagValue(legacyKey, true);
}

/**
 * Sprawdza sub-flagę MEMORY
 * @example isMemorySubEnabled('supabaseFallback')
 */
export function isMemorySubEnabled(sub: MemorySub): boolean {
  const base = SYSTEM_CONFIG.memory[sub] ?? false;
  const legacyKey = LEGACY_MEMORY_SUB_MAP[sub];
  return base && legacyFlagValue(legacyKey, true);
}

/**
 * Sprawdza sub-flagę CORTEX
 * @example isCortexSubEnabled('minimalPrompt')
 */
export function isCortexSubEnabled(sub: CortexSub): boolean {
  const base = SYSTEM_CONFIG.cortex[sub] ?? false;
  const legacyKey = LEGACY_CORTEX_SUB_MAP[sub];
  return base && legacyFlagValue(legacyKey, true);
}

/**
 * Definicja feature flag z metadanymi
 */
interface FeatureFlagDefinition {
  /** Czy flaga jest włączona */
  enabled: boolean;
  /** Opis flagi */
  description: string;
  /** Data dodania */
  addedAt: string;
  /** Czy flaga jest eksperymentalna */
  experimental: boolean;
}

/**
 * Wszystkie feature flags w systemie
 */
const FEATURE_FLAG_DEFINITIONS: Record<string, FeatureFlagDefinition> = {
  USE_MINIMAL_CORTEX_PROMPT: {
    enabled: SYSTEM_CONFIG.features.USE_MINIMAL_CORTEX_PROMPT,
    description: 'Use new Persona-Less Cortex architecture with stateless LLM',
    addedAt: '2025-12-08',
    experimental: true
  },

  USE_ONE_MIND_PIPELINE: {
    enabled: SYSTEM_CONFIG.features.USE_ONE_MIND_PIPELINE,
    description: 'P0 (13/10): ONE MIND – THREE PHASES pipeline (trace+gate+memory+contract)',
    addedAt: '2025-12-16',
    experimental: true
  },

  USE_TRACE_AUTO_INJECT: {
    enabled: SYSTEM_CONFIG.features.USE_TRACE_AUTO_INJECT,
    description: 'Auto-inject current traceId into EventBus packets when missing',
    addedAt: '2025-12-16',
    experimental: true
  },

  USE_TRACE_HANDLER_SCOPE: {
    enabled: SYSTEM_CONFIG.features.USE_TRACE_HANDLER_SCOPE,
    description: 'Propagate packet.traceId into TraceContext while executing EventBus handlers (async/UI/background)',
    addedAt: '2025-12-16',
    experimental: true
  },

  USE_TRACE_EXTERNAL_IDS: {
    enabled: SYSTEM_CONFIG.features.USE_TRACE_EXTERNAL_IDS,
    description: 'Generate external traceId for packets emitted outside any active tick scope (UI/async/background)',
    addedAt: '2025-12-16',
    experimental: true
  },

  USE_TRACE_MISSING_ALERT: {
    enabled: (SYSTEM_CONFIG.features as Record<string, boolean>).USE_TRACE_MISSING_ALERT ?? false,
    description: 'Emit SYSTEM_ALERT TRACE_MISSING when EventBus auto-injects a missing traceId',
    addedAt: '2025-12-17',
    experimental: true
  },

  USE_CONV_SUPABASE_FALLBACK: {
    enabled: SYSTEM_CONFIG.features.USE_CONV_SUPABASE_FALLBACK,
    description: 'Fallback: hydrate conversation from Supabase archive when localStorage snapshot is empty',
    addedAt: '2025-12-16',
    experimental: true
  },
  
  USE_CORTEX_STATE_BUILDER: {
    enabled: SYSTEM_CONFIG.features.USE_CORTEX_STATE_BUILDER,
    description: 'Build CortexState from database instead of hardcoded prompts',
    addedAt: '2025-12-08',
    experimental: true
  },
  
  USE_META_STATE_HOMEOSTASIS: {
    enabled: SYSTEM_CONFIG.features.USE_META_STATE_HOMEOSTASIS,
    description: 'Apply homeostasis to meta-states (energy, confidence, stress)',
    addedAt: '2025-12-08',
    experimental: true
  },
  
  USE_IDENTITY_COHERENCE_CHECK: {
    enabled: SYSTEM_CONFIG.features.USE_IDENTITY_COHERENCE_CHECK,
    description: 'Check shard coherence before adding new identity shards',
    addedAt: '2025-12-08',
    experimental: true
  },
  
  USE_STYLE_EXAMPLES: {
    enabled: SYSTEM_CONFIG.features.USE_STYLE_EXAMPLES,
    description: 'Include style examples from past SELF_SPEECH in payload',
    addedAt: '2025-12-08',
    experimental: true
  },

  USE_MEMORY_RECALL_RECENT_FALLBACK: {
    enabled: SYSTEM_CONFIG.features.USE_MEMORY_RECALL_RECENT_FALLBACK,
    description: "Fallback: for questions like 'pamiętasz/dzisiaj/wczoraj' also inject recent memories (recallRecent) into RAG",
    addedAt: '2025-12-17',
    experimental: true
  },

  USE_SEARCH_KNOWLEDGE_CHUNKS: {
    enabled: SYSTEM_CONFIG.features.USE_SEARCH_KNOWLEDGE_CHUNKS,
    description: 'Persist SEARCH results as consolidated knowledge chunks (instead of raw logs)',
    addedAt: '2025-12-17',
    experimental: true
  },

  USE_SEARCH_KNOWLEDGE_CHUNK_HOMEOSTASIS: {
    enabled: SYSTEM_CONFIG.features.USE_SEARCH_KNOWLEDGE_CHUNK_HOMEOSTASIS,
    description: 'Apply homeostasis to SEARCH knowledge chunks: dedupe/cooldown + neural_strength clamp',
    addedAt: '2025-12-17',
    experimental: true
  },

  USE_GLOBAL_RECALL_DEFAULT: {
    enabled: (SYSTEM_CONFIG.features as Record<string, boolean>).USE_GLOBAL_RECALL_DEFAULT ?? false,
    description: 'Always inject a small cross-session global memory baseline (recallRecent) into RAG, with cache+timeout',
    addedAt: '2025-12-17',
    experimental: true
  },

  USE_GROUNDED_STRICT_MODE: {
    enabled: (SYSTEM_CONFIG.features as Record<string, boolean>).USE_GROUNDED_STRICT_MODE ?? false,
    description: 'Strict grounded mode: disallow training-knowledge fallback, prefer memory/tool-only provenance',
    addedAt: '2025-12-17',
    experimental: true
  },

  USE_DREAM_TOPIC_SHARDS: {
    enabled: (SYSTEM_CONFIG.features as Record<string, boolean>).USE_DREAM_TOPIC_SHARDS ?? false,
    description: 'Dream consolidation: store/reinforce topic shards in memory based on repeated conversation themes',
    addedAt: '2025-12-17',
    experimental: true
  }
} as const;

/**
 * Eksportowane flagi - proste boolean do użycia w kodzie
 */
export const FEATURE_FLAGS = Object.fromEntries(
  Object.entries(FEATURE_FLAG_DEFINITIONS).map(([key]) => [key, (SYSTEM_CONFIG.features as Record<string, boolean>)[key] ?? false])
) as Record<keyof typeof FEATURE_FLAG_DEFINITIONS, boolean>;

// ═══════════════════════════════════════════════════════════════════════════
// LEGACY ACCESSOR (backward compat - stopniowo migrować do nowych)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * @deprecated Użyj isMainFeatureEnabled(), isOneMindSubEnabled(), isMemorySubEnabled() lub isCortexSubEnabled()
 * Sprawdza czy legacy flaga jest włączona (dla backward compatibility)
 */
export function isFeatureEnabled(flagName: keyof typeof FEATURE_FLAGS): boolean {
  const key = flagName as unknown as string;
  return (SYSTEM_CONFIG.features as Record<string, boolean>)[key] ?? false;
}

/**
 * Pobiera wszystkie definicje flag (do debugowania/UI)
 */
export function getAllFeatureFlags(): Record<string, FeatureFlagDefinition> {
  const flags: Record<string, FeatureFlagDefinition> = {};
  for (const [key, def] of Object.entries(FEATURE_FLAG_DEFINITIONS)) {
    flags[key] = {
      ...def,
      enabled: (SYSTEM_CONFIG.features as Record<string, boolean>)[key] ?? def.enabled
    };
  }
  return flags;
}

/**
 * Runtime override dla testów (nie używać w produkcji)
 */
export function setFeatureFlagForTesting(
  flagName: keyof typeof FEATURE_FLAGS, 
  value: boolean
): void {
  if (process.env.NODE_ENV !== 'test') {
    console.warn('[FeatureFlags] setFeatureFlagForTesting should only be used in tests');
  }
  const key = flagName as unknown as string;
  (SYSTEM_CONFIG.features as Record<string, boolean>)[key] = value;
  (FEATURE_FLAGS as Record<string, boolean>)[key] = value;
}
