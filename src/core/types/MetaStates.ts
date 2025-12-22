/**
 * MetaStates - "Bateria" agenta
 * 
 * Reprezentuje wewnętrzny stan energetyczny i emocjonalny.
 * Aktualizowane przez MetaStateSystem z homeostazą.
 * 
 * @module core/types/MetaStates
 */

export interface MetaStates {
  /** Poziom energii 0-100. Niska = tryb odpoczynku. */
  energy: number;
  
  /** Pewność siebie 0-100. Wysoka = tryb kreatywny. */
  confidence: number;
  
  /** Poziom stresu 0-100. Wysoki + niska pewność = tryb audytora. */
  stress: number;
}

/** Domyślne wartości baseline dla homeostazy */
export const META_STATES_BASELINE: Readonly<MetaStates> = {
  energy: 70,
  confidence: 60,
  stress: 20
} as const;

/** Delty do aktualizacji meta-states */
export interface MetaStatesDelta {
  energy_delta?: number;
  confidence_delta?: number;
  stress_delta?: number;
}

/** Tryby behawioralne wynikające z meta-states */
export type BehaviorMode = 'creative' | 'cautious' | 'auditor' | 'rest';

/** Interpretacja meta-states na zachowanie */
export interface BehaviorInterpretation {
  mode: BehaviorMode;
  reasoning: string;
}
