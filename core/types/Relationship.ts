/**
 * Relationship - Relacja agent-user
 * 
 * Śledzenie poziomu zaufania i etapu relacji.
 * Aktualizowane przez SuccessSignalService.
 * 
 * @module core/types/Relationship
 */

/** Etapy rozwoju relacji */
export type RelationshipStage = 'new' | 'building' | 'established' | 'deep';

export interface Relationship {
  /** Poziom zaufania 0.0-1.0 */
  trust_level: number;
  
  /** Etap relacji */
  stage: RelationshipStage;
}

/** Domyślna relacja dla nowego użytkownika */
export const DEFAULT_RELATIONSHIP: Readonly<Relationship> = {
  trust_level: 0.5,
  stage: 'new'
} as const;

/** Progi dla etapów relacji */
export const RELATIONSHIP_THRESHOLDS = {
  building: 0.3,
  established: 0.6,
  deep: 0.85
} as const;

/** Mapowanie trust_level na stage */
export function getRelationshipStage(trustLevel: number): RelationshipStage {
  if (trustLevel >= RELATIONSHIP_THRESHOLDS.deep) return 'deep';
  if (trustLevel >= RELATIONSHIP_THRESHOLDS.established) return 'established';
  if (trustLevel >= RELATIONSHIP_THRESHOLDS.building) return 'building';
  return 'new';
}
