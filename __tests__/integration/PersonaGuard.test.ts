/**
 * PersonaGuard Tests
 * 
 * PRISM ARCHITECTURE (13/10) - Persona Integrity
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { 
  PersonaGuard, 
  personaGuard, 
  GUARD_CONFIG,
  buildRetryPrompt,
  needsGuardCheck
} from '@core/systems/PersonaGuard';
import { HardFacts } from '@/types';

describe('PersonaGuard', () => {
  let guard: PersonaGuard;

  beforeEach(() => {
    guard = new PersonaGuard();
  });

  describe('Fact Handling (delegated)', () => {
    it('does not flag fact mutations when persona is clean', () => {
      const hardFacts: HardFacts = { energy: 23, time: '15:30' };
      const response = 'Mam malo energii i jest pozno.';

      const result = guard.check(response, hardFacts);

      expect(result.action).toBe('PASS');
      expect(result.issues).toHaveLength(0);
    });
  });

  describe('Identity Leak Detection', () => {
    it('detects "as an AI" pattern', () => {
      const response = 'As an AI, I cannot have feelings.';

      const result = guard.check(response, {});

      expect(result.action).toBe('RETRY');
      expect(result.issues.some((i: any) => i.type === 'identity_leak')).toBe(true);
    });

    it('detects "I am a language model" pattern', () => {
      const response = "I'm a language model and I don't have consciousness.";

      const result = guard.check(response, {});

      expect(result.action).toBe('RETRY');
      expect(result.issues.some((i: any) => i.type === 'identity_leak')).toBe(true);
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
      expect(result.issues.some((i: any) => i.type === 'identity_leak')).toBe(true);
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

    it('detects assistant-speak patterns', () => {
      const response = 'Jak moge pomoc?';

      const result = guard.check(response, {}, 'Jesse');

      expect(result.action).toBe('RETRY');
      expect(result.issues.some((i: any) => i.type === 'persona_drift')).toBe(true);
    });

  });

  describe('Retry Logic', () => {
    it('increments retry count on RETRY', () => {
      const badResponse = 'As an AI, I think...';

      guard.check(badResponse, {});
      expect(guard.getRetryCount()).toBe(1);

      guard.check(badResponse, {});
      expect(guard.getRetryCount()).toBe(2);
    });

    it('returns SOFT_FAIL after max retries', () => {
      const badResponse = 'As an AI, I think...';

      guard.check(badResponse, {});
      guard.check(badResponse, {});
      const result = guard.check(badResponse, {});

      expect(result.action).toBe('SOFT_FAIL');
      expect(result.correctedResponse).toBe(GUARD_CONFIG.SOFT_FAIL_RESPONSE);
    });

    it('resets retry count on PASS', () => {
      guard.check('As an AI, I think...', {});
      expect(guard.getRetryCount()).toBe(1);

      guard.check('Jestem Jesse, skupiony na zadaniu.', {}, 'Jesse');
      expect(guard.getRetryCount()).toBe(0);
    });

    it('decreases temperature on retry', () => {
      const baseTemp = 0.7;

      expect(guard.getRetryTemperature(baseTemp)).toBe(0.7);

      guard.check('As an AI, I think...', {});
      expect(guard.getRetryTemperature(baseTemp)).toBe(0.6);

      guard.check('As an AI, I think...', {});
      expect(guard.getRetryTemperature(baseTemp)).toBeCloseTo(0.5, 5);
    });

    it('manual reset works', () => {
      guard.check('As an AI, I think...', {});
      guard.check('As an AI, I think...', {});
      expect(guard.getRetryCount()).toBe(2);

      guard.resetRetryCount();
      expect(guard.getRetryCount()).toBe(0);
    });
  });

  describe('Retry Prompt Builder', () => {
    it('builds retry prompt with identity issues', () => {
      const issues = [
        { type: 'identity_leak' as const, actual: 'as an AI', severity: 0.7 }
      ];
      const hardFacts: HardFacts = { agentName: 'Jesse' } as any;

      const prompt = buildRetryPrompt('Original prompt', issues, hardFacts);

      expect(prompt).toContain('KOREKTA WYMAGANA');
      expect(prompt).toContain('as an AI');
    });

    it('includes persona drift details', () => {
      const issues = [
        { type: 'persona_drift' as const, expected: 'no-assistant-speak', actual: 'Jak moge pomoc', severity: 0.5 },
        { type: 'identity_contradiction' as const, expected: 'Jesse', actual: 'Assistant', severity: 0.9 }
      ];

      const prompt = buildRetryPrompt('Original', issues, { agentName: 'Jesse' } as any);

      expect(prompt).toContain('Assistant');
      expect(prompt).toContain('Jesse');
    });
  });

  describe('Quick Check Optimization', () => {
    it('returns false for clean response', () => {
      expect(needsGuardCheck('Any response', {})).toBe(false);
    });

    it('returns true when identity leak detected', () => {
      expect(needsGuardCheck('As an AI, I think...', { energy: 50 })).toBe(true);
    });

    it('returns true when assistant-speak detected', () => {
      expect(needsGuardCheck('Jak moge pomoc?', {})).toBe(true);
    });

    it('returns false for fact-only checks', () => {
      expect(needsGuardCheck('Mam 50% energii', { energy: 50 })).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('handles empty response without persona issues', () => {
      const result = guard.check('', { energy: 50 });
      expect(result.action).toBe('PASS');
    });

    it('ignores undefined hard facts', () => {
      const hardFacts: HardFacts = { energy: undefined, time: '15:30' };
      const response = 'Jest 15:30.';

      const result = guard.check(response, hardFacts);

      expect(result.action).toBe('PASS');
    });

    it('handles special characters in response without persona issues', () => {
      const hardFacts: HardFacts = { energy: 50 };
      const response = 'xx Energia: 50% yy';

      const result = guard.check(response, hardFacts);

      expect(result.action).toBe('PASS');
    });

    it('handles non-ascii characters in response', () => {
      const hardFacts: HardFacts = { energy: 50 };
      const response = 'MA3j poziom energii to 50%, wi?Tc jeszcze ??yj?T.';

      const result = guard.check(response, hardFacts);

      expect(result.action).toBe('PASS');
    });
  });
});
