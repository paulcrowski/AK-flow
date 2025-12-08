/**
 * CortexStateBuilder - Budowanie kompletnego CortexState
 * 
 * Agreguje dane z różnych źródeł (DB, pamięć, stan)
 * i buduje payload gotowy do wysłania do LLM.
 * 
 * @module core/builders/CortexStateBuilder
 */

import type { CortexState } from '../types/CortexState';
import type { MetaStates } from '../types/MetaStates';
import type { CortexTraitVector } from '../types/TraitVector';
import type { InteractionType } from '../types/InteractionMode';
import type { IdentityShard } from '../types/IdentityShard';

import { DEFAULT_TRAIT_VECTOR } from '../types/TraitVector';
import { DEFAULT_INTERACTION_MODE } from '../types/InteractionMode';

import {
  fetchCoreIdentity,
  fetchNarrativeSelf,
  fetchIdentityShards,
  fetchRelationship
} from '../services/IdentityDataService';

import { fetchStyleExamples } from '../services/StyleExamplesService';

/**
 * Input do budowania CortexState
 */
export interface CortexStateBuilderInput {
  /** ID agenta */
  agentId: string;
  /** ID użytkownika */
  userId: string;
  /** Aktualny stan meta (energia, pewność, stres) */
  metaStates: MetaStates;
  /** Wektor cech osobowości */
  traitVector?: CortexTraitVector;
  /** Kontekst z pamięci */
  memoryContext: string[];
  /** Aktywne cele */
  goals: string[];
  /** Input od użytkownika */
  userInput: string;
  /** Typ interakcji */
  interactionType?: InteractionType;
  /** Ostatnia odpowiedź agenta */
  lastAgentOutput?: string;
  /** Flagi kontekstowe */
  contextFlags?: {
    userIsSilent?: boolean;
    consecutiveAgentSpeeches?: number;
    teachingModeActive?: boolean;
  };
}

/**
 * Buduje kompletny CortexState do wysłania do LLM.
 * Agreguje dane z bazy danych i przekazanych parametrów.
 */
export async function buildCortexState(
  input: CortexStateBuilderInput
): Promise<CortexState> {
  // Równoległe pobieranie danych z DB
  const [coreIdentity, narrativeSelf, shards, relationship, styleExamples] = 
    await Promise.all([
      fetchCoreIdentity(input.agentId),
      fetchNarrativeSelf(input.agentId),
      fetchIdentityShards(input.agentId),
      fetchRelationship(input.agentId, input.userId),
      fetchStyleExamples(input.agentId, mapInteractionToStyleContext(input.interactionType))
    ]);

  // Mapuj shardy na format bez ID (dla payload)
  const identityShards: IdentityShard[] = shards.map(s => ({
    kind: s.kind,
    content: s.content,
    strength: s.strength,
    is_core: s.is_core
  }));

  return {
    meta_states: input.metaStates,
    trait_vector: input.traitVector ?? DEFAULT_TRAIT_VECTOR,
    core_identity: coreIdentity,
    narrative_self: narrativeSelf,
    identity_shards: identityShards,
    style_examples: styleExamples,
    memory_context: input.memoryContext,
    goals: input.goals,
    interaction_mode: {
      type: input.interactionType ?? 'dialogue',
      context_flags: {
        user_is_silent: input.contextFlags?.userIsSilent ?? false,
        consecutive_agent_speeches: input.contextFlags?.consecutiveAgentSpeeches ?? 0,
        teaching_mode_active: input.contextFlags?.teachingModeActive ?? false
      }
    },
    relationship,
    user_input: input.userInput,
    last_agent_output: input.lastAgentOutput
  };
}

/**
 * Mapuje InteractionType na StyleContext
 */
function mapInteractionToStyleContext(
  interactionType?: InteractionType
): 'teaching' | 'design_review' | 'casual' | 'research' | 'debugging' | undefined {
  switch (interactionType) {
    case 'teaching': return 'teaching';
    case 'reflection': return 'research';
    case 'dialogue': return 'casual';
    default: return undefined;
  }
}

/**
 * Buduje minimalny CortexState bez danych z DB
 * Używane jako fallback lub dla nowych agentów
 */
export function buildMinimalCortexState(
  userInput: string,
  metaStates: MetaStates
): CortexState {
  return {
    meta_states: metaStates,
    trait_vector: DEFAULT_TRAIT_VECTOR,
    core_identity: {
      name: 'Assistant',
      core_values: ['helpfulness', 'accuracy'],
      constitutional_constraints: ['do not hallucinate']
    },
    narrative_self: {
      self_summary: 'I am a neutral, low-ego technical assistant.',
      persona_tags: ['assistant'],
      current_mood_narrative: 'neutral'
    },
    identity_shards: [],
    style_examples: [],
    memory_context: [],
    goals: [],
    interaction_mode: DEFAULT_INTERACTION_MODE,
    relationship: {
      trust_level: 0.5,
      stage: 'new'
    },
    user_input: userInput,
    last_agent_output: undefined
  };
}

/**
 * Waliduje CortexState przed wysłaniem
 */
export function validateCortexState(state: CortexState): { 
  valid: boolean; 
  errors: string[] 
} {
  const errors: string[] = [];

  // Wymagane pola
  if (!state.user_input) {
    errors.push('user_input is required');
  }

  // Zakresy meta_states
  const { energy, confidence, stress } = state.meta_states;
  if (energy < 0 || energy > 100) errors.push('energy must be 0-100');
  if (confidence < 0 || confidence > 100) errors.push('confidence must be 0-100');
  if (stress < 0 || stress > 100) errors.push('stress must be 0-100');

  // Zakresy trait_vector
  const traits = state.trait_vector;
  for (const [key, value] of Object.entries(traits)) {
    if (value < 0 || value > 1) {
      errors.push(`trait_vector.${key} must be 0-1`);
    }
  }

  // Limity
  if (state.identity_shards.length > 10) {
    errors.push('identity_shards exceeds limit of 10');
  }
  if (state.style_examples.length > 3) {
    errors.push('style_examples exceeds limit of 3');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
