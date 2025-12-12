/**
 * HardFactsBuilder Tests
 * 
 * PRISM ARCHITECTURE (13/10)
 */

import { describe, it, expect } from 'vitest';
import {
  buildHardFacts,
  buildSoftState,
  buildPrismContext,
  formatHardFactsForPrompt,
  formatSoftStateForPrompt
} from '../../core/systems/HardFactsBuilder';

describe('HardFactsBuilder', () => {
  describe('buildHardFacts', () => {
    it('includes current time', () => {
      const facts = buildHardFacts({});
      expect(facts.time).toBeDefined();
      expect(facts.time).toMatch(/\d{2}:\d{2}/);
    });

    it('includes energy from soma', () => {
      const facts = buildHardFacts({
        soma: { energy: 45.7, cognitiveLoad: 50, isSleeping: false }
      });
      expect(facts.energy).toBe(46); // Rounded
    });

    it('includes neurochemistry', () => {
      const facts = buildHardFacts({
        neuro: { dopamine: 65.3, serotonin: 55.8, norepinephrine: 48.2 }
      });
      expect(facts.dopamine).toBe(65);
      expect(facts.serotonin).toBe(56);
      expect(facts.norepinephrine).toBe(48);
    });

    it('includes world facts', () => {
      const facts = buildHardFacts({
        worldFacts: { btc_price: 97500, eth_price: 3200 }
      });
      expect(facts.btc_price).toBe(97500);
      expect(facts.eth_price).toBe(3200);
    });

    it('combines all sources', () => {
      const facts = buildHardFacts({
        soma: { energy: 80, cognitiveLoad: 30, isSleeping: false },
        neuro: { dopamine: 70, serotonin: 60, norepinephrine: 50 },
        worldFacts: { btc_price: 100000 }
      });

      expect(facts.time).toBeDefined();
      expect(facts.energy).toBe(80);
      expect(facts.dopamine).toBe(70);
      expect(facts.btc_price).toBe(100000);
    });
  });

  describe('buildSoftState', () => {
    it('derives mood from limbic state', () => {
      const state = buildSoftState({
        limbic: { fear: 0.1, curiosity: 0.8, frustration: 0.1, satisfaction: 0.5 }
      });
      expect(state.mood).toContain('curious');
    });

    it('handles high satisfaction', () => {
      const state = buildSoftState({
        limbic: { fear: 0.1, curiosity: 0.3, frustration: 0.1, satisfaction: 0.9 }
      });
      expect(state.mood).toBe('very_satisfied');
    });

    it('handles frustration', () => {
      const state = buildSoftState({
        limbic: { fear: 0.1, curiosity: 0.2, frustration: 0.7, satisfaction: 0.2 }
      });
      expect(state.mood).toContain('frustrated');
    });

    it('includes traits', () => {
      const traits = {
        arousal: 0.5,
        curiosity: 0.7,
        verbosity: 0.4,
        socialAwareness: 0.6,
        conscientiousness: 0.8
      };
      const state = buildSoftState({ traits });
      expect(state.traits).toEqual(traits);
    });

    it('includes narrative self', () => {
      const state = buildSoftState({
        narrativeSelf: 'I am Jesse, a strategic trader.'
      });
      expect(state.narrative_self).toBe('I am Jesse, a strategic trader.');
    });

    it('includes goals', () => {
      const goals = [
        { id: '1', description: 'Analyze market', priority: 0.8, progress: 0, source: 'user' as const, createdAt: Date.now() }
      ];
      const state = buildSoftState({ goals });
      expect(state.goals).toHaveLength(1);
    });
  });

  describe('buildPrismContext', () => {
    it('builds complete context', () => {
      const context = buildPrismContext({
        userInput: 'How are you?',
        soma: { energy: 50, cognitiveLoad: 30, isSleeping: false },
        limbic: { fear: 0.1, curiosity: 0.6, frustration: 0.1, satisfaction: 0.5 }
      });

      expect(context.userInput).toBe('How are you?');
      expect(context.hardFacts.energy).toBe(50);
      expect(context.softState.mood).toContain('curious');
    });

    it('includes conversation history', () => {
      const history = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' }
      ];
      const context = buildPrismContext({
        userInput: 'How are you?',
        conversationHistory: history
      });

      expect(context.conversationHistory).toHaveLength(2);
    });
  });

  describe('formatHardFactsForPrompt', () => {
    it('formats facts for prompt', () => {
      const facts = { energy: 50, time: '15:30', dopamine: 65 };
      const formatted = formatHardFactsForPrompt(facts);

      expect(formatted).toContain('HARD_FACTS');
      expect(formatted).toContain('energy: 50');
      expect(formatted).toContain('time: 15:30');
      expect(formatted).toContain('dopamine: 65');
    });

    it('skips undefined values', () => {
      const facts = { energy: 50, btc_price: undefined };
      const formatted = formatHardFactsForPrompt(facts);

      expect(formatted).toContain('energy: 50');
      expect(formatted).not.toContain('btc_price');
    });
  });

  describe('formatSoftStateForPrompt', () => {
    it('formats mood', () => {
      const state = { mood: 'curious' };
      const formatted = formatSoftStateForPrompt(state);

      expect(formatted).toContain('SOFT_STATE');
      expect(formatted).toContain('mood: curious');
    });

    it('formats traits', () => {
      const state = {
        traits: { arousal: 0.5, curiosity: 0.7, verbosity: 0.4, socialAwareness: 0.6, conscientiousness: 0.8 }
      };
      const formatted = formatSoftStateForPrompt(state);

      expect(formatted).toContain('traits:');
      expect(formatted).toContain('curiosity=0.70');
    });

    it('truncates long narrative self', () => {
      const longNarrative = 'A'.repeat(300);
      const state = { narrative_self: longNarrative };
      const formatted = formatSoftStateForPrompt(state);

      expect(formatted).toContain('identity:');
      expect(formatted.length).toBeLessThan(longNarrative.length + 100);
    });
  });
});
