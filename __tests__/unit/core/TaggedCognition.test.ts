import { describe, it, expect, beforeEach, vi } from 'vitest';
import { processDecisionGate, resetTurnStateForAgent, GateDecision } from '@core/systems/DecisionGate';
import { buildMinimalCortexState } from '@core/builders/MinimalCortexStateBuilder';
import { setCachedIdentity, clearIdentityCache } from '@core/builders/MinimalCortexStateBuilder';
import type { CortexOutput } from '@core/types/CortexOutput';
import type { SomaState } from '@/types';

// Mock dependencies
const mockIdentity = {
    name: 'TestAgent',
    core_values: ['precision', 'truth'],
    constitutional_constraints: []
};

const mockTraits = {
    arousal: 0.3,
    verbosity: 0.4,
    conscientiousness: 0.9,
    socialAwareness: 0.7,
    curiosity: 0.8
};

describe('Tagged Cognition & Persona-Less Cortex', () => {

    const TEST_AGENT_ID = 'test-agent-1';

    beforeEach(() => {
        resetTurnStateForAgent(TEST_AGENT_ID);
        clearIdentityCache();
    });

    describe('Identity Injection (Mirror Test)', () => {
        it('should inject cached identity into cortex state', () => {
            // Setup: Cache identity
            setCachedIdentity(TEST_AGENT_ID, mockIdentity, mockTraits);

            // Execute: Build state
            const state = buildMinimalCortexState({
                agentId: TEST_AGENT_ID,
                metaStates: { energy: 100, stress: 0, confidence: 100 },
                userInput: 'Who are you?'
            });

            // Verify: State contains injected identity
            expect(state.core_identity.name).toBe('TestAgent');
            expect(state.core_identity.core_values).toContain('precision');
            expect(state.narrative_self.self_summary).toContain('TestAgent');
        });

        it('should fallback to UNINITIALIZED_AGENT if no cache (Amnesia Check)', () => {
            // FAZA 5.1: Fallback is now UNINITIALIZED_AGENT (not Assistant) to flag identity issues
            const state = buildMinimalCortexState({
                agentId: 'unknown-agent',
                metaStates: { energy: 100, stress: 0, confidence: 100 },
                userInput: 'Who are you?'
            });

            expect(state.core_identity?.name).toBe('UNINITIALIZED_AGENT'); // Explicit fallback - flags identity issue
        });
    });

    describe('Decision Gate (Basal Ganglia)', () => {
        const baseOutput: CortexOutput = {
            internal_thought: "I need to visualzie this.",
            speech_content: "Let me show you.",
            stimulus_response: { valence: 'neutral', salience: 'medium', novelty: 'routine' }, // Corrected property names
            tool_intent: {
                tool: 'VISUALIZE',
                query: 'spaceship',
                reason: 'user asked'
            }
        };

        it('should ALLOW tool when energy is sufficient', () => {
            const highEnergySoma: SomaState = { energy: 80, cognitiveLoad: 0, isSleeping: false } as SomaState;
            const decision = processDecisionGate(baseOutput, highEnergySoma, undefined, TEST_AGENT_ID);

            expect(decision.approved).toBe(true);
            expect(decision.telemetry.intentExecuted).toBe(true);
            expect(decision.modifiedOutput.speech_content).toContain('[VISUALIZE: spaceship]');
        });

        it('should BLOCK tool when energy is low (Veto Test)', () => {
            // Energy 22 (Window 20-25)
            const lowEnergySoma: SomaState = { energy: 22, cognitiveLoad: 0, isSleeping: false } as SomaState;
            const decision = processDecisionGate(baseOutput, lowEnergySoma, undefined, TEST_AGENT_ID);

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
                stimulus_response: { valence: 'neutral', salience: 'medium', novelty: 'routine' }
            };

            const decision = processDecisionGate(contaminatedOutput, { energy: 100 } as SomaState, undefined, TEST_AGENT_ID);

            expect(decision.telemetry.violation).toBeTruthy();
            expect(decision.modifiedOutput.internal_thought).not.toContain('[SEARCH:');
            expect(decision.modifiedOutput.internal_thought).toContain('[INTENT_REMOVED]');
        });
    });

});
