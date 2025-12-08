/**
 * MinimalCortexStateBuilder - Lekki builder dla MVP
 * 
 * FAZA 1: Tylko lokalne dane, zero DB queries w hot path.
 * Tożsamość cachowana, nie pobierana przy każdym zapytaniu.
 * 
 * @module core/builders/MinimalCortexStateBuilder
 */

import type { CortexState } from '../types/CortexState';
import type { MetaStates } from '../types/MetaStates';
import type { CortexTraitVector } from '../types/TraitVector';
import type { CoreIdentity } from '../types/CoreIdentity';
import { DEFAULT_TRAIT_VECTOR } from '../types/TraitVector';
import { DEFAULT_INTERACTION_MODE } from '../types/InteractionMode';
import { DEFAULT_RELATIONSHIP } from '../types/Relationship';

// ═══════════════════════════════════════════════════════════════
// CACHE - Tożsamość ładowana RAZ, nie przy każdym zapytaniu
// ═══════════════════════════════════════════════════════════════

import type { IdentityShard } from '../types/IdentityShard';

interface CachedIdentity {
  coreIdentity: CoreIdentity;
  traitVector: CortexTraitVector;
  /** Top 3 core shards - cached, not fetched per request */
  coreShards: IdentityShard[];
  loadedAt: number;
}

const identityCache = new Map<string, CachedIdentity>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minut

/**
 * Ustawia tożsamość w cache (wywoływane przy starcie sesji)
 * 
 * @param coreShards - Top 3 core shards (is_core=true, sorted by strength)
 */
export function setCachedIdentity(
  agentId: string,
  identity: CoreIdentity,
  traits: CortexTraitVector,
  coreShards: IdentityShard[] = []
): void {
  identityCache.set(agentId, {
    coreIdentity: identity,
    traitVector: traits,
    coreShards: coreShards.slice(0, 3), // Max 3 core shards
    loadedAt: Date.now()
  });
  console.log(`[MinimalCortex] Identity cached for ${identity.name} with ${coreShards.length} core shards`);
}

/**
 * Pobiera tożsamość z cache
 */
function getCachedIdentity(agentId: string): CachedIdentity | null {
  const cached = identityCache.get(agentId);
  if (!cached) return null;
  
  // Check TTL
  if (Date.now() - cached.loadedAt > CACHE_TTL_MS) {
    identityCache.delete(agentId);
    return null;
  }
  
  return cached;
}

/**
 * Czyści cache (np. przy wylogowaniu)
 */
export function clearIdentityCache(agentId?: string): void {
  if (agentId) {
    identityCache.delete(agentId);
  } else {
    identityCache.clear();
  }
}

// ═══════════════════════════════════════════════════════════════
// MINIMAL BUILDER - Zero DB w hot path
// ═══════════════════════════════════════════════════════════════

export interface MinimalBuilderInput {
  agentId: string;
  metaStates: MetaStates;
  userInput: string;
  /** Opcjonalny kontekst z ostatnich wiadomości (lokalny, nie z DB) */
  recentContext?: string[];
  /** Ostatnia odpowiedź agenta */
  lastAgentOutput?: string;
}

/**
 * Buduje MINIMALNY CortexState - tylko essentials.
 * 
 * CO ZAWIERA:
 * - meta_states (lokalne)
 * - core_identity (z cache)
 * - trait_vector (z cache)
 * - identity_shards (top 3 core, z cache) ← NEW in v0.2
 * - user_input
 * 
 * CZEGO NIE ZAWIERA (oszczędność tokenów):
 * - style_examples (0 - dodamy w v0.3)
 * - memory_context (tylko recent, nie z DB)
 * - narrative_self (uproszczone)
 * 
 * ZERO zapytań do bazy danych w hot path!
 */
export function buildMinimalCortexState(
  input: MinimalBuilderInput
): CortexState {
  const cached = getCachedIdentity(input.agentId);
  
  // Fallback jeśli brak cache
  const coreIdentity: CoreIdentity = cached?.coreIdentity ?? {
    name: 'Assistant',
    core_values: ['helpfulness', 'accuracy'],
    constitutional_constraints: ['do not hallucinate']
  };
  
  const traitVector = cached?.traitVector ?? DEFAULT_TRAIT_VECTOR;
  
  // Core shards from cache (max 3, ~100 tokens)
  const coreShards = cached?.coreShards ?? [];

  return {
    meta_states: input.metaStates,
    trait_vector: traitVector,
    core_identity: coreIdentity,
    
    // Uproszczone narrative_self - generowane z core_identity
    narrative_self: {
      self_summary: `I am ${coreIdentity.name}, focused on ${coreIdentity.core_values.slice(0, 2).join(' and ')}.`,
      persona_tags: ['assistant'],
      current_mood_narrative: getMoodFromMetaStates(input.metaStates)
    },
    
    // Top 3 core shards from cache (~100 tokens)
    identity_shards: coreShards,
    style_examples: [],
    
    // Tylko lokalny kontekst, nie z DB
    memory_context: input.recentContext ?? [],
    
    // Cele - puste w v0.1
    goals: [],
    
    interaction_mode: DEFAULT_INTERACTION_MODE,
    relationship: DEFAULT_RELATIONSHIP,
    
    user_input: input.userInput,
    last_agent_output: input.lastAgentOutput
  };
}

/**
 * Generuje mood narrative z meta_states
 */
function getMoodFromMetaStates(states: MetaStates): string {
  if (states.energy < 30) return 'tired and low-energy';
  if (states.stress > 70) return 'stressed and cautious';
  if (states.confidence > 70 && states.stress < 30) return 'confident and creative';
  if (states.confidence < 40) return 'uncertain and careful';
  return 'balanced and focused';
}

// ═══════════════════════════════════════════════════════════════
// ESTIMATED TOKEN COST
// ═══════════════════════════════════════════════════════════════

/**
 * Szacowany koszt tokenów dla minimalnego payloadu:
 * 
 * - meta_states: ~30 tokenów
 * - trait_vector: ~40 tokenów
 * - core_identity: ~50 tokenów
 * - narrative_self: ~40 tokenów
 * - identity_shards: ~100 tokenów (3 core shards z cache)
 * - style_examples: 0 (puste)
 * - memory_context: ~50 tokenów (max 3 recent)
 * - interaction_mode: ~20 tokenów
 * - relationship: ~15 tokenów
 * 
 * TOTAL: ~350 tokenów (vs ~1500 w pełnej wersji)
 */
export const ESTIMATED_MINIMAL_TOKENS = 350;
