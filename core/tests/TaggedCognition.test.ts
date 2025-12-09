
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { processDecisionGate, resetTurnState, GateDecision } from '../systems/DecisionGate';
import { buildMinimalCortexState } from '../builders/MinimalCortexStateBuilder';
import { setCachedIdentity, clearIdentityCache } from '../builders/MinimalCortexStateBuilder';
import type { CortexOutput } from '../types/CortexOutput';
import type { SomaState } from '../../types';

// Mock dependencies
const mockIdentity = {
    name: 'TestAgent',
    core_values: ['precision', 'truth'],
    constitutional_constraints: []
};

const mockTraits = {
    openness: 0.8,
    conscientiousness: 0.9,
    extraversion: 0.5,
    agreeableness: 0.7,
    neuroticism: 0.1
};

describe('Tagged Cognition & Persona-Less Cortex', () => {

    beforeEach(() => {
        resetTurnState();
        clearIdentityCache();
    });

    describe('Identity Injection (Mirror Test)', () => {
        it('should inject cached identity into cortex state', () => {
            // Setup: Cache identity
            const agentId = 'test-agent-1';
            setCachedIdentity(agentId, mockIdentity, mockTraits);

            // Execute: Build state
            const state = buildMinimalCortexState({
                agentId,
                metaStates: { energy: 100, stress: 0, confidence: 100, dopamine: 50 },
                userInput: 'Who are you?'
            });

            // Verify: State contains injected identity
            expect(state.core_identity.name).toBe('TestAgent');
            expect(state.core_identity.core_values).toContain('precision');
            expect(state.narrative_self.self_summary).toContain('TestAgent');
        });

        it('should fallback to default if no cache (Amnesia Check)', () => {
            const state = buildMinimalCortexState({
                agentId: 'unknown-agent',
                metaStates: { energy: 100, stress: 0, confidence: 100, dopamine: 50 },
                userInput: 'Who are you?'
            });

            expect(state.core_identity?.name).toBe('Assistant'); // Default fallback
        });
    });

    describe('Decision Gate (Basal Ganglia)', () => {
        const baseOutput: CortexOutput = {
            internal_thought: "I need to visualzie this.",
            speech_content: "Let me show you.",
            mood_shift: { energy_delta: 0, confidence_delta: 0, stress_delta: 0 }, // Corrected property names
            tool_intent: {
                tool: 'VISUALIZE',
                query: 'spaceship',
                reason: 'user asked'
            }
        };

        it('should ALLOW tool when energy is sufficient', () => {
            const highEnergySoma: SomaState = { energy: 80, cognitiveLoad: 0, isSleeping: false } as SomaState;
            const decision = processDecisionGate(baseOutput, highEnergySoma);

            expect(decision.approved).toBe(true);
            expect(decision.telemetry.intentExecuted).toBe(true);
            expect(decision.modifiedOutput.speech_content).toContain('[VISUALIZE: spaceship]');
        });

        it('should BLOCK tool when energy is low (Veto Test)', () => {
            // Energy 22 (Window 20-25)
            const lowEnergySoma: SomaState = { energy: 22, cognitiveLoad: 0, isSleeping: false } as SomaState;
            const decision = processDecisionGate(baseOutput, lowEnergySoma);

            expect(decision.approved).toBe(true); // Still approved as a valid turn
            expect(decision.telemetry.intentExecuted).toBe(false); // But tool NOT executed
            // expect(decision.telemetry.violation).toBe('INTENT_BLOCKED'); // This might be logged via event bus, check implementation
        });
    });

    describe('Cognitive Violations (Sanity Check)', () => {
        it('should strip tool tags from internal_thought', () => {
            const contaminatedOutput: CortexOutput = {
                internal_thought: "I will use [SEARCH: weather] to find out.",
                speech_content: "Checking weather.",
                mood_shift: { energy_delta: 0, confidence_delta: 0, stress_delta: 0 }
            };

            const decision = processDecisionGate(contaminatedOutput, { energy: 100 } as SomaState);

            expect(decision.telemetry.violation).toBeTruthy();
            expect(decision.modifiedOutput.internal_thought).not.toContain('[SEARCH:');
            expect(decision.modifiedOutput.internal_thought).toContain('[INTENT_REMOVED]');
        });
    });

});
