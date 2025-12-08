/**
 * CortexStateBuilder Tests
 * 
 * Testy dla budowania i walidacji CortexState.
 */

import { describe, it, expect } from 'vitest';
import {
  buildMinimalCortexState,
  validateCortexState
} from '../core/builders/CortexStateBuilder';
import type { CortexState } from '../core/types/CortexState';
import type { MetaStates } from '../core/types/MetaStates';

describe('CortexStateBuilder', () => {
  describe('buildMinimalCortexState', () => {
    it('should create valid minimal state', () => {
      const metaStates: MetaStates = { energy: 70, confidence: 60, stress: 20 };
      const result = buildMinimalCortexState('Hello', metaStates);
      
      expect(result.user_input).toBe('Hello');
      expect(result.meta_states).toEqual(metaStates);
      expect(result.core_identity.name).toBe('Assistant');
      expect(result.identity_shards).toHaveLength(0);
      expect(result.style_examples).toHaveLength(0);
    });

    it('should have default trait vector', () => {
      const metaStates: MetaStates = { energy: 70, confidence: 60, stress: 20 };
      const result = buildMinimalCortexState('Test', metaStates);
      
      expect(result.trait_vector.verbosity).toBe(0.4);
      expect(result.trait_vector.curiosity).toBe(0.5);
    });

    it('should have default interaction mode', () => {
      const metaStates: MetaStates = { energy: 70, confidence: 60, stress: 20 };
      const result = buildMinimalCortexState('Test', metaStates);
      
      expect(result.interaction_mode.type).toBe('dialogue');
      expect(result.interaction_mode.context_flags.user_is_silent).toBe(false);
    });
  });

  describe('validateCortexState', () => {
    const validState: CortexState = {
      meta_states: { energy: 70, confidence: 60, stress: 20 },
      trait_vector: {
        verbosity: 0.4,
        arousal: 0.3,
        conscientiousness: 0.7,
        social_awareness: 0.6,
        curiosity: 0.5
      },
      core_identity: {
        name: 'Test',
        core_values: ['accuracy'],
        constitutional_constraints: []
      },
      narrative_self: {
        self_summary: 'Test agent',
        persona_tags: ['test'],
        current_mood_narrative: 'neutral'
      },
      identity_shards: [],
      style_examples: [],
      memory_context: [],
      goals: [],
      interaction_mode: {
        type: 'dialogue',
        context_flags: {
          user_is_silent: false,
          consecutive_agent_speeches: 0,
          teaching_mode_active: false
        }
      },
      relationship: {
        trust_level: 0.5,
        stage: 'new'
      },
      user_input: 'Hello'
    };

    it('should validate correct state', () => {
      const result = validateCortexState(validState);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject missing user_input', () => {
      const invalid = { ...validState, user_input: '' };
      const result = validateCortexState(invalid);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('user_input is required');
    });

    it('should reject out-of-range meta_states', () => {
      const invalid = {
        ...validState,
        meta_states: { energy: 150, confidence: -10, stress: 50 }
      };
      const result = validateCortexState(invalid);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('energy must be 0-100');
      expect(result.errors).toContain('confidence must be 0-100');
    });

    it('should reject out-of-range trait_vector', () => {
      const invalid = {
        ...validState,
        trait_vector: { ...validState.trait_vector, verbosity: 1.5 }
      };
      const result = validateCortexState(invalid);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('trait_vector.verbosity must be 0-1');
    });

    it('should reject too many identity_shards', () => {
      const invalid = {
        ...validState,
        identity_shards: Array(15).fill({
          kind: 'belief' as const,
          content: 'test',
          strength: 50,
          is_core: false
        })
      };
      const result = validateCortexState(invalid);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('identity_shards exceeds limit of 10');
    });

    it('should reject too many style_examples', () => {
      const invalid = {
        ...validState,
        style_examples: Array(5).fill({
          text: 'test',
          rating: 8,
          emotional_state: { confidence: 0.8, energy: 0.7, stress: 0.2 },
          context: 'casual' as const
        })
      };
      const result = validateCortexState(invalid);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('style_examples exceeds limit of 3');
    });
  });
});
