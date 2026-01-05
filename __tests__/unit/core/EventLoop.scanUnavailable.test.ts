import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import { eventBus } from '@core/EventBus';
import { PacketType } from '@/types';
import { evidenceLedger } from '@core/systems/EvidenceLedger';

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
    createAutonomyBudgetTracker: vi.fn(() => ({
      checkBudget: () => true,
      consume: () => {},
      peekCount: () => 0
    }))
  };
});

vi.mock('@services/supabase', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@services/supabase')>();
  return {
    ...actual,
    getCurrentAgentId: vi.fn().mockReturnValue('test-agent'),
    setCurrentAgentId: vi.fn(),
    getCurrentAgentName: vi.fn().mockReturnValue('Alpha')
  };
});

const originalVersions = process.versions;

describe('EventLoop scan availability', () => {
  beforeAll(() => {
    Object.defineProperty(process, 'versions', {
      value: { ...originalVersions, node: undefined },
      configurable: true
    });
  });

  afterAll(() => {
    Object.defineProperty(process, 'versions', {
      value: originalVersions,
      configurable: true
    });
  });

  beforeEach(() => {
    eventBus.clear();
    evidenceLedger.clear();
    vi.useRealTimers();
  });

  it('emits scanAvailable=false when file scanning is unavailable', async () => {
    vi.resetModules();
    const { EventLoop } = await import('@core/systems/EventLoop');

    const mockCtx: EventLoop.LoopContext = {
      soma: { energy: 100, cognitiveLoad: 0, isSleeping: false },
      limbic: { fear: 0, curiosity: 0, frustration: 0, satisfaction: 0 },
      neuro: { dopamine: 55, serotonin: 60, norepinephrine: 50 },
      conversation: [],
      autonomousMode: true,
      lastSpeakTimestamp: 0,
      silenceStart: Date.now() - 100000,
      thoughtHistory: [],
      poeticMode: false,
      autonomousLimitPerMinute: 2,
      chemistryEnabled: false,
      goalState: {
        activeGoal: null,
        backlog: [],
        lastUserInteractionAt: Date.now() - 100000,
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

    const mockCallbacks: EventLoop.LoopCallbacks = {
      onMessage: vi.fn(),
      onThought: vi.fn(),
      onSomaUpdate: vi.fn(),
      onLimbicUpdate: vi.fn()
    };

    await EventLoop.runSingleStep(
      mockCtx,
      'Co jest w missing_file.ts?',
      mockCallbacks
    );

    const history = eventBus.getHistory();
    const summary = history.find((p) => p.type === PacketType.FILE_SCAN_SUMMARY);

    expect(summary).toBeTruthy();
    expect(summary?.payload?.scanAvailable).toBe(false);
    expect(summary?.payload?.hitCountLimit).toBe(false);
    expect(summary?.payload?.hitDepthLimit).toBe(false);
    expect(history.some((p) => p.type === PacketType.FILE_SCAN_LIMIT_REACHED)).toBe(false);
    expect(history.some((p) => p.type === PacketType.EVIDENCE_BLOCKED_BY_SCAN_LIMIT)).toBe(false);
  });
});
