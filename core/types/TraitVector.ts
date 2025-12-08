/**
 * TraitVector - Wektor osobowości agenta
 * 
 * Stabilne cechy charakteru wpływające na styl odpowiedzi.
 * Ewoluują powoli przez TraitEvolutionEngine.
 * 
 * @module core/types/TraitVector
 */

export interface CortexTraitVector {
  /** Gadatliwość 0.0-1.0. Wysoka = dłuższe odpowiedzi. */
  verbosity: number;
  
  /** Pobudzenie 0.0-1.0. Jak łatwo system się "nakręca". */
  arousal: number;
  
  /** Sumienność 0.0-1.0. Fokus na zadanie vs dygresje. */
  conscientiousness: number;
  
  /** Świadomość społeczna 0.0-1.0. Wrażliwość na powtórzenia. */
  social_awareness: number;
  
  /** Ciekawość 0.0-1.0. Nagroda za nowość vs znane ścieżki. */
  curiosity: number;
}

/** Domyślny wektor cech dla nowego agenta */
export const DEFAULT_TRAIT_VECTOR: Readonly<CortexTraitVector> = {
  verbosity: 0.4,
  arousal: 0.3,
  conscientiousness: 0.7,
  social_awareness: 0.6,
  curiosity: 0.5
} as const;
