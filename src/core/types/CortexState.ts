/**
 * CortexState - Główny kontrakt payload do LLM
 * 
 * Kompletny stan wysyłany do stateless inference engine.
 * LLM nie ma wbudowanej tożsamości - wszystko pochodzi z tych danych.
 * 
 * @module core/types/CortexState
 */

import type { MetaStates } from './MetaStates';
import type { CortexTraitVector } from './TraitVector';
import type { CoreIdentity } from './CoreIdentity';
import type { NarrativeSelf } from './NarrativeSelf';
import type { IdentityShard } from './IdentityShard';
import type { StyleExample } from './StyleExample';
import type { InteractionMode } from './InteractionMode';
import type { Relationship } from './Relationship';
import type { HardFacts } from '../../types';

export interface SessionMemorySnapshot {
  sessionsToday: number;
  sessionsYesterday: number;
  sessionsThisWeek: number;
  messagesToday: number;
  lastInteractionAt: string | null;
  recentTopics: string[];
}

/**
 * Główny kontrakt - to idzie do LLM jako JSON
 */
export interface CortexState {
  /** Stan energetyczny/emocjonalny agenta */
  meta_states: MetaStates;
  
  /** Wektor cech osobowości */
  trait_vector: CortexTraitVector;
  
  /** Stabilna tożsamość (nazwa, wartości, ograniczenia) */
  core_identity: CoreIdentity;
  
  /** Dynamiczny obraz siebie */
  narrative_self: NarrativeSelf;
  
  /** Atomowe fragmenty tożsamości (max 10) */
  identity_shards: IdentityShard[];
  
  /** Wzorce stylu wypowiedzi (max 3) */
  style_examples: StyleExample[];
  
  /** Kontekst z pamięci */
  memory_context: string[];
  
  /** Aktywne cele */
  goals: string[];
  
  /** Tryb interakcji */
  interaction_mode: InteractionMode;
  
  /** Relacja z użytkownikiem */
  relationship: Relationship;
  
  /** Input od użytkownika */
  user_input: string;
  
  /** Ostatnia odpowiedź agenta (opcjonalnie) */
  last_agent_output?: string;
  
  /** 
   * HARD FACTS - Immutable facts from kernel (PRISM Architecture 13/10)
   * LLM MUST preserve these literally. Includes: time, date, agentName, energy, etc.
   * This is THE single source of truth for identity and temporal facts.
   */
  hard_facts?: HardFacts;

  /** Session-level memory facts (yesterday/today counts, topics, last interaction) */
  session_memory?: SessionMemorySnapshot;
}

/** Maksymalny rozmiar payload w znakach (safety limit) */
export const MAX_CORTEX_STATE_SIZE = 32000;
