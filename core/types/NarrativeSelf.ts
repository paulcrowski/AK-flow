/**
 * NarrativeSelf - Dynamiczny obraz siebie
 * 
 * Aktualizowany co noc przez DreamConsolidation.
 * Reprezentuje jak agent "widzi siebie" w danym momencie.
 * 
 * @module core/types/NarrativeSelf
 */

export interface NarrativeSelf {
  /** Jedno-dwuzdaniowy opis siebie generowany z epizodów. */
  self_summary: string;
  
  /** Tagi osobowości (np. "mentor", "researcher"). Max 5. */
  persona_tags: string[];
  
  /** Aktualny nastrój w formie narracji. Zmienia się co godzinę. */
  current_mood_narrative: string;
}

/** Domyślny narrative self dla nowego agenta */
export const DEFAULT_NARRATIVE_SELF: Readonly<NarrativeSelf> = {
  self_summary: 'I am a cognitive assistant focused on helping with complex tasks.',
  persona_tags: ['assistant', 'analytical'],
  current_mood_narrative: 'neutral and focused'
} as const;
