/**
 * CortexOutput - Odpowiedź z LLM
 * 
 * Strukturyzowany output z inference engine.
 * Zawiera myśl wewnętrzną, mowę i zmiany nastroju.
 * 
 * @module core/types/CortexOutput
 */

// MetaStatesDelta removed - emotions computed by EmotionEngine, not LLM

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
 * FactEcho - LLM echoes back the facts it used
 * 
 * PRISM ARCHITECTURE (13/10):
 * LLM MUST echo back any hard facts it references in speech.
 * Guard compares fact_echo vs hardFacts - NO REGEX needed.
 * 
 * Example:
 * - speech_content: "Mam dwadzieścia trzy procent energii..."
 * - fact_echo: { energy: 23 }
 * 
 * Guard checks: fact_echo.energy === hardFacts.energy
 */
export interface FactEcho {
  energy?: number;
  time?: string;
  dopamine?: number;
  serotonin?: number;
  norepinephrine?: number;
  btc_price?: number;
  [key: string]: string | number | undefined;
}

/**
 * StimulusResponse - LLM's SYMBOLIC assessment (not numeric!)
 * 
 * PIONEER ARCHITECTURE (13/10):
 * LLM classifies the interaction symbolically.
 * EmotionEngine computes actual emotion deltas.
 * 
 * This prevents LLM from controlling system dynamics.
 */
export interface StimulusResponse {
  /** Overall emotional tone */
  valence?: 'positive' | 'negative' | 'neutral';
  
  /** How important is this interaction? */
  salience?: 'low' | 'medium' | 'high';
  
  /** How novel is the input? */
  novelty?: 'routine' | 'interesting' | 'surprising';
  
  /** THREAT DETECTION: Does user threaten deletion/death/shutdown? */
  threat?: 'none' | 'mild' | 'severe';
}

/**
 * Output contract from LLM
 * 
 * ARCHITECTURE CHANGE (13/10):
 * - REMOVED: mood_shift (numeric deltas) - LLM cannot control emotions
 * - ADDED: stimulus_response (symbolic) - LLM can classify, not compute
 */
export interface CortexOutput {
  /** Wewnętrzna myśl agenta (nie pokazywana userowi) */
  internal_thought: string;
  
  /** Treść do wypowiedzenia (pokazywana userowi) */
  speech_content: string;

  /** Provenance of knowledge used for speech_content (observability/UI). */
  knowledge_source?: 'memory' | 'tool' | 'llm' | 'mixed' | 'system';
  
  /** SYMBOLIC assessment of interaction (optional) */
  stimulus_response?: StimulusResponse;
  
  /**
   * PRISM ARCHITECTURE (13/10): Fact Echo
   * 
   * LLM echoes back any hard facts it used in speech_content.
   * Guard compares this against HardFacts - pure JSON comparison.
   * NO REGEX, NO NLP, NO AMBIGUITY.
   * 
   * If LLM says "mam 23% energii" → fact_echo: { energy: 23 }
   * If LLM says "mam dużo energii" → fact_echo: { energy: 23 } (still must echo)
   * 
   * Guard fails if: fact_echo.energy !== hardFacts.energy
   */
  fact_echo?: FactEcho;
  
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
    typeof o.speech_content === 'string'
  );

  if (!baseValid) return false;

  const ks = o.knowledge_source;
  if (ks !== undefined) {
    const ok = ks === 'memory' || ks === 'tool' || ks === 'llm' || ks === 'mixed' || ks === 'system';
    if (!ok) return false;
  }
  
  // tool_intent jest opcjonalne, ale jeśli jest (i nie jest null), musi być poprawne
  if (o.tool_intent !== undefined && o.tool_intent !== null) {
    const ti = o.tool_intent as Record<string, unknown>;
    const toolValid = (
      (ti.tool === 'SEARCH' || ti.tool === 'VISUALIZE' || ti.tool === null) &&
      typeof ti.query === 'string' &&
      typeof ti.reason === 'string'
    );
    return toolValid;
  }
  
  return true;
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
  knowledge_source: 'system',
  stimulus_response: {
    valence: 'negative',
    salience: 'low',
    novelty: 'routine'
  }
} as const;
