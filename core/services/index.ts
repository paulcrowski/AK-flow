/**
 * Core Services - Barrel Export
 * 
 * @module core/services
 */

// === Meta State Service ===
export {
  updateMetaStates,
  interpretMetaStates,
  createDefaultMetaStates,
  needsRest,
  type MetaStateConfig
} from './MetaStateService';

// === Style Examples Service ===
export {
  fetchStyleExamples,
  saveStyledSpeech
} from './StyleExamplesService';

// === Identity Coherence Service ===
export {
  buildCoherencePrompt,
  parseCoherenceResponse,
  quickCoherenceCheck,
  type CoherenceResult,
  type CoherenceCheckInput
} from './IdentityCoherenceService';

// === Identity Data Service ===
export {
  fetchCoreIdentity,
  upsertCoreIdentity,
  fetchNarrativeSelf,
  upsertNarrativeSelf,
  fetchIdentityShards,
  insertIdentityShard,
  updateShardStrength,
  deleteIdentityShard,
  fetchRelationship,
  upsertRelationship
} from './IdentityDataService';

// === Identity Consolidation Service ===
export {
  consolidateIdentity,
  type ConsolidationInput,
  type IdentityConsolidationResult
} from './IdentityConsolidationService';

// === Logger Service ===
export {
  createLogger,
  shouldLogDopamineTick
} from './LoggerService';
