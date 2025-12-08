/**
 * InteractionMode - Tryb interakcji agenta
 * 
 * Określa kontekst w jakim agent operuje
 * i wpływa na jego zachowanie.
 * 
 * @module core/types/InteractionMode
 */

/** Typ trybu interakcji */
export type InteractionType = 
  | 'dialogue'    // Normalna rozmowa
  | 'autonomy'    // Agent działa sam
  | 'dream'       // Konsolidacja nocna
  | 'reflection'  // Autorefleksja
  | 'teaching';   // Tryb nauczania

/** Flagi kontekstowe dla trybu interakcji */
export interface ContextFlags {
  /** Czy użytkownik milczy (> dialogThreshold) */
  user_is_silent: boolean;
  
  /** Ile razy agent mówił bez odpowiedzi usera */
  consecutive_agent_speeches: number;
  
  /** Czy tryb nauczania jest aktywny */
  teaching_mode_active: boolean;
}

export interface InteractionMode {
  /** Aktualny typ interakcji */
  type: InteractionType;
  
  /** Flagi kontekstowe */
  context_flags: ContextFlags;
}

/** Domyślny tryb interakcji */
export const DEFAULT_INTERACTION_MODE: Readonly<InteractionMode> = {
  type: 'dialogue',
  context_flags: {
    user_is_silent: false,
    consecutive_agent_speeches: 0,
    teaching_mode_active: false
  }
} as const;
