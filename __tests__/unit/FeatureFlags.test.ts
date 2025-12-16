/**
 * FeatureFlags Tests
 * 
 * Testy dla systemu feature flags.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  FEATURE_FLAGS,
  isFeatureEnabled,
  getAllFeatureFlags,
  setFeatureFlagForTesting
} from '../../core/config/featureFlags';

describe('FeatureFlags', () => {
  // Store original values
  const originalFlags = { ...FEATURE_FLAGS };

  afterEach(() => {
    // Restore original values
    Object.assign(FEATURE_FLAGS, originalFlags);
  });

  describe('FEATURE_FLAGS', () => {
    it('should have USE_MINIMAL_CORTEX_PROMPT flag', () => {
      expect('USE_MINIMAL_CORTEX_PROMPT' in FEATURE_FLAGS).toBe(true);
    });

    it('should have USE_ONE_MIND_PIPELINE flag', () => {
      expect('USE_ONE_MIND_PIPELINE' in FEATURE_FLAGS).toBe(true);
    });

    it('should have USE_CORTEX_STATE_BUILDER flag', () => {
      expect('USE_CORTEX_STATE_BUILDER' in FEATURE_FLAGS).toBe(true);
    });

    it('should have USE_META_STATE_HOMEOSTASIS flag', () => {
      expect('USE_META_STATE_HOMEOSTASIS' in FEATURE_FLAGS).toBe(true);
    });

    it('should have MVP flag enabled, others disabled', () => {
      expect(FEATURE_FLAGS.USE_MINIMAL_CORTEX_PROMPT).toBe(true); // MVP enabled
      expect(FEATURE_FLAGS.USE_ONE_MIND_PIPELINE).toBe(false);
      expect(FEATURE_FLAGS.USE_CORTEX_STATE_BUILDER).toBe(false);
    });
  });

  describe('isFeatureEnabled', () => {
    it('should return true for MVP flag', () => {
      expect(isFeatureEnabled('USE_MINIMAL_CORTEX_PROMPT')).toBe(true);
    });

    it('should return correct value after testing override', () => {
      setFeatureFlagForTesting('USE_MINIMAL_CORTEX_PROMPT', false);
      expect(isFeatureEnabled('USE_MINIMAL_CORTEX_PROMPT')).toBe(false);
    });
  });

  describe('getAllFeatureFlags', () => {
    it('should return all flag definitions', () => {
      const flags = getAllFeatureFlags();
      
      expect(flags.USE_MINIMAL_CORTEX_PROMPT).toBeDefined();
      expect(flags.USE_MINIMAL_CORTEX_PROMPT.description).toBeTruthy();
      expect(flags.USE_MINIMAL_CORTEX_PROMPT.addedAt).toBeTruthy();
    });

    it('should return a copy, not the original', () => {
      const flags1 = getAllFeatureFlags();
      const flags2 = getAllFeatureFlags();
      
      expect(flags1).not.toBe(flags2);
    });
  });

  describe('setFeatureFlagForTesting', () => {
    it('should update flag value', () => {
      // MVP flag is enabled by default, test toggling it off
      expect(FEATURE_FLAGS.USE_MINIMAL_CORTEX_PROMPT).toBe(true);
      
      setFeatureFlagForTesting('USE_MINIMAL_CORTEX_PROMPT', false);
      
      expect(FEATURE_FLAGS.USE_MINIMAL_CORTEX_PROMPT).toBe(false);
    });

    it('should allow toggling back', () => {
      setFeatureFlagForTesting('USE_MINIMAL_CORTEX_PROMPT', true);
      setFeatureFlagForTesting('USE_MINIMAL_CORTEX_PROMPT', false);
      
      expect(FEATURE_FLAGS.USE_MINIMAL_CORTEX_PROMPT).toBe(false);
    });
  });
});
