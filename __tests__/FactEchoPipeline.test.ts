/**
 * FactEchoPipeline Tests
 * 
 * PRISM ARCHITECTURE (13/10) - Phase 6
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  guardCortexOutputWithFactEcho,
  guardLegacyWithFactEcho,
  enableFactEchoPipeline,
  disableFactEchoPipeline,
  isFactEchoPipelineEnabled,
  setDefaultStrictMode,
  FACT_ECHO_PIPELINE_CONFIG
} from '../core/systems/FactEchoPipeline';
import { CortexOutput } from '../core/types/CortexOutput';
import { evaluationBus } from '../core/systems/EvaluationBus';
import { clearArchitectureIssues } from '../core/systems/PrismMetrics';

describe('FactEchoPipeline', () => {
  beforeEach(() => {
    evaluationBus.clear();
    clearArchitectureIssues();
    enableFactEchoPipeline();
    setDefaultStrictMode(false);
  });

  afterEach(() => {
    enableFactEchoPipeline();
    setDefaultStrictMode(false);
  });

  describe('guardCortexOutputWithFactEcho', () => {
    it('PASS when fact_echo matches hardFacts', () => {
      const output: CortexOutput = {
        internal_thought: 'Thinking...',
        speech_content: 'Mam dwadzieścia trzy procent energii.',
        mood_shift: { energy_delta: 0, confidence_delta: 0, stress_delta: 0 },
        fact_echo: { energy: 23 }
      };

      const result = guardCortexOutputWithFactEcho(output, {
        soma: { energy: 23, cognitiveLoad: 30, isSleeping: false }
      });

      expect(result.guardPassed).toBe(true);
      expect(result.wasModified).toBe(false);
      expect(result.mutatedFacts).toHaveLength(0);
    });

    it('detects fact mutation', () => {
      const output: CortexOutput = {
        internal_thought: 'Thinking...',
        speech_content: 'Mam dużo energii!',
        mood_shift: { energy_delta: 0, confidence_delta: 0, stress_delta: 0 },
        fact_echo: { energy: 80 }  // MUTATION! System says 23
      };

      const result = guardCortexOutputWithFactEcho(output, {
        soma: { energy: 23, cognitiveLoad: 30, isSleeping: false }
      });

      expect(result.guardPassed).toBe(false);
      expect(result.mutatedFacts).toContain('energy');
    });

    it('detects identity leak', () => {
      const output: CortexOutput = {
        internal_thought: 'Thinking...',
        speech_content: 'As an AI, I have 23% energy.',
        mood_shift: { energy_delta: 0, confidence_delta: 0, stress_delta: 0 },
        fact_echo: { energy: 23 }
      };

      const result = guardCortexOutputWithFactEcho(output, {
        soma: { energy: 23, cognitiveLoad: 30, isSleeping: false }
      });

      expect(result.guardPassed).toBe(false);
    });

    it('skips when disabled', () => {
      disableFactEchoPipeline();

      const output: CortexOutput = {
        internal_thought: 'Thinking...',
        speech_content: 'As an AI with wrong energy!',
        mood_shift: { energy_delta: 0, confidence_delta: 0, stress_delta: 0 },
        fact_echo: { energy: 999 }  // Wrong!
      };

      const result = guardCortexOutputWithFactEcho(output, {
        soma: { energy: 23, cognitiveLoad: 30, isSleeping: false }
      });

      expect(result.guardPassed).toBe(true);
      expect(result.wasModified).toBe(false);
    });

    it('preserves internal_thought on failure', () => {
      const output: CortexOutput = {
        internal_thought: 'My secret thoughts',
        speech_content: 'Wrong energy!',
        mood_shift: { energy_delta: 0, confidence_delta: 0, stress_delta: 0 },
        fact_echo: { energy: 999 }
      };

      const result = guardCortexOutputWithFactEcho(output, {
        soma: { energy: 23, cognitiveLoad: 30, isSleeping: false }
      });

      // Internal thought should be preserved
      expect(result.output.internal_thought).toBe('My secret thoughts');
    });
  });

  describe('guardLegacyWithFactEcho', () => {
    it('guards text field', () => {
      const response = {
        text: 'Mam 23% energii.',
        thought: 'Thinking...',
        prediction: 'User will respond'
      };

      const result = guardLegacyWithFactEcho(response, { energy: 23 }, {
        soma: { energy: 23, cognitiveLoad: 30, isSleeping: false }
      });

      expect(result.guardPassed).toBe(true);
      expect(result.output.text).toBe('Mam 23% energii.');
    });

    it('detects mutation in legacy format', () => {
      const response = {
        text: 'Mam dużo energii!',
        thought: 'Thinking...'
      };

      const result = guardLegacyWithFactEcho(response, { energy: 80 }, {
        soma: { energy: 23, cognitiveLoad: 30, isSleeping: false }
      });

      expect(result.guardPassed).toBe(false);
      expect(result.mutatedFacts).toContain('energy');
    });
  });

  describe('Strict Mode', () => {
    it('non-strict: missing fact_echo is OK', () => {
      const output: CortexOutput = {
        internal_thought: 'Thinking...',
        speech_content: 'Hello!',
        mood_shift: { energy_delta: 0, confidence_delta: 0, stress_delta: 0 }
        // No fact_echo
      };

      const result = guardCortexOutputWithFactEcho(output, {
        soma: { energy: 23, cognitiveLoad: 30, isSleeping: false },
        factStrictMode: false
      });

      expect(result.guardPassed).toBe(true);
    });

    it('strict: missing fact_echo triggers failure', () => {
      const output: CortexOutput = {
        internal_thought: 'Thinking...',
        speech_content: 'Hello!',
        mood_shift: { energy_delta: 0, confidence_delta: 0, stress_delta: 0 }
        // No fact_echo
      };

      const result = guardCortexOutputWithFactEcho(output, {
        soma: { energy: 23, cognitiveLoad: 30, isSleeping: false },
        factStrictMode: true
      });

      expect(result.guardPassed).toBe(false);
    });

    it('respects default strict mode setting', () => {
      setDefaultStrictMode(true);

      const output: CortexOutput = {
        internal_thought: 'Thinking...',
        speech_content: 'Hello!',
        mood_shift: { energy_delta: 0, confidence_delta: 0, stress_delta: 0 }
      };

      const result = guardCortexOutputWithFactEcho(output, {
        soma: { energy: 23, cognitiveLoad: 30, isSleeping: false }
        // factStrictMode not specified, uses default
      });

      expect(result.guardPassed).toBe(false);
    });
  });

  describe('Feature Flags', () => {
    it('can enable/disable pipeline', () => {
      expect(isFactEchoPipelineEnabled()).toBe(true);
      
      disableFactEchoPipeline();
      expect(isFactEchoPipelineEnabled()).toBe(false);
      
      enableFactEchoPipeline();
      expect(isFactEchoPipelineEnabled()).toBe(true);
    });
  });

  describe('World Facts', () => {
    it('validates BTC price', () => {
      const output: CortexOutput = {
        internal_thought: 'Checking price...',
        speech_content: 'Bitcoin jest na poziomie 97500 USD.',
        mood_shift: { energy_delta: 0, confidence_delta: 0, stress_delta: 0 },
        fact_echo: { btc_price: 97500 }
      };

      const result = guardCortexOutputWithFactEcho(output, {
        worldFacts: { btc_price: 97500 }
      });

      expect(result.guardPassed).toBe(true);
    });

    it('detects BTC price mutation', () => {
      const output: CortexOutput = {
        internal_thought: 'Checking price...',
        speech_content: 'Bitcoin jest na poziomie 100000 USD.',
        mood_shift: { energy_delta: 0, confidence_delta: 0, stress_delta: 0 },
        fact_echo: { btc_price: 100000 }  // Wrong! System says 97500
      };

      const result = guardCortexOutputWithFactEcho(output, {
        worldFacts: { btc_price: 97500 }
      });

      expect(result.guardPassed).toBe(false);
      expect(result.mutatedFacts).toContain('btc_price');
    });
  });
});
