/**
 * ExpressionPolicy.test.ts - Unit tests for expression filtering
 * 
 * Tests the core decision logic for when agent should speak vs stay silent.
 * FAZA 4.5: Covers dopamine breaker, silence breaker, narcissism filter.
 */

import { describe, it, expect } from 'vitest';
import { 
  decideExpression, 
  computeNovelty, 
  estimateSocialCost,
  clamp01,
  shortenToFirstSentences
} from './ExpressionPolicy';
import { TraitVector, SomaState, NeurotransmitterState } from '../../types';

// Default test fixtures
const defaultTraits: TraitVector = {
  arousal: 0.5,
  verbosity: 0.5,
  conscientiousness: 0.5,
  socialAwareness: 0.5,
  curiosity: 0.5
};

const defaultSoma: SomaState = {
  energy: 80,
  cognitiveLoad: 30,
  isSleeping: false
};

const defaultNeuro: NeurotransmitterState = {
  dopamine: 60,
  serotonin: 60,
  norepinephrine: 50
};

describe('ExpressionPolicy', () => {
  
  describe('clamp01', () => {
    it('should clamp values to 0-1 range', () => {
      expect(clamp01(-0.5)).toBe(0);
      expect(clamp01(0)).toBe(0);
      expect(clamp01(0.5)).toBe(0.5);
      expect(clamp01(1)).toBe(1);
      expect(clamp01(1.5)).toBe(1);
    });

    it('should handle NaN', () => {
      expect(clamp01(NaN)).toBe(0);
    });
  });

  describe('shortenToFirstSentences', () => {
    it('should shorten to specified number of sentences', () => {
      const text = 'First sentence. Second sentence. Third sentence.';
      expect(shortenToFirstSentences(text, 1)).toBe('First sentence.');
      expect(shortenToFirstSentences(text, 2)).toBe('First sentence. Second sentence.');
    });

    it('should handle text with fewer sentences', () => {
      const text = 'Only one sentence.';
      expect(shortenToFirstSentences(text, 3)).toBe('Only one sentence.');
    });
  });

  describe('computeNovelty', () => {
    it('should return 1 for completely new content', () => {
      const current = 'This is completely new content about quantum physics.';
      const previous = ['Hello world', 'How are you'];
      expect(computeNovelty(current, previous)).toBeGreaterThan(0.8);
    });

    it('should return low value for repeated content', () => {
      const current = 'Hello world how are you today';
      const previous = ['Hello world how are you'];
      expect(computeNovelty(current, previous)).toBeLessThan(0.5);
    });

    it('should return 1 for empty previous array', () => {
      expect(computeNovelty('Any text', [])).toBe(1);
    });
  });

  describe('estimateSocialCost', () => {
    it('should penalize self-referential patterns', () => {
      const text = 'As a language model, I will try my best.';
      expect(estimateSocialCost(text)).toBeGreaterThan(0);
    });

    it('should penalize praise loops', () => {
      const text = 'Your transparency is invaluable to me.';
      expect(estimateSocialCost(text)).toBeGreaterThan(0);
    });

    it('should return 0 for neutral content', () => {
      const text = 'The weather is nice today.';
      expect(estimateSocialCost(text)).toBe(0);
    });
  });

  describe('decideExpression - Shadow Mode', () => {
    it('should ALWAYS say true in shadow mode', () => {
      const result = decideExpression(
        {
          responseText: 'Any text',
          goalAlignment: 0,
          noveltyScore: 0,
          socialCost: 1,
          context: 'USER_REPLY'
        },
        defaultTraits,
        defaultSoma,
        defaultNeuro,
        true // shadowMode
      );
      
      expect(result.say).toBe(true);
    });

    it('should still shorten extreme repetitions in shadow mode', () => {
      const longText = 'First. Second. Third. Fourth. Fifth.';
      const result = decideExpression(
        {
          responseText: longText,
          goalAlignment: 0.5,
          noveltyScore: 0.1, // Very low novelty
          socialCost: 0.7,   // High social cost
          context: 'USER_REPLY'
        },
        defaultTraits,
        defaultSoma,
        defaultNeuro,
        true // shadowMode
      );
      
      expect(result.say).toBe(true);
      expect(result.text.length).toBeLessThan(longText.length);
    });
  });

  describe('decideExpression - Dopamine Breaker', () => {
    it('should mute when dopamine >= 95 and novelty < 0.5 in GOAL_EXECUTED', () => {
      const highDopamineNeuro: NeurotransmitterState = {
        ...defaultNeuro,
        dopamine: 100
      };

      // Run multiple times due to random chance
      let mutedCount = 0;
      for (let i = 0; i < 20; i++) {
        const result = decideExpression(
          {
            responseText: 'Some autonomous thought.',
            goalAlignment: 0.3, // Low alignment = higher mute chance
            noveltyScore: 0.3,  // Low novelty
            socialCost: 0,
            context: 'GOAL_EXECUTED'
          },
          defaultTraits,
          defaultSoma,
          highDopamineNeuro,
          false
        );
        if (!result.say) mutedCount++;
      }
      
      // Should mute most of the time (probabilistic)
      expect(mutedCount).toBeGreaterThan(10);
    });

    it('should NOT trigger dopamine breaker in USER_REPLY without userIsSilent', () => {
      const highDopamineNeuro: NeurotransmitterState = {
        ...defaultNeuro,
        dopamine: 100
      };

      const result = decideExpression(
        {
          responseText: 'Response to user.',
          goalAlignment: 0.5,
          noveltyScore: 0.3,
          socialCost: 0,
          context: 'USER_REPLY',
          userIsSilent: false
        },
        defaultTraits,
        defaultSoma,
        highDopamineNeuro,
        false
      );
      
      // Should speak because user just sent a message
      expect(result.say).toBe(true);
    });
  });

  describe('decideExpression - Silence Breaker', () => {
    it('should mute when dopamine high, novelty very low, and user is silent', () => {
      const highDopamineNeuro: NeurotransmitterState = {
        ...defaultNeuro,
        dopamine: 100
      };

      const result = decideExpression(
        {
          responseText: 'Talking to empty room.',
          goalAlignment: 0.5,
          noveltyScore: 0.15, // Very low novelty < 0.2
          socialCost: 0,
          context: 'USER_REPLY',
          userIsSilent: true
        },
        defaultTraits,
        defaultSoma,
        highDopamineNeuro,
        false
      );
      
      expect(result.say).toBe(false);
    });
  });

  describe('decideExpression - Energy Clipping', () => {
    it('should shorten text when energy is low', () => {
      const lowEnergySoma: SomaState = {
        ...defaultSoma,
        energy: 25
      };

      const longText = 'First sentence. Second sentence. Third sentence. Fourth sentence.';
      const result = decideExpression(
        {
          responseText: longText,
          goalAlignment: 0.8, // High alignment to pass
          noveltyScore: 0.8,
          socialCost: 0,
          context: 'USER_REPLY'
        },
        defaultTraits,
        lowEnergySoma,
        defaultNeuro,
        false
      );
      
      expect(result.text.length).toBeLessThan(longText.length);
    });

    it('should mute when energy very low and goal alignment low', () => {
      const veryLowEnergySoma: SomaState = {
        ...defaultSoma,
        energy: 15
      };

      const result = decideExpression(
        {
          responseText: 'Some text.',
          goalAlignment: 0.3, // Low alignment
          noveltyScore: 0.5,
          socialCost: 0,
          context: 'USER_REPLY'
        },
        { ...defaultTraits, conscientiousness: 0.8 },
        veryLowEnergySoma,
        defaultNeuro,
        false
      );
      
      // High conscientiousness + low energy + low alignment = prefer silence
      expect(result.say).toBe(false);
    });
  });

  describe('decideExpression - Narcissism Filter', () => {
    it('should increase socialCost for self-focused speech in GOAL_EXECUTED', () => {
      const selfFocusedText = 'I am thinking about my consciousness and my identity and my purpose.';
      
      const result = decideExpression(
        {
          responseText: selfFocusedText,
          goalAlignment: 0.5,
          noveltyScore: 0.5,
          socialCost: 0,
          context: 'GOAL_EXECUTED'
        },
        defaultTraits,
        defaultSoma,
        defaultNeuro,
        false
      );
      
      // socialCost should be increased due to narcissism
      expect(result.socialCost).toBeGreaterThan(0);
    });

    it('should NOT apply narcissism filter in USER_REPLY context', () => {
      const selfFocusedText = 'I am thinking about my consciousness.';
      
      const result = decideExpression(
        {
          responseText: selfFocusedText,
          goalAlignment: 0.5,
          noveltyScore: 0.5,
          socialCost: 0,
          context: 'USER_REPLY'
        },
        defaultTraits,
        defaultSoma,
        defaultNeuro,
        false
      );
      
      // socialCost should remain 0 (no filter in USER_REPLY)
      expect(result.socialCost).toBe(0);
    });
  });
});
