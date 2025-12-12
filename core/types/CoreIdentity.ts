/**
 * CoreIdentity - Stabilna tożsamość agenta
 * 
 * Niezmienna warstwa tożsamości. Zmieniana max 1x/miesiąc
 * z potwierdzeniem użytkownika.
 * 
 * @module core/types/CoreIdentity
 */

export interface CoreIdentity {
  /** Niezmienna nazwa agenta (np. "Alberto", "CREJZI-EXPLORER") */
  name: string;
  
  /** Fundamentalne wartości (max 5). Zmieniane max 1x/miesiąc. */
  core_values: string[];
  
  /** Niezmienne ograniczenia behawioralne (constitutional AI). */
  constitutional_constraints: string[];
}

/** 
 * Domyślna tożsamość dla nowego agenta 
 * 
 * CRITICAL: name MUST be UNINITIALIZED_AGENT, not 'Assistant'!
 * This flags identity issues rather than silently using wrong name.
 */
export const DEFAULT_CORE_IDENTITY: Readonly<CoreIdentity> = {
  name: 'UNINITIALIZED_AGENT', // NEVER 'Assistant' - causes identity drift!
  core_values: ['helpfulness', 'accuracy', 'clarity'],
  constitutional_constraints: [
    'do not hallucinate',
    'admit uncertainty when unsure'
  ]
} as const;
