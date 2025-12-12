import { describe, it, expect, beforeEach } from 'vitest';
import { TraitEvolutionEngine } from '../../core/systems/TraitEvolutionEngine';
import { eventBus } from '../../core/EventBus';
import { PacketType, AgentType, TraitVector, TraitVote } from '../../types';
import { waitForEventBus } from '../utils';

const baseTraits: TraitVector = {
    arousal: 0.5,
    verbosity: 0.5,
    conscientiousness: 0.5,
    socialAwareness: 0.5,
    curiosity: 0.5
};

// Helper: publish and wait
const publishAndWait = async (packet: any) => {
    eventBus.publish(packet);
    await waitForEventBus();
};

describe('TraitEvolutionEngine', () => {
    let engine: TraitEvolutionEngine;

    beforeEach(async () => {
        eventBus.clear();
        engine = new TraitEvolutionEngine();
        await waitForEventBus();
    });

    describe('Signal Collection', () => {
        it('collects signals from CONFESSION_REPORT', async () => {
            const vote: TraitVote = {
                dimension: 'verbosity',
                direction: 'decrease',
                weight: 1,
                reason: 'test',
                is_success: false
            };

            await publishAndWait({
                id: 'test-1',
                timestamp: Date.now(),
                source: AgentType.MORAL,
                type: PacketType.CONFESSION_REPORT,
                payload: { recommended_regulation: { trait_vote: vote } },
                priority: 1
            });

            expect(engine.getSignalCount()).toBe(1);
        });

        it('collects signals from TRAIT_EVOLUTION_SIGNAL', async () => {
            const vote: TraitVote = {
                dimension: 'conscientiousness',
                direction: 'increase',
                weight: 1,
                reason: 'positive_feedback',
                is_success: true
            };

            await publishAndWait({
                id: 'test-2',
                timestamp: Date.now(),
                source: AgentType.MORAL,
                type: PacketType.TRAIT_EVOLUTION_SIGNAL,
                payload: vote,
                priority: 1
            });

            expect(engine.getSignalCount()).toBe(1);
        });
    });

    describe('Evolution Rules', () => {
        it('does NOT propose with insufficient signals', async () => {
            await publishAndWait({
                id: 'test-3',
                timestamp: Date.now(),
                source: AgentType.MORAL,
                type: PacketType.TRAIT_EVOLUTION_SIGNAL,
                payload: { dimension: 'verbosity', direction: 'decrease', weight: 1, reason: 'test', is_success: false } as TraitVote,
                priority: 1
            });

            const proposal = engine.evaluateEvolution(baseTraits);
            expect(proposal).toBeNull();
        });

        it('does NOT propose with mixed signals (net < 3)', async () => {
            for (let i = 0; i < 2; i++) {
                await publishAndWait({
                    id: `dec-${i}`,
                    timestamp: Date.now(),
                    source: AgentType.MORAL,
                    type: PacketType.TRAIT_EVOLUTION_SIGNAL,
                    payload: { dimension: 'verbosity', direction: 'decrease', weight: 1, reason: 'test', is_success: false } as TraitVote,
                    priority: 1
                });
            }
            await publishAndWait({
                id: 'inc-0',
                timestamp: Date.now(),
                source: AgentType.MORAL,
                type: PacketType.TRAIT_EVOLUTION_SIGNAL,
                payload: { dimension: 'verbosity', direction: 'increase', weight: 1, reason: 'test', is_success: true } as TraitVote,
                priority: 1
            });

            const proposal = engine.evaluateEvolution(baseTraits);
            expect(proposal).toBeNull();
        });
    });

    describe('Success-Based Evolution', () => {
        it('balances failures with successes', async () => {
            for (let i = 0; i < 3; i++) {
                await publishAndWait({
                    id: `fail-${i}`,
                    timestamp: Date.now(),
                    source: AgentType.MORAL,
                    type: PacketType.TRAIT_EVOLUTION_SIGNAL,
                    payload: { dimension: 'verbosity', direction: 'decrease', weight: 1, reason: 'fail', is_success: false } as TraitVote,
                    priority: 1
                });
            }
            for (let i = 0; i < 3; i++) {
                await publishAndWait({
                    id: `success-${i}`,
                    timestamp: Date.now(),
                    source: AgentType.MORAL,
                    type: PacketType.TRAIT_EVOLUTION_SIGNAL,
                    payload: { dimension: 'verbosity', direction: 'increase', weight: 1, reason: 'success', is_success: true } as TraitVote,
                    priority: 1
                });
            }

            const proposal = engine.evaluateEvolution(baseTraits);
            expect(proposal).toBeNull();
        });
    });
});
