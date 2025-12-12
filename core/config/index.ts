/**
 * Core Config - Barrel Export
 * 
 * @module core/config
 */

// LEGACY EXPORTS (for backward compatibility)
export { 
  FEATURE_FLAGS, 
  isFeatureEnabled, 
  getAllFeatureFlags,
  setFeatureFlagForTesting 
} from './featureFlags';

export {
  logSystemConfig,
  getConfigSnapshot,
  logFlagChange
} from './startupLogger';

// SYSTEM_CONFIG - SINGLE SOURCE OF TRUTH (NEW)
export {
  SYSTEM_CONFIG,
  // isFeatureEnabled already exported from featureFlags
  getPrismConfig,
  getFactEchoConfig,
  getChemistryConfig,
  getGoalsConfig,
  getRPEConfig,
  getFullConfig,
  setConfigOverride,
  clearConfigOverrides
} from './systemConfig';
