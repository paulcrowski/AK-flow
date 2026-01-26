import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventLoop } from '@core/systems/EventLoop';
import { createAutonomyRuntime } from '@core/systems/eventloop/AutonomyRuntime';
import { SYSTEM_CONFIG } from '@core/config/systemConfig';

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

vi.mock('@core/systems/eventloop/index', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@core/systems/eventloop/index')>();
  return {
    ...actual,
    runAutonomousVolitionStep: vi.fn(async ({ ctx }: { ctx: any }) => {
      ctx.autonomyRuntime?.budgetTracker.consume();
    })
  };
});

vi.mock('@services/supabase', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@services/supabase')>();
  return {
    ...actual,
    getCurrentAgentId: vi.fn().mockReturnValue('test-agent'),
    getCurrentAgentName: vi.fn().mockReturnValue('Alpha'),
    setCurrentAgentId: vi.fn()
  };
});

vi.mock('@tools/worldDirectoryAccess', () => ({
  getWorldDirectorySelection: vi.fn().mockReturnValue(null)
}));

describe('EventLoop autonomy runtime isolation', () => {
  const baseCtx = () => {
    const now = Date.now();
    return {
      soma: { energy: 100, cognitiveLoad: 0, isSleeping: false },
      limbic: { fear: 0, curiosity: 0, frustration: 0, satisfaction: 0 },
      neuro: { dopamine: 55, serotonin: 60, norepinephrine: 50 },
      conversation: [],
      autonomousMode: true,
      lastSpeakTimestamp: 0,
      silenceStart: now - 120000,
      thoughtHistory: [],
      poeticMode: false,
      autonomousLimitPerMinute: 2,
      chemistryEnabled: false,
      goalState: {
        activeGoal: null,
        backlog: [],
        lastUserInteractionAt: now - 120000,
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
      ticksSinceLastReward: 0,
      hadExternalRewardThisTick: false
    };
  };

  const callbacks = {
    onMessage: vi.fn(),
    onThought: vi.fn(),
    onSomaUpdate: vi.fn(),
    onLimbicUpdate: vi.fn()
  };

  let prevSiliconEnabled: boolean | undefined;

  beforeEach(() => {
    prevSiliconEnabled = (SYSTEM_CONFIG as any).siliconBeing?.enabled;
    (SYSTEM_CONFIG as any).siliconBeing.enabled = false;
  });

  afterEach(() => {
    (SYSTEM_CONFIG as any).siliconBeing.enabled = prevSiliconEnabled;
  });

  it('keeps tickCount and budget independent per context', async () => {
    const ctxA = { ...baseCtx(), autonomyRuntime: createAutonomyRuntime() };
    const ctxB = { ...baseCtx(), autonomyRuntime: createAutonomyRuntime() };

    await EventLoop.runSingleStep(ctxA as any, null, callbacks);

    expect(ctxA.autonomyRuntime?.tickCount).toBe(1);
    expect(ctxB.autonomyRuntime?.tickCount).toBe(0);
    expect(ctxA.autonomyRuntime?.budgetTracker.peekCount()).toBe(1);
    expect(ctxB.autonomyRuntime?.budgetTracker.peekCount()).toBe(0);

    await EventLoop.runSingleStep(ctxB as any, null, callbacks);

    expect(ctxB.autonomyRuntime?.tickCount).toBe(1);
    expect(ctxA.autonomyRuntime?.tickCount).toBe(1);
    expect(ctxB.autonomyRuntime?.budgetTracker.peekCount()).toBe(1);
    expect(ctxA.autonomyRuntime?.budgetTracker.peekCount()).toBe(1);
  });
});
