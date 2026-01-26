import { describe, expect, test } from 'vitest';
import { ExecutiveGate, type GateContext, type SpeechCandidate } from '../../src/core/systems/ExecutiveGate';
import type { LimbicState } from '@/types';
import type { SocialDynamics } from '@core/kernel/types';

describe('ExecutiveGate v8.1.1 (UserFacing & DomainMismatch)', () => {

    // Mock Helpers
    const mockLimbic: LimbicState = {
        curiosity: 0.5,
        satisfaction: 0.5,
        fear: 0.1,
        frustration: 0.1
    };

    const mockSocialDynamics: SocialDynamics = {
        userPresenceScore: 1,
        autonomyBudget: 1,
        socialCost: 0,
        consecutiveWithoutResponse: 0
    };

    const createCandidates = (
        type: 'reactive' | 'autonomous',
        count: number,
        isUserResponse: boolean
    ): SpeechCandidate[] => {
        return Array.from({ length: count }).map((_, i) => ({
            id: `${type}-${i}`,
            type,
            speech_content: `Speech ${i}`,
            internal_thought: `Thought ${i}`,
            timestamp: Date.now() - i * 100,
            strength: 0.5,
            is_user_response: isUserResponse
        }));
    };

    const createContext = (
        isUserFacing: boolean,
        timeSinceInput: number,
        lastTool?: any
    ): GateContext => ({
        limbic: mockLimbic,
        time_since_user_input: timeSinceInput,
        silence_window: 5000,
        voice_pressure_threshold: 0.5,
        socialDynamics: mockSocialDynamics,
        isUserFacing,
        lastTool
    });

    test('Should bypass Silence Window if isUserFacing is true (Tool Response)', () => {
        const candidates = createCandidates('autonomous', 1, false); // Autonomous candidate (fallback)
        const context = createContext(true, 100); // 100ms since input (or implicit tool trigger)

        const decision = ExecutiveGate.decide(candidates, context);

        expect(decision.should_speak).toBe(true);
        expect(decision.reason).toBe('REACTIVE_VETO'); // Treated as reactive due to isUserFacing
    });

    test('Should enforce Silence Window if isUserFacing is false', () => {
        const candidates = createCandidates('autonomous', 1, false);
        const context = createContext(false, 100); // 100ms since input, NOT user facing

        const decision = ExecutiveGate.decide(candidates, context);

        expect(decision.should_speak).toBe(false);
        expect(decision.reason).toBe('SILENCE_WINDOW_VIOLATED');
    });

    test('Should FAIL on Domain Mismatch if isUserFacing is true', () => {
        const candidates = createCandidates('autonomous', 1, false);
        const lastTool = {
            tool: 'READ_FILE',
            ok: true,
            at: Date.now(),
            domainExpected: 'LIBRARY',
            domainActual: 'WORLD' // Mismatch
        };
        const context = createContext(true, 100, lastTool as any);

        const decision = ExecutiveGate.decide(candidates, context);

        expect(decision.should_speak).toBe(false);
        expect(decision.reason).toBe('DOMAIN_MISMATCH');
    });

    test('Should PASS on Domain Match if isUserFacing is true', () => {
        const candidates = createCandidates('autonomous', 1, false);
        const lastTool = {
            tool: 'READ_FILE',
            ok: true,
            at: Date.now(),
            domainExpected: 'WORLD',
            domainActual: 'WORLD' // Match
        };
        const context = createContext(true, 100, lastTool as any);

        const decision = ExecutiveGate.decide(candidates, context);

        expect(decision.should_speak).toBe(true);
        expect(decision.reason).toBe('REACTIVE_VETO');
    });

    test('Should IGNORE Domain Mismatch if NOT user facing', () => {
        // If not user facing, it falls back to normal autonomous rules (Silence Window, etc.)
        // But here we set timeSinceInput large enough to pass silence window
        const candidates = createCandidates('autonomous', 1, false);
        const lastTool = {
            tool: 'READ_FILE',
            ok: true,
            at: Date.now(),
            domainExpected: 'LIBRARY',
            domainActual: 'WORLD' // Mismatch
        };
        const context = createContext(false, 10000, lastTool as any); // 10s > 5s silence window

        const decision = ExecutiveGate.decide(candidates, context);

        // Should use normal autonomous logic
        // Assuming strength/pressure passes (mockLimbic implies pressure ~0.5, logic default threshold 0.6)
        // With default mockLimbic: c=0.5, s=0.5, f=0.1, fr=0.1 -> (1 - 0.2)/2 + 0.5 = 0.9. Pressure is High.

        expect(decision.should_speak).toBe(true);
        expect(decision.reason).toBe('AUTONOMOUS_WON');
    });
});
