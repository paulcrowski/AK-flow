/**
 * CortexOutput - Odpowiedź z LLM
 * 
 * Strukturyzowany output z inference engine.
 * Zawiera myśl wewnętrzną, mowę i zmiany nastroju.
 * 
 * @module core/types/CortexOutput
 */

import type { MetaStatesDelta } from './MetaStates';

/**
 * Output contract from LLM
 */
export interface CortexOutput {
  /** Wewnętrzna myśl agenta (nie pokazywana userowi) */
  internal_thought: string;
  
  /** Treść do wypowiedzenia (pokazywana userowi) */
  speech_content: string;
  
  /** Zmiany nastroju wynikające z interakcji */
  mood_shift: MetaStatesDelta;
}

/** Walidacja CortexOutput */
export function isValidCortexOutput(obj: unknown): obj is CortexOutput {
  if (typeof obj !== 'object' || obj === null) return false;
  
  const o = obj as Record<string, unknown>;
  
  return (
    typeof o.internal_thought === 'string' &&
    typeof o.speech_content === 'string' &&
    typeof o.mood_shift === 'object' &&
    o.mood_shift !== null
  );
}

/** Domyślny output w przypadku błędu parsowania */
export const FALLBACK_CORTEX_OUTPUT: Readonly<CortexOutput> = {
  internal_thought: 'Parse error - using fallback',
  speech_content: 'I encountered an issue processing that. Could you rephrase?',
  mood_shift: {
    energy_delta: -5,
    confidence_delta: -10,
    stress_delta: 5
  }
} as const;
