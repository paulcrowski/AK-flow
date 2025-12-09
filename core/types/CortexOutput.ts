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
 * Tool Intent - Strukturalna intencja użycia narzędzia
 * 
 * Myśl generuje INTENCJĘ, nie akcję.
 * Decision Gate decyduje czy wykonać.
 * Speech wykonuje jawnie.
 * 
 * Zgodne z: Kora przedczołowa → Jądra podstawy → Kora ruchowa
 */
export interface ToolIntent {
  /** Typ narzędzia do użycia */
  tool: 'SEARCH' | 'VISUALIZE' | null;
  
  /** Query/prompt dla narzędzia */
  query: string;
  
  /** Powód użycia - introspekcja */
  reason: string;
}

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
  
  /**
   * Strukturalna intencja użycia narzędzia.
   * 
   * ARCHITEKTURA 3-WARSTWOWA:
   * - Myśl (internal_thought): "Potrzebuję danych o X"
   * - Intencja (tool_intent): { tool: 'SEARCH', query: 'X', reason: 'brak danych' }
   * - Akcja (speech_content): "Sprawdzę to. [SEARCH: X]"
   * 
   * Decision Gate waliduje intencję przed wykonaniem.
   */
  tool_intent?: ToolIntent;
}

/** Walidacja CortexOutput */
export function isValidCortexOutput(obj: unknown): obj is CortexOutput {
  if (typeof obj !== 'object' || obj === null) return false;
  
  const o = obj as Record<string, unknown>;
  
  const baseValid = (
    typeof o.internal_thought === 'string' &&
    typeof o.speech_content === 'string' &&
    typeof o.mood_shift === 'object' &&
    o.mood_shift !== null
  );
  
  // tool_intent jest opcjonalne, ale jeśli jest, musi być poprawne
  if (o.tool_intent !== undefined) {
    const ti = o.tool_intent as Record<string, unknown>;
    const toolValid = (
      (ti.tool === 'SEARCH' || ti.tool === 'VISUALIZE' || ti.tool === null) &&
      typeof ti.query === 'string' &&
      typeof ti.reason === 'string'
    );
    return baseValid && toolValid;
  }
  
  return baseValid;
}

/**
 * Walidacja ToolIntent
 */
export function isValidToolIntent(intent: unknown): intent is ToolIntent {
  if (typeof intent !== 'object' || intent === null) return false;
  const ti = intent as Record<string, unknown>;
  return (
    (ti.tool === 'SEARCH' || ti.tool === 'VISUALIZE' || ti.tool === null) &&
    typeof ti.query === 'string' &&
    typeof ti.reason === 'string'
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
