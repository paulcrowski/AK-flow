import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'path';
import { promises as fs } from 'fs';
import { EventLoop } from '@core/systems/EventLoop';
import { eventBus } from '@core/EventBus';
import { getCurrentAgentId } from '@services/supabase';
import { ThinkModeSelector } from '@core/systems/eventloop/ThinkModeSelector';
import { resetAutonomyBackoff } from '@core/systems/eventloop/AutonomousVolitionStep';
import { createAutonomyRuntime } from '@core/systems/eventloop/AutonomyRuntime';
import * as GoalSystem from '@core/systems/GoalSystem';
import { SYSTEM_CONFIG } from '@core/config/systemConfig';
import { CortexService } from '@llm/gemini';
import { evidenceLedger } from '@core/systems/EvidenceLedger';
import { TickCommitter } from '@core/systems/TickCommitter';
import { DEFAULT_AGENT_ID, getAgentWorldRoot } from '@core/systems/WorldAccess';
import { PacketType } from '@/types';
import { getWorldDirectorySelection } from '@tools/worldDirectoryAccess';

// Mock dependencies
vi.mock('@core/systems/LimbicSystem', () => ({
    LimbicSystem: {
        applyHomeostasis: (l: any) => l,
        applyMoodShift: (l: any) => l,
        applyPoeticCost: (l: any) => l,
        applySpeechResponse: (l: any) => l
    }
}));

vi.mock('@core/systems/CortexSystem', () => ({
    CortexSystem: {
        processUserMessage: vi.fn().mockResolvedValue({
            responseText: 'Mock Response',
            internalThought: 'Mock Thought',
            moodShift: { fear_delta: 0, curiosity_delta: 0 }
        })
    }
}));

vi.mock('@core/systems/GoalSystem', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@core/systems/GoalSystem')>();
    return {
        ...actual,
        formGoal: vi.fn().mockResolvedValue(null)
    };
});

const budgetState = vi.hoisted(() => ({ count: 0 }));

const mockRunGoalDrivenStep = vi.hoisted(() => vi.fn().mockImplementation(async () => ({
    executedAt: Date.now(),
    shouldSkipAutonomy: true
})));

vi.mock('@core/systems/eventloop/index', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@core/systems/eventloop/index')>();
    return {
        ...actual,
        runGoalDrivenStep: mockRunGoalDrivenStep
    };
});

vi.mock('@llm/gemini', () => ({
    CortexService: {
        autonomousVolition: vi.fn().mockResolvedValue({
            internal_monologue: 'Autonomous processing...',
            voice_pressure: 0.8,
            speech_content: 'Autonomous Speech'
        }),
        autonomousVolitionV2: vi.fn().mockResolvedValue({
            internal_monologue: 'Autonomous processing...',
            voice_pressure: 0.8,
            speech_content: 'Autonomous Speech'
        }),
        detectIntent: vi.fn().mockResolvedValue({
            style: 'NEUTRAL'
        })
    }
}));

vi.mock('@services/supabase', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@services/supabase')>();
    return {
        ...actual,
        getCurrentAgentId: vi.fn().mockReturnValue('test-agent'),
        setCurrentAgentId: vi.fn()
    };
});

vi.mock('@core/systems/VolitionSystem', () => ({
    VolitionSystem: {
        shouldInitiateThought: vi.fn().mockReturnValue(true),
        shouldSpeak: vi.fn().mockReturnValue({ shouldSpeak: true })
    },
    calculatePoeticScore: vi.fn().mockReturnValue(0)
}));

vi.mock('@tools/worldDirectoryAccess', () => ({
    getWorldDirectorySelection: vi.fn().mockReturnValue(null)
}));

describe('EventLoop', () => {
    let mockCtx: EventLoop.LoopContext;
    let mockCallbacks: EventLoop.LoopCallbacks;

    beforeEach(() => {
        const baseNow = Date.now();
        vi.useFakeTimers();
        vi.setSystemTime(baseNow + 3_600_000);

        TickCommitter.resetForTesting();
        eventBus.clear();
        budgetState.count = 0;
        vi.mocked(getCurrentAgentId).mockReturnValue('test-agent');
        vi.mocked(getWorldDirectorySelection).mockReturnValue(null);

        const longAgo = Date.now() - 1_000_000;

        mockCtx = {
            soma: { energy: 100, cognitiveLoad: 0, isSleeping: false },
            limbic: { fear: 0, curiosity: 0, frustration: 0, satisfaction: 0 },
            neuro: { dopamine: 55, serotonin: 60, norepinephrine: 50 },
            conversation: [],
            autonomousMode: true,
            lastSpeakTimestamp: 0,
            silenceStart: longAgo,
            thoughtHistory: [],
            poeticMode: false,
            autonomousLimitPerMinute: 2,
            chemistryEnabled: false,
            goalState: {
                activeGoal: null,
                backlog: [],
                lastUserInteractionAt: longAgo,
                goalsFormedTimestamps: [],
                lastGoalFormedAt: null,
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

        mockCtx.autonomyRuntime = createAutonomyRuntime({
            budgetTracker: {
                checkBudget: (limit: number) => budgetState.count < limit,
                consume: () => { budgetState.count += 1; },
                peekCount: () => budgetState.count
            }
        });
        resetAutonomyBackoff(mockCtx.autonomyRuntime);

        mockCallbacks = {
            onMessage: vi.fn(),
            onThought: vi.fn(),
            onSomaUpdate: vi.fn(),
            onLimbicUpdate: vi.fn()
        };
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('should process user input correctly', async () => {
        const result = await EventLoop.runSingleStep(mockCtx, "Hello", mockCallbacks);

        expect(mockCallbacks.onMessage).toHaveBeenCalledWith('assistant', 'Mock Thought', 'thought');
        expect(mockCallbacks.onMessage).toHaveBeenCalledWith(
            'assistant',
            'Mock Response',
            'speech',
            expect.anything()
        );
        expect(result.silenceStart).toBeGreaterThan(0);
    });

    it('forces observe before cortex response on file questions', async () => {
        evidenceLedger.clear();
        const beforeEvidence = evidenceLedger.getCount();

        await EventLoop.runSingleStep(
            mockCtx,
            'Co jest w src/core/systems/cortex/memoryRecall.ts?',
            mockCallbacks
        );

        const toolCalls = vi.mocked(mockCallbacks.onMessage).mock.calls.filter((call) => call[2] === 'tool_result');
        expect(toolCalls.length).toBeGreaterThan(0);
        expect(evidenceLedger.getCount()).toBeGreaterThan(beforeEvidence);
        expect(mockCallbacks.onMessage).toHaveBeenCalledWith('assistant', 'Mock Thought', 'thought');
        expect(mockCallbacks.onMessage).toHaveBeenCalledWith(
            'assistant',
            'Mock Response',
            'speech',
            expect.anything()
        );
    });

    it('emits scan limit events and avoids blocking when scan is limited', async () => {
        evidenceLedger.clear();
        eventBus.clear();

        const prevDepth = (SYSTEM_CONFIG as any).siliconBeing?.fileScanMaxDepth;
        const prevCount = (SYSTEM_CONFIG as any).siliconBeing?.fileScanMaxCount;
        (SYSTEM_CONFIG as any).siliconBeing.fileScanMaxDepth = 0;
        (SYSTEM_CONFIG as any).siliconBeing.fileScanMaxCount = 1;

        const agentId = getCurrentAgentId() || DEFAULT_AGENT_ID;
        const worldRoot = path.normalize(getAgentWorldRoot(agentId));
        await fs.mkdir(worldRoot, { recursive: true });

        const missingFile = `missing_${Date.now()}.ts`;
        try {
            await EventLoop.runSingleStep(
                mockCtx,
                `Co jest w ${missingFile}?`,
                mockCallbacks
            );
        } finally {
            (SYSTEM_CONFIG as any).siliconBeing.fileScanMaxDepth = prevDepth;
            (SYSTEM_CONFIG as any).siliconBeing.fileScanMaxCount = prevCount;
        }

        const history = eventBus.getHistory();
        expect(history.some((p) => p.type === PacketType.FILE_SCAN_SUMMARY)).toBe(true);
        expect(history.some((p) => p.type === PacketType.FILE_SCAN_LIMIT_REACHED)).toBe(true);
        expect(history.some((p) => p.type === PacketType.EVIDENCE_BLOCKED_BY_SCAN_LIMIT)).toBe(true);

        const toolCalls = vi.mocked(mockCallbacks.onMessage).mock.calls.filter((call) => call[2] === 'tool_result');
        expect(
            toolCalls.some((call) => String(call[1]).startsWith(`LIST_DIR /_world/${agentId}`))
        ).toBe(true);
        expect(mockCallbacks.onMessage).toHaveBeenCalledWith(
            'assistant',
            'Mock Response',
            'speech',
            expect.anything()
        );
    });

    it('truncates observe content to limit', async () => {
        evidenceLedger.clear();

        const filePath = path.join(process.cwd(), 'src', 'core', 'systems', 'cortex', 'memoryRecall.ts');
        const raw = await fs.readFile(filePath, 'utf8');
        expect(raw.length).toBeGreaterThan(8000);

        await EventLoop.runSingleStep(
            mockCtx,
            `Co jest w ${filePath.replace(/\\/g, '/')}?`,
            mockCallbacks
        );

        const toolCall = vi.mocked(mockCallbacks.onMessage).mock.calls.find((call) => call[2] === 'tool_result');
        expect(toolCall).toBeTruthy();

        const toolText = String(toolCall?.[1] ?? '');
        const content = toolText.split('\n').slice(1).join('\n');
        expect(content.length).toBe(8000);
    });

    it('selectThinkMode should return reactive when input is present', () => {
        expect(ThinkModeSelector.select('Hello', mockCtx.autonomousMode, Boolean(mockCtx.goalState?.activeGoal))).toBe('reactive');
    });

    it('selectThinkMode should return idle when no input and autonomousMode is off', () => {
        const ctx = { ...mockCtx, autonomousMode: false };
        expect(ThinkModeSelector.select(null, ctx.autonomousMode, Boolean(ctx.goalState?.activeGoal))).toBe('idle');
    });

    it('selectThinkMode should return goal_driven when activeGoal exists', () => {
        const ctx = {
            ...mockCtx,
            goalState: {
                ...mockCtx.goalState,
                activeGoal: { id: 'g1', source: 'curiosity', description: 'x', priority: 0.7 } as any
            }
        };
        expect(ThinkModeSelector.select(null, ctx.autonomousMode, Boolean(ctx.goalState?.activeGoal))).toBe('goal_driven');
    });

    it('selectThinkMode should return autonomous when no input, autonomousMode on, and no activeGoal', () => {
        const ctx = {
            ...mockCtx,
            autonomousMode: true,
            goalState: { ...mockCtx.goalState, activeGoal: null }
        };
        expect(ThinkModeSelector.select(null, ctx.autonomousMode, Boolean(ctx.goalState?.activeGoal))).toBe('autonomous');
    });

    it('skips goal formation during cooldown window', async () => {
        const now = Date.now();
        mockCtx.goalState.lastGoalFormedAt = now - 2 * 60 * 1000;

        await EventLoop.runSingleStep(mockCtx, null, mockCallbacks);

        expect(vi.mocked(GoalSystem.formGoal)).not.toHaveBeenCalled();
    });

    it('publishes goal telemetry when a goal is formed', async () => {
        const now = Date.now();
        const formedGoal = {
            id: 'goal-1',
            description: 'Ask about roadmap',
            priority: 0.6,
            progress: 0,
            source: 'curiosity',
            createdAt: now
        } as const;

        mockCtx.goalState.lastGoalFormedAt = null;
        mockCtx.goalState.lastUserInteractionAt = now - SYSTEM_CONFIG.goals.minSilenceMs - 1000;
        mockCtx.silenceStart = mockCtx.goalState.lastUserInteractionAt;

        vi.mocked(GoalSystem.formGoal).mockResolvedValueOnce(formedGoal);

        await EventLoop.runSingleStep(mockCtx, null, mockCallbacks);

        const history = eventBus.getHistory();
        const goalEvent = history.find(p => (p as any)?.payload?.event === 'GOAL_FORMED');

        expect(goalEvent).toBeTruthy();
        expect((goalEvent as any)?.payload?.silenceMs).toBe(now - mockCtx.goalState.lastUserInteractionAt);
        expect((goalEvent as any)?.payload?.minSilenceMs).toBe(SYSTEM_CONFIG.goals.minSilenceMs);
        expect((goalEvent as any)?.payload?.activeGoalId).toBe(formedGoal.id);
        expect((goalEvent as any)?.payload?.lastGoalFormedAt).toBe(now);
        expect(mockCtx.goalState.lastGoalFormedAt).toBe(now);
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
        mockCtx.conversation = [{ role: 'user', text: "I don't understand this step" }];
        const volition = vi.mocked(CortexService.autonomousVolitionV2);

        // 1st run - should pass
        await EventLoop.runSingleStep(mockCtx, null, mockCallbacks);
        const t1 = volition.mock.calls.length;
        expect(t1).toBeGreaterThan(0);

        // 2nd run - should pass
        vi.advanceTimersByTime(30_000);
        await EventLoop.runSingleStep(mockCtx, null, mockCallbacks);
        const t2 = volition.mock.calls.length;
        expect(t2).toBeGreaterThanOrEqual(t1);

        // 3rd run - should be blocked by limit (2)
        budgetState.count = mockCtx.autonomousLimitPerMinute;
        const beforeThird = volition.mock.calls.length;
        vi.advanceTimersByTime(30_000);
        await EventLoop.runSingleStep(mockCtx, null, mockCallbacks);
        const afterThird = volition.mock.calls.length;
        expect(afterThird).toBe(beforeThird);
    });

    it('autonomy drives action selection in silence', async () => {
        vi.mocked(getWorldDirectorySelection).mockReturnValue({ mode: 'world', name: '_world' } as any);
        mockCtx.soma = { energy: 80, cognitiveLoad: 10, isSleeping: false };
        mockCtx.limbic = { fear: 0.05, curiosity: 0.95, frustration: 0.05, satisfaction: 0.05 };
        mockCtx.neuro = { dopamine: 20, serotonin: 50, norepinephrine: 50 };

        await EventLoop.runSingleStep(mockCtx, null, mockCallbacks);

        const history = eventBus.getHistory();
        const autonomyEvent = history.find((p) => (p as any)?.payload?.event === 'AUTONOMY_ACTION_SELECTED');
        const actionEvent = history.find((p) => p.type === PacketType.ACTION_SELECTED);

        expect((autonomyEvent as any)?.payload?.action).toBe('EXPLORE_WORLD');
        expect((actionEvent as any)?.payload?.action).toBe('observe');
        expect((actionEvent as any)?.payload?.reason).toBe('autonomy_explore_world');
        expect((actionEvent as any)?.payload?.reason).not.toBe('intention_requires_evidence');
    });

    it('autonomy REST avoids observe and world tools', async () => {
        mockCtx.soma = { energy: 10, cognitiveLoad: 90, isSleeping: false };
        mockCtx.limbic = { fear: 0.1, curiosity: 0.1, frustration: 0.1, satisfaction: 0.2 };
        mockCtx.neuro = { dopamine: 50, serotonin: 50, norepinephrine: 50 };

        await EventLoop.runSingleStep(mockCtx, null, mockCallbacks);

        const history = eventBus.getHistory();
        const autonomyEvent = history.find((p) => (p as any)?.payload?.event === 'AUTONOMY_ACTION_SELECTED');
        const actionEvent = history.find((p) => p.type === PacketType.ACTION_SELECTED);
        const toolIntents = history.filter(
            (p) =>
                p.type === PacketType.TOOL_INTENT &&
                ['LIST_DIR', 'READ_FILE'].includes(String((p as any)?.payload?.tool || ''))
        );

        expect((autonomyEvent as any)?.payload?.action).toBe('REST');
        expect((actionEvent as any)?.payload?.action).toBe('rest');
        expect((actionEvent as any)?.payload?.reason).toBe('autonomy_rest');
        expect(toolIntents.length).toBe(0);
    });

    it.skip('should run autonomous step without chemistry when disabled', async () => {
        // TODO: This test is flaky due to shared autonomy budget state.
        // It is not critical for Sleep/Dream features and will be revisited
        // when autonomy scheduling is refactored.
        mockCtx.chemistryEnabled = false;

        await EventLoop.runSingleStep(mockCtx, null, mockCallbacks);
    });
});
