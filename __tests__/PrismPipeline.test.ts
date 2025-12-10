/**
 * PrismPipeline Tests
 * 
 * PRISM ARCHITECTURE (13/10) - Phase 3
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  guardSpeech,
  guardCortexOutput,
  guardLegacyResponse,
  isPrismEnabled,
  enablePipeline,
  disablePipeline,
  PIPELINE_CONFIG
} from '../core/systems/PrismPipeline';
import { evaluationBus } from '../core/systems/EvaluationBus';

describe('PrismPipeline', () => {
  beforeEach(() => {
    evaluationBus.clear();
    enablePipeline();
  });

  afterEach(() => {
    enablePipeline(); // Restore default
  });

  describe('guardSpeech', () => {
    it('passes valid speech with facts', () => {
      const result = guardSpeech('Mam 50% energii.', {
        soma: { energy: 50, cognitiveLoad: 30, isSleeping: false }
      });

      expect(result.guardPassed).toBe(true);
      expect(result.wasModified).toBe(false);
      expect(result.speech).toBe('Mam 50% energii.');
    });

    it('detects identity leak', () => {
      const result = guardSpeech('As an AI, I think...', {
        soma: { energy: 50, cognitiveLoad: 30, isSleeping: false }
      });

      expect(result.guardPassed).toBe(false);
    });

    it('skips when pipeline disabled', () => {
      disablePipeline();

      const result = guardSpeech('As an AI, I have no energy!', {
        soma: { energy: 50, cognitiveLoad: 30, isSleeping: false }
      });

      expect(result.guardPassed).toBe(true);
      expect(result.wasModified).toBe(false);
    });

    it('uses custom agent name', () => {
      const result = guardSpeech('Jestem AK-FLOW.', {
        agentName: 'AK-FLOW'
      });

      expect(result.guardPassed).toBe(true);
    });
  });

  describe('guardCortexOutput', () => {
    it('guards speech_content only', () => {
      const output = {
        internal_thought: 'As an AI, I should think...',  // Should NOT be checked
        speech_content: 'Mam 50% energii.',
        mood_shift: { energy_delta: 0, confidence_delta: 0, stress_delta: 0 }
      };

      const result = guardCortexOutput(output, {
        soma: { energy: 50, cognitiveLoad: 30, isSleeping: false }
      });

      expect(result.guardPassed).toBe(true);
      expect(result.output.internal_thought).toContain('As an AI');  // Unchanged
      expect(result.output.speech_content).toBe('Mam 50% energii.');
    });

    it('modifies speech_content on failure', () => {
      const output = {
        internal_thought: 'Thinking...',
        speech_content: 'As an AI, I have 50% energy.',
        mood_shift: { energy_delta: 0, confidence_delta: 0, stress_delta: 0 }
      };

      const result = guardCortexOutput(output, {
        soma: { energy: 50, cognitiveLoad: 30, isSleeping: false }
      });

      expect(result.guardPassed).toBe(false);
      // Internal thought should be unchanged
      expect(result.output.internal_thought).toBe('Thinking...');
    });
  });

  describe('guardLegacyResponse', () => {
    it('guards text field', () => {
      const response = {
        text: 'Mam 50% energii.',
        thought: 'As an AI...',  // Should NOT be checked
        prediction: 'User will respond',
        moodShift: { fear_delta: 0, curiosity_delta: 0 }
      };

      const result = guardLegacyResponse(response, {
        soma: { energy: 50, cognitiveLoad: 30, isSleeping: false }
      });

      expect(result.guardPassed).toBe(true);
      expect(result.output.text).toBe('Mam 50% energii.');
      expect(result.output.thought).toContain('As an AI');  // Unchanged
    });
  });

  describe('isPrismEnabled', () => {
    it('returns true when enabled', () => {
      enablePipeline();
      expect(isPrismEnabled()).toBe(true);
    });

    it('returns false when disabled', () => {
      disablePipeline();
      expect(isPrismEnabled()).toBe(false);
    });
  });

  describe('EvaluationBus Integration', () => {
    it('emits events on guard check', () => {
      guardSpeech('Mam 50% energii.', {
        soma: { energy: 50, cognitiveLoad: 30, isSleeping: false }
      });

      const metrics = evaluationBus.getMetrics();
      expect(metrics.total_events).toBeGreaterThan(0);
    });
  });
});
