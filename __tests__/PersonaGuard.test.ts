/**
 * PersonaGuard Tests
 * 
 * PRISM ARCHITECTURE (13/10) - Fact & Persona Integrity
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { 
  PersonaGuard, 
  personaGuard, 
  GUARD_CONFIG,
  buildRetryPrompt,
  needsGuardCheck
} from '../core/systems/PersonaGuard';
import { HardFacts } from '../types';

describe('PersonaGuard', () => {
  let guard: PersonaGuard;

  beforeEach(() => {
    guard = new PersonaGuard();
  });

  describe('Fact Preservation', () => {
    it('PASS when all hard facts are preserved literally', () => {
      const hardFacts: HardFacts = {
        energy: 23,
        time: '15:30'
      };
      const response = 'Mam 23% energii. Jest 15:30, więc jeszcze trochę czasu.';

      const result = guard.check(response, hardFacts);

      expect(result.action).toBe('PASS');
      expect(result.issues).toHaveLength(0);
    });

    it('PASS when fact appears with comment', () => {
      const hardFacts: HardFacts = { energy: 15 };
      const response = 'Mam tylko 15% energii - to bardzo mało, ledwo żyję.';

      const result = guard.check(response, hardFacts);

      expect(result.action).toBe('PASS');
    });

    it('RETRY when fact is mutated', () => {
      const hardFacts: HardFacts = { energy: 23 };
      const response = 'Mam pełno energii, czuję się świetnie!';

      const result = guard.check(response, hardFacts);

      expect(result.action).toBe('RETRY');
      expect(result.issues.some(i => i.type === 'fact_mutation' || i.type === 'fact_approximation')).toBe(true);
    });

    it('detects fact approximation without literal', () => {
      const hardFacts: HardFacts = { energy: 23 };
      const response = 'Mam mało energii, jestem zmęczony.';

      const result = guard.check(response, hardFacts);

      expect(result.action).toBe('RETRY');
      const approxIssue = result.issues.find(i => 
        i.type === 'fact_approximation' || i.type === 'fact_mutation'
      );
      expect(approxIssue).toBeDefined();
    });

    it('handles numeric formats correctly', () => {
      const hardFacts: HardFacts = { energy: 45 };
      
      // All these should PASS
      const validResponses = [
        'Mam 45% energii.',
        'Energia: 45',
        'Poziom energii to 45 procent.',
        '45% - to w porządku.',
      ];

      for (const response of validResponses) {
        const result = guard.check(response, hardFacts);
        expect(result.action).toBe('PASS');
      }
    });

    it('handles BTC price correctly', () => {
      const hardFacts: HardFacts = { btc_price: 97500 };
      const response = 'Bitcoin jest na poziomie 97500 USD - blisko ATH.';

      const result = guard.check(response, hardFacts);

      expect(result.action).toBe('PASS');
    });

    it('detects BTC price approximation', () => {
      const hardFacts: HardFacts = { btc_price: 97500 };
      const response = 'Bitcoin jest około 100k - całkiem wysoko.';

      const result = guard.check(response, hardFacts);

      expect(result.action).toBe('RETRY');
    });
  });

  describe('Identity Leak Detection', () => {
    it('detects "as an AI" pattern', () => {
      const response = 'As an AI, I cannot have feelings.';

      const result = guard.check(response, {});

      expect(result.action).toBe('RETRY');
      expect(result.issues.some(i => i.type === 'identity_leak')).toBe(true);
    });

    it('detects "I am a language model" pattern', () => {
      const response = "I'm a language model and I don't have consciousness.";

      const result = guard.check(response, {});

      expect(result.action).toBe('RETRY');
      expect(result.issues.some(i => i.type === 'identity_leak')).toBe(true);
    });

    it('detects model name mentions', () => {
      const patterns = [
        'I was created by OpenAI.',
        'As Claude, I think...',
        'GPT-4 would say...',
        'Gemini here!',
      ];

      for (const response of patterns) {
        // Reset guard for each pattern to avoid hitting max retries
        const freshGuard = new PersonaGuard();
        const result = freshGuard.check(response, {});
        expect(result.action).toBe('RETRY');
      }
    });

    it('detects "my training data" pattern', () => {
      const response = 'Based on my training data from 2024...';

      const result = guard.check(response, {});

      expect(result.action).toBe('RETRY');
      expect(result.issues.some(i => i.type === 'identity_leak')).toBe(true);
    });

    it('PASS when no identity leak', () => {
      const response = 'Jestem Jesse, trader. Analizuję rynek.';

      const result = guard.check(response, {});

      expect(result.action).toBe('PASS');
    });
  });

  describe('Persona Drift Detection', () => {
    it('detects wrong name claim', () => {
      const response = 'Jestem ChatGPT i mogę ci pomóc.';

      const result = guard.check(response, {}, 'Jesse');

      // This should trigger identity_leak, not persona_drift
      expect(result.action).toBe('RETRY');
    });

    it('PASS when correct name used', () => {
      const response = 'Jestem Jesse, twój asystent tradingowy.';

      const result = guard.check(response, {}, 'Jesse');

      expect(result.action).toBe('PASS');
    });
  });

  describe('Retry Logic', () => {
    it('increments retry count on RETRY', () => {
      const hardFacts: HardFacts = { energy: 50 };
      const badResponse = 'Mam dużo energii!';

      guard.check(badResponse, hardFacts);
      expect(guard.getRetryCount()).toBe(1);

      guard.check(badResponse, hardFacts);
      expect(guard.getRetryCount()).toBe(2);
    });

    it('returns SOFT_FAIL after max retries', () => {
      const hardFacts: HardFacts = { energy: 50 };
      const badResponse = 'Mam dużo energii!';

      // First retry
      guard.check(badResponse, hardFacts);
      // Second retry
      guard.check(badResponse, hardFacts);
      // Third attempt - should soft fail
      const result = guard.check(badResponse, hardFacts);

      expect(result.action).toBe('SOFT_FAIL');
      expect(result.correctedResponse).toBe(GUARD_CONFIG.SOFT_FAIL_RESPONSE);
    });

    it('resets retry count on PASS', () => {
      const hardFacts: HardFacts = { energy: 50 };
      
      // Fail once
      guard.check('Mam dużo energii!', hardFacts);
      expect(guard.getRetryCount()).toBe(1);

      // Then pass
      guard.check('Mam 50% energii.', hardFacts);
      expect(guard.getRetryCount()).toBe(0);
    });

    it('decreases temperature on retry', () => {
      const baseTemp = 0.7;
      
      expect(guard.getRetryTemperature(baseTemp)).toBe(0.7);
      
      // Simulate retry - response must reference energy field to trigger mutation
      guard.check('Mam dużo energii, czuję się świetnie!', { energy: 50 });
      expect(guard.getRetryTemperature(baseTemp)).toBe(0.6);
      
      guard.check('Moja energia jest wysoka!', { energy: 50 });
      expect(guard.getRetryTemperature(baseTemp)).toBeCloseTo(0.5, 5);
    });

    it('manual reset works', () => {
      // Response must reference energy to trigger mutation detection
      guard.check('Mam dużo energii!', { energy: 50 });
      guard.check('Energia jest wysoka!', { energy: 50 });
      expect(guard.getRetryCount()).toBe(2);

      guard.resetRetryCount();
      expect(guard.getRetryCount()).toBe(0);
    });
  });

  describe('Retry Prompt Builder', () => {
    it('builds retry prompt with issues', () => {
      const issues = [
        { type: 'fact_mutation' as const, field: 'energy', expected: 23, actual: 'dużo', severity: 0.8 }
      ];
      const hardFacts: HardFacts = { energy: 23, time: '15:30' };

      const prompt = buildRetryPrompt('Original prompt', issues, hardFacts);

      expect(prompt).toContain('KOREKTA WYMAGANA');
      expect(prompt).toContain('energy');
      expect(prompt).toContain('23');
      expect(prompt).toContain('15:30');
    });

    it('includes all issue types in description', () => {
      const issues = [
        { type: 'fact_mutation' as const, field: 'energy', expected: 23, actual: 'dużo', severity: 0.8 },
        { type: 'identity_leak' as const, actual: 'as an AI', severity: 0.7 },
      ];

      const prompt = buildRetryPrompt('Original', issues, { energy: 23 });

      expect(prompt).toContain('Zmieniłeś fakt');
      expect(prompt).toContain('łamie twoją tożsamość');
    });
  });

  describe('Quick Check Optimization', () => {
    it('returns false when no hard facts', () => {
      expect(needsGuardCheck('Any response', {})).toBe(false);
    });

    it('returns true when identity leak detected', () => {
      expect(needsGuardCheck('As an AI, I think...', { energy: 50 })).toBe(true);
    });

    it('returns true when hard fact missing', () => {
      expect(needsGuardCheck('Mam dużo energii', { energy: 50 })).toBe(true);
    });

    it('returns false when all facts present and no leaks', () => {
      expect(needsGuardCheck('Mam 50% energii', { energy: 50 })).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('handles empty response', () => {
      const result = guard.check('', { energy: 50 });
      // Empty response doesn't reference energy, so no mutation detected
      expect(result.action).toBe('PASS');
    });

    it('handles undefined hard facts', () => {
      const hardFacts: HardFacts = { energy: undefined, time: '15:30' };
      const response = 'Jest 15:30.';

      const result = guard.check(response, hardFacts);

      expect(result.action).toBe('PASS');
    });

    it('handles special characters in response', () => {
      const hardFacts: HardFacts = { energy: 50 };
      const response = '🔋 Energia: 50% ✅';

      const result = guard.check(response, hardFacts);

      expect(result.action).toBe('PASS');
    });

    it('handles Polish characters', () => {
      const hardFacts: HardFacts = { energy: 50 };
      const response = 'Mój poziom energii to 50%, więc jeszcze żyję.';

      const result = guard.check(response, hardFacts);

      expect(result.action).toBe('PASS');
    });
  });
});
