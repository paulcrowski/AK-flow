/**
 * Core Config - Barrel Export
 * 
 * @module core/config
 */

export { 
  FEATURE_FLAGS, 
  isFeatureEnabled, 
  getAllFeatureFlags,
  setFeatureFlagForTesting 
} from './featureFlags';
