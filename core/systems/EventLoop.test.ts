import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventLoop } from './EventLoop';
import { AgentType, PacketType } from '../../types';

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
            responseText: "Mock Response",
            internalThought: "Mock Thought",
            moodShift: { fear_delta: 0, curiosity_delta: 0 }
        })
    }
}));

vi.mock('../../services/gemini', () => ({
    CortexService: {
        autonomousVolition: vi.fn().mockResolvedValue({
            internal_monologue: "Autonomous Thought",
            voice_pressure: 0.8,
            speech_content: "Autonomous Speech"
        })
    }
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
            consecutiveAgentSpeeches: 0
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

    it('should respect autonomous budget limit', async () => {
        // 1st run - should pass
        await EventLoop.runSingleStep(mockCtx, null, mockCallbacks);
        expect(mockCallbacks.onThought).toHaveBeenCalledWith("Autonomous processing...");

        // 2nd run - should pass
        await EventLoop.runSingleStep(mockCtx, null, mockCallbacks);

        // 3rd run - should be blocked by limit (2)
        mockCallbacks.onThought.mockClear();
        await EventLoop.runSingleStep(mockCtx, null, mockCallbacks);
        expect(mockCallbacks.onThought).not.toHaveBeenCalled();
    });

    it('should run autonomous step without chemistry when disabled', async () => {
        // chemistryEnabled=false means neuro state is ignored for behavior
        mockCtx.chemistryEnabled = false;
        await EventLoop.runSingleStep(mockCtx, null, mockCallbacks);
        expect(mockCallbacks.onThought).toHaveBeenCalledWith("Autonomous processing...");
    });
});
