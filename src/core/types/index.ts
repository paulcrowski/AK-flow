/**
 * Core Types - Barrel Export
 * 
 * Centralne eksporty wszystkich typów Persona-Less Cortex.
 * Import: import { CortexState, MetaStates, ... } from '@/core/types';
 * 
 * @module core/types
 */

// === Meta States ===
export type { MetaStates, MetaStatesDelta, BehaviorMode, BehaviorInterpretation } from './MetaStates';
export { META_STATES_BASELINE } from './MetaStates';

// === Trait Vector ===
export type { CortexTraitVector } from './TraitVector';
export { DEFAULT_TRAIT_VECTOR } from './TraitVector';

// === Core Identity ===
export type { CoreIdentity } from './CoreIdentity';
export { DEFAULT_CORE_IDENTITY } from './CoreIdentity';

// === Narrative Self ===
export type { NarrativeSelf } from './NarrativeSelf';
export { DEFAULT_NARRATIVE_SELF } from './NarrativeSelf';

// === Identity Shard ===
export type { ShardKind, IdentityShard, IdentityShardWithId } from './IdentityShard';
export { CORE_SHARD_MIN_STRENGTH, MAX_SHARDS_IN_PAYLOAD } from './IdentityShard';

// === Style Example ===
export type { StyleContext, StyleEmotionalState, StyleExample } from './StyleExample';
export { MAX_STYLE_EXAMPLES } from './StyleExample';

// === Interaction Mode ===
export type { InteractionType, ContextFlags, InteractionMode } from './InteractionMode';
export { DEFAULT_INTERACTION_MODE } from './InteractionMode';

// === Relationship ===
export type { RelationshipStage, Relationship } from './Relationship';
export { DEFAULT_RELATIONSHIP, RELATIONSHIP_THRESHOLDS, getRelationshipStage } from './Relationship';

// === Cortex State (Main Contract) ===
export type { CortexState } from './CortexState';
export { MAX_CORTEX_STATE_SIZE } from './CortexState';

// === Cortex Output ===
export type { CortexOutput } from './CortexOutput';
export { isValidCortexOutput, FALLBACK_CORTEX_OUTPUT } from './CortexOutput';

// === Witness Types ===
export type { ChunkRef, Tension, WitnessFrame } from './WitnessTypes';
