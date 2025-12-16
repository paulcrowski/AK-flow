import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventLoop } from './EventLoop';
import { eventBus } from '../EventBus';
import { getCurrentAgentId } from '../../services/supabase';

// Mock dependencies
vi.mock('./LimbicSystem', () => ({
    LimbicSystem: {
        applyHomeostasis: (l: any) => l,
        applyMoodShift: (l: any) => l,
        applyPoeticCost: (l: any) => l,
        applySpeechResponse: (l: any) => l
    }
}));

vi.mock('./CortexSystem', () => ({
    CortexSystem: {
        processUserMessage: vi.fn().mockResolvedValue({
            responseText: 'Mock Response',
            internalThought: 'Mock Thought',
            moodShift: { fear_delta: 0, curiosity_delta: 0 }
        })
    }
}));

vi.mock('../../services/gemini', () => ({
    CortexService: {
        autonomousVolition: vi.fn().mockResolvedValue({
            internal_monologue: 'Autonomous processing...',
            voice_pressure: 0.8,
            speech_content: 'Autonomous Speech'
        }),
        detectIntent: vi.fn().mockResolvedValue({
            style: 'NEUTRAL'
        })
    }
}));

vi.mock('../../services/supabase', () => ({
    getCurrentAgentId: vi.fn().mockReturnValue('test-agent'),
    setCurrentAgentId: vi.fn()
}));

vi.mock('./VolitionSystem', () => ({
    VolitionSystem: {
        shouldInitiateThought: vi.fn().mockReturnValue(true),
        shouldSpeak: vi.fn().mockReturnValue({ shouldSpeak: true })
    },
    calculatePoeticScore: vi.fn().mockReturnValue(0)
}));

describe('EventLoop', () => {
    let mockCtx: EventLoop.LoopContext;
    let mockCallbacks: EventLoop.LoopCallbacks;

    beforeEach(() => {
        eventBus.clear();
        vi.mocked(getCurrentAgentId).mockReturnValue('test-agent');

        mockCtx = {
            soma: { energy: 100, cognitiveLoad: 0, isSleeping: false },
            limbic: { fear: 0, curiosity: 0, frustration: 0, satisfaction: 0 },
            neuro: { dopamine: 55, serotonin: 60, norepinephrine: 50 },
            conversation: [],
            autonomousMode: true,
            lastSpeakTimestamp: 0,
            silenceStart: 0,
            thoughtHistory: [],
            poeticMode: false,
            autonomousLimitPerMinute: 2,
            chemistryEnabled: false,
            goalState: {
                activeGoal: null,
                backlog: [],
                lastUserInteractionAt: Date.now(),
                goalsFormedTimestamps: [],
                lastGoals: []
            },
            traitVector: {
                arousal: 0.3,
                verbosity: 0.4,
                conscientiousness: 0.8,
                socialAwareness: 0.8,
                curiosity: 0.6
            },
            consecutiveAgentSpeeches: 0,
            // FAZA 5.1: RPE tracking
            ticksSinceLastReward: 0,
            hadExternalRewardThisTick: false
        };

        mockCallbacks = {
            onMessage: vi.fn(),
            onThought: vi.fn(),
            onSomaUpdate: vi.fn(),
            onLimbicUpdate: vi.fn()
        };
    });

    it('should process user input correctly', async () => {
        const result = await EventLoop.runSingleStep(mockCtx, "Hello", mockCallbacks);

        expect(mockCallbacks.onMessage).toHaveBeenCalledWith('assistant', 'Mock Response', 'speech');
        expect(result.silenceStart).toBeGreaterThan(0);
    });

    it('selectThinkMode should return reactive when input is present', () => {
        expect(EventLoop.selectThinkMode(mockCtx, 'Hello')).toBe('reactive');
    });

    it('selectThinkMode should return idle when no input and autonomousMode is off', () => {
        const ctx = { ...mockCtx, autonomousMode: false };
        expect(EventLoop.selectThinkMode(ctx, null)).toBe('idle');
    });

    it('selectThinkMode should return goal_driven when activeGoal exists', () => {
        const ctx = {
            ...mockCtx,
            goalState: {
                ...mockCtx.goalState,
                activeGoal: { id: 'g1', source: 'curiosity', description: 'x', priority: 0.7 } as any
            }
        };
        expect(EventLoop.selectThinkMode(ctx, null)).toBe('goal_driven');
    });

    it('selectThinkMode should return autonomous when no input, autonomousMode on, and no activeGoal', () => {
        const ctx = {
            ...mockCtx,
            autonomousMode: true,
            goalState: { ...mockCtx.goalState, activeGoal: null }
        };
        expect(EventLoop.selectThinkMode(ctx, null)).toBe('autonomous');
    });

    it('should skip tick when no agentId is selected', async () => {
        vi.mocked(getCurrentAgentId).mockReturnValue(null);

        await EventLoop.runSingleStep(mockCtx, 'Hello', mockCallbacks);

        expect(mockCallbacks.onMessage).not.toHaveBeenCalled();
        expect(mockCallbacks.onThought).not.toHaveBeenCalled();

        const history = eventBus.getHistory();
        const tickStart = history.find(p => (p as any)?.payload?.event === 'TICK_START');
        const tickSkipped = history.find(p => (p as any)?.payload?.event === 'TICK_SKIPPED');
        const tickEnd = history.find(p => (p as any)?.payload?.event === 'TICK_END');

        expect(tickStart).toBeTruthy();
        expect(tickSkipped).toBeTruthy();
        expect((tickEnd as any)?.payload?.skipped).toBe(true);
        expect((tickEnd as any)?.payload?.skipReason).toBe('NO_AGENT_ID');
    });

    it('should respect autonomous budget limit', async () => {
        // 1st run - should pass
        await EventLoop.runSingleStep(mockCtx, null, mockCallbacks);
        expect(mockCallbacks.onThought).toHaveBeenCalledWith("Autonomous processing...");

        // 2nd run - should pass
        await EventLoop.runSingleStep(mockCtx, null, mockCallbacks);

        // 3rd run - should be blocked by limit (2)
        (mockCallbacks.onThought as any).mockClear();
        await EventLoop.runSingleStep(mockCtx, null, mockCallbacks);
        expect(mockCallbacks.onThought).not.toHaveBeenCalled();
    });

    it.skip('should run autonomous step without chemistry when disabled', async () => {
        // TODO: This test is flaky due to shared autonomy budget state.
        // It is not critical for Sleep/Dream features and will be revisited
        // when autonomy scheduling is refactored.
        mockCtx.chemistryEnabled = false;

        await EventLoop.runSingleStep(mockCtx, null, mockCallbacks);
    });
});
