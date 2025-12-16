/**
 * Feature Flags - Kontrola wdrażania nowych funkcji
 * 
 * Pozwala na bezpieczny rollback w przypadku problemów.
 * Każda flaga ma opis i domyślną wartość.
 * 
 * @module core/config/featureFlags
 */

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
    enabled: true,  // ✅ ENABLED - MVP with minimal payload
    description: 'Use new Persona-Less Cortex architecture with stateless LLM',
    addedAt: '2025-12-08',
    experimental: true
  },

  USE_ONE_MIND_PIPELINE: {
    enabled: false,
    description: 'P0 (13/10): ONE MIND – THREE PHASES pipeline (trace+gate+memory+contract)',
    addedAt: '2025-12-16',
    experimental: true
  },

  USE_TRACE_AUTO_INJECT: {
    enabled: false,
    description: 'Auto-inject current traceId into EventBus packets when missing',
    addedAt: '2025-12-16',
    experimental: true
  },

  USE_TRACE_HANDLER_SCOPE: {
    enabled: false,
    description: 'Propagate packet.traceId into TraceContext while executing EventBus handlers (async/UI/background)',
    addedAt: '2025-12-16',
    experimental: true
  },

  USE_TRACE_EXTERNAL_IDS: {
    enabled: false,
    description: 'Generate external traceId for packets emitted outside any active tick scope (UI/async/background)',
    addedAt: '2025-12-16',
    experimental: true
  },

  USE_CONV_SUPABASE_FALLBACK: {
    enabled: false,
    description: 'Fallback: hydrate conversation from Supabase archive when localStorage snapshot is empty',
    addedAt: '2025-12-16',
    experimental: true
  },
  
  USE_CORTEX_STATE_BUILDER: {
    enabled: false,
    description: 'Build CortexState from database instead of hardcoded prompts',
    addedAt: '2025-12-08',
    experimental: true
  },
  
  USE_META_STATE_HOMEOSTASIS: {
    enabled: false,
    description: 'Apply homeostasis to meta-states (energy, confidence, stress)',
    addedAt: '2025-12-08',
    experimental: true
  },
  
  USE_IDENTITY_COHERENCE_CHECK: {
    enabled: false,
    description: 'Check shard coherence before adding new identity shards',
    addedAt: '2025-12-08',
    experimental: true
  },
  
  USE_STYLE_EXAMPLES: {
    enabled: false,
    description: 'Include style examples from past SELF_SPEECH in payload',
    addedAt: '2025-12-08',
    experimental: true
  }
} as const;

/**
 * Eksportowane flagi - proste boolean do użycia w kodzie
 */
export const FEATURE_FLAGS = Object.fromEntries(
  Object.entries(FEATURE_FLAG_DEFINITIONS).map(([key, def]) => [key, def.enabled])
) as Record<keyof typeof FEATURE_FLAG_DEFINITIONS, boolean>;

/**
 * Sprawdza czy flaga jest włączona
 */
export function isFeatureEnabled(flagName: keyof typeof FEATURE_FLAGS): boolean {
  return FEATURE_FLAGS[flagName] ?? false;
}

/**
 * Pobiera wszystkie definicje flag (do debugowania/UI)
 */
export function getAllFeatureFlags(): Record<string, FeatureFlagDefinition> {
  return { ...FEATURE_FLAG_DEFINITIONS };
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
  (FEATURE_FLAGS as Record<string, boolean>)[flagName] = value;
}
