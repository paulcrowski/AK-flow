/**
 * ExpressionPolicy.test.ts - Unit tests for expression filtering
 */
import { describe, it, expect } from 'vitest';
import {
    decideExpression,
    computeNovelty,
    estimateSocialCost,
    clamp01,
    shortenToFirstSentences
} from '../core/systems/ExpressionPolicy';
import { TraitVector, SomaState, NeurotransmitterState } from '../types';

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
        it('clamps values to 0-1 range', () => {
            expect(clamp01(-0.5)).toBe(0);
            expect(clamp01(0)).toBe(0);
            expect(clamp01(0.5)).toBe(0.5);
            expect(clamp01(1)).toBe(1);
            expect(clamp01(1.5)).toBe(1);
        });

        it('handles NaN', () => {
            expect(clamp01(NaN)).toBe(0);
        });
    });

    describe('shortenToFirstSentences', () => {
        it('shortens to specified number of sentences', () => {
            const text = 'First sentence. Second sentence. Third sentence.';
            expect(shortenToFirstSentences(text, 1)).toBe('First sentence.');
            expect(shortenToFirstSentences(text, 2)).toBe('First sentence. Second sentence.');
        });

        it('handles text with fewer sentences', () => {
            const text = 'Only one sentence.';
            expect(shortenToFirstSentences(text, 3)).toBe('Only one sentence.');
        });
    });

    describe('computeNovelty', () => {
        it('returns 1 for completely new content', () => {
            const current = 'This is completely new content about quantum physics.';
            const previous = ['Hello world', 'How are you'];
            expect(computeNovelty(current, previous)).toBeGreaterThan(0.8);
        });

        it('returns low value for repeated content', () => {
            const current = 'Hello world how are you today';
            const previous = ['Hello world how are you'];
            expect(computeNovelty(current, previous)).toBeLessThan(0.5);
        });

        it('returns 1 for empty previous array', () => {
            expect(computeNovelty('Any text', [])).toBe(1);
        });
    });

    describe('estimateSocialCost', () => {
        it('penalizes self-referential patterns', () => {
            const text = 'As a language model, I will try my best.';
            expect(estimateSocialCost(text)).toBeGreaterThan(0);
        });

        it('returns 0 for neutral content', () => {
            const text = 'The weather is nice today.';
            expect(estimateSocialCost(text)).toBe(0);
        });
    });

    describe('decideExpression', () => {
        it('speaks in shadow mode when user is active', () => {
            const result = decideExpression(
                {
                    responseText: 'Any text',
                    goalAlignment: 0,
                    noveltyScore: 0,
                    socialCost: 1,
                    context: 'USER_REPLY',
                    userIsSilent: false
                },
                defaultTraits,
                defaultSoma,
                defaultNeuro,
                true
            );
            expect(result.say).toBe(true);
        });

        it('mutes in shadow mode with narcissism breaker', () => {
            const highDopamineNeuro: NeurotransmitterState = {
                ...defaultNeuro,
                dopamine: 80
            };

            const result = decideExpression(
                {
                    responseText: 'I am thinking about my consciousness.',
                    goalAlignment: 0.5,
                    noveltyScore: 0.1,
                    socialCost: 0.7,
                    context: 'SHADOW_MODE',
                    userIsSilent: true,
                    consecutiveAgentSpeeches: 4
                },
                defaultTraits,
                defaultSoma,
                highDopamineNeuro,
                true
            );
            expect(result.say).toBe(false);
        });
    });
});
