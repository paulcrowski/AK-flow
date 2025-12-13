/**
 * TraitVector - Wektor osobowości agenta
 * 
 * Stabilne cechy charakteru wpływające na styl odpowiedzi.
 * Ewoluują powoli przez TraitEvolutionEngine.
 * 
 * UNIFIED: All TraitVector uses camelCase (socialAwareness, not social_awareness).
 * 
 * @module core/types/TraitVector
 */

import { TraitVector } from '../../types';

/**
 * CortexTraitVector - Alias for TraitVector from types.ts
 * 
 * UNIFIED: Now uses camelCase fields (socialAwareness) to match main TraitVector.
 * This is the Single Source of Truth for personality traits.
 */
export type CortexTraitVector = TraitVector;

/** 
 * Domyślny wektor cech dla nowego agenta.
 * SINGLE SOURCE OF TRUTH - used by kernel/initialState and builders.
 * 
 * Values from original useCognitiveKernel.ts baseline.
 */
export const DEFAULT_TRAIT_VECTOR: Readonly<CortexTraitVector> = {
  arousal: 0.3,
  verbosity: 0.4,
  conscientiousness: 0.8,
  socialAwareness: 0.8,
  curiosity: 0.6
} as const;
