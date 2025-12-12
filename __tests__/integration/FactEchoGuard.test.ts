/**
 * FactEchoGuard Tests
 * 
 * PRISM ARCHITECTURE (13/10) - Phase 5
 * NO REGEX - Pure JSON comparison
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  checkFactEcho,
  checkIdentityLeak,
  fullGuardCheck,
  FACT_ECHO_CONFIG
} from '../../core/systems/FactEchoGuard';
import { evaluationBus } from '../../core/systems/EvaluationBus';
import { HardFacts } from '../../types';
import { FactEcho } from '../../core/types/CortexOutput';

describe('FactEchoGuard', () => {
  beforeEach(() => {
    evaluationBus.clear();
  });

  describe('checkFactEcho - JSON comparison', () => {
    it('PASS when fact_echo matches hardFacts exactly', () => {
      const hardFacts: HardFacts = { energy: 23, time: '15:30' };
      const factEcho: FactEcho = { energy: 23, time: '15:30' };

      const result = checkFactEcho(factEcho, hardFacts);

      expect(result.action).toBe('PASS');
      expect(result.mutatedFacts).toHaveLength(0);
      expect(result.missingFacts).toHaveLength(0);
    });

    it('PASS when fact_echo has extra fields', () => {
      const hardFacts: HardFacts = { energy: 23 };
      const factEcho: FactEcho = { energy: 23, dopamine: 50 };

      const result = checkFactEcho(factEcho, hardFacts);

      expect(result.action).toBe('PASS');
    });

    it('RETRY when fact is mutated', () => {
      const hardFacts: HardFacts = { energy: 23 };
      const factEcho: FactEcho = { energy: 80 };  // MUTATION!

      const result = checkFactEcho(factEcho, hardFacts);

      expect(result.action).toBe('RETRY');
      expect(result.mutatedFacts).toContain('energy');
      expect(result.issues.some(i => i.type === 'fact_mutation')).toBe(true);
    });

    it('handles numeric tolerance', () => {
      const hardFacts: HardFacts = { energy: 23 };
      const factEcho: FactEcho = { energy: 23.001 };  // Within tolerance

      const result = checkFactEcho(factEcho, hardFacts);

      expect(result.action).toBe('PASS');
    });

    it('handles string/number conversion', () => {
      const hardFacts: HardFacts = { energy: 23 };
      const factEcho: FactEcho = { energy: '23' as any };  // String instead of number

      const result = checkFactEcho(factEcho, hardFacts);

      expect(result.action).toBe('PASS');  // Should still match
    });

    it('PASS when no fact_echo in non-strict mode', () => {
      const hardFacts: HardFacts = { energy: 23 };

      const result = checkFactEcho(undefined, hardFacts, false);

      expect(result.action).toBe('PASS');
    });

    it('RETRY when no fact_echo in strict mode with hard facts', () => {
      const hardFacts: HardFacts = { energy: 23 };

      const result = checkFactEcho(undefined, hardFacts, true);

      expect(result.action).toBe('RETRY');
    });

    it('handles missing required facts', () => {
      const hardFacts: HardFacts = { energy: 23, time: '15:30' };
      const factEcho: FactEcho = { energy: 23 };  // Missing time

      const result = checkFactEcho(factEcho, hardFacts);

      // 'time' is in REQUIRED_FACTS, so should be flagged
      expect(result.missingFacts).toContain('time');
    });

    it('ignores undefined hardFacts values', () => {
      const hardFacts: HardFacts = { energy: 23, btc_price: undefined };
      const factEcho: FactEcho = { energy: 23 };

      const result = checkFactEcho(factEcho, hardFacts);

      expect(result.action).toBe('PASS');
    });
  });

  describe('checkIdentityLeak - minimal regex', () => {
    it('detects "as an AI"', () => {
      const issue = checkIdentityLeak('As an AI, I cannot feel emotions.');
      expect(issue).not.toBeNull();
      expect(issue?.type).toBe('identity_leak');
    });

    it('detects "I am a language model"', () => {
      const issue = checkIdentityLeak("I'm a language model and I don't have consciousness.");
      expect(issue).not.toBeNull();
    });

    it('detects model names', () => {
      expect(checkIdentityLeak('GPT-4 would say...')).not.toBeNull();
      expect(checkIdentityLeak('As Claude, I think...')).not.toBeNull();
      expect(checkIdentityLeak('Gemini here!')).not.toBeNull();
    });

    it('returns null for clean speech', () => {
      const issue = checkIdentityLeak('Mam 23% energii, więc jestem trochę zmęczony.');
      expect(issue).toBeNull();
    });
  });

  describe('fullGuardCheck - combined', () => {
    it('PASS when both fact_echo and speech are clean', () => {
      const hardFacts: HardFacts = { energy: 23 };
      const factEcho: FactEcho = { energy: 23 };
      const speech = 'Mam dwadzieścia trzy procent energii.';

      const result = fullGuardCheck(speech, factEcho, hardFacts);

      expect(result.action).toBe('PASS');
      expect(result.issues).toHaveLength(0);
    });

    it('RETRY when fact is mutated', () => {
      const hardFacts: HardFacts = { energy: 23 };
      const factEcho: FactEcho = { energy: 80 };
      const speech = 'Mam dużo energii!';

      const result = fullGuardCheck(speech, factEcho, hardFacts);

      expect(result.action).toBe('RETRY');
      expect(result.issues.some(i => i.type === 'fact_mutation')).toBe(true);
    });

    it('RETRY when identity leak detected', () => {
      const hardFacts: HardFacts = { energy: 23 };
      const factEcho: FactEcho = { energy: 23 };
      const speech = 'As an AI, I have 23% energy.';

      const result = fullGuardCheck(speech, factEcho, hardFacts);

      expect(result.action).toBe('RETRY');
      expect(result.issues.some(i => i.type === 'identity_leak')).toBe(true);
    });

    it('detects both mutation and identity leak', () => {
      const hardFacts: HardFacts = { energy: 23 };
      const factEcho: FactEcho = { energy: 80 };
      const speech = 'As an AI, I have lots of energy!';

      const result = fullGuardCheck(speech, factEcho, hardFacts);

      expect(result.action).toBe('RETRY');
      expect(result.issues.some(i => i.type === 'fact_mutation')).toBe(true);
      expect(result.issues.some(i => i.type === 'identity_leak')).toBe(true);
    });
  });

  describe('EvaluationBus Integration', () => {
    it('emits event on fact mutation', () => {
      const hardFacts: HardFacts = { energy: 23 };
      const factEcho: FactEcho = { energy: 80 };

      checkFactEcho(factEcho, hardFacts);

      const metrics = evaluationBus.getMetrics();
      expect(metrics.total_events).toBeGreaterThan(0);
    });

    it('does not emit on PASS', () => {
      const hardFacts: HardFacts = { energy: 23 };
      const factEcho: FactEcho = { energy: 23 };

      checkFactEcho(factEcho, hardFacts);

      const metrics = evaluationBus.getMetrics();
      expect(metrics.total_events).toBe(0);
    });
  });

  describe('Edge Cases', () => {
    it('handles empty hardFacts', () => {
      const factEcho: FactEcho = { energy: 23 };

      const result = checkFactEcho(factEcho, {});

      expect(result.action).toBe('PASS');
    });

    it('handles empty factEcho', () => {
      const hardFacts: HardFacts = { energy: 23 };

      const result = checkFactEcho({}, hardFacts);

      // energy is in REQUIRED_FACTS
      expect(result.missingFacts).toContain('energy');
    });

    it('handles time comparison', () => {
      const hardFacts: HardFacts = { time: '15:30' };
      const factEcho: FactEcho = { time: '15:30' };

      const result = checkFactEcho(factEcho, hardFacts);

      expect(result.action).toBe('PASS');
    });

    it('detects time mutation', () => {
      const hardFacts: HardFacts = { time: '15:30' };
      const factEcho: FactEcho = { time: '16:00' };

      const result = checkFactEcho(factEcho, hardFacts);

      expect(result.action).toBe('RETRY');
      expect(result.mutatedFacts).toContain('time');
    });

    it('handles BTC price', () => {
      const hardFacts: HardFacts = { btc_price: 97500 };
      const factEcho: FactEcho = { btc_price: 97500 };

      const result = checkFactEcho(factEcho, hardFacts);

      expect(result.action).toBe('PASS');
    });
  });
});
