/**
 * StyleExample - Wzorzec stylu wypowiedzi
 * 
 * Najlepsze własne wypowiedzi agenta używane jako
 * few-shot examples dla LLM.
 * 
 * @module core/types/StyleExample
 */

/** Kontekst interakcji dla style example */
export type StyleContext = 
  | 'teaching' 
  | 'design_review' 
  | 'casual' 
  | 'research' 
  | 'debugging';

/** Stan emocjonalny podczas wypowiedzi */
export interface StyleEmotionalState {
  confidence: number;  // 0.0-1.0
  energy: number;      // 0.0-1.0
  stress: number;      // 0.0-1.0
}

export interface StyleExample {
  /** Tekst wypowiedzi */
  text: string;
  
  /** Ocena jakości 0-10 */
  rating: number;
  
  /** Stan emocjonalny podczas wypowiedzi */
  emotional_state: StyleEmotionalState;
  
  /** Kontekst w jakim wypowiedź powstała */
  context: StyleContext;
}

/** Maksymalna liczba style examples w payload */
export const MAX_STYLE_EXAMPLES = 3;
