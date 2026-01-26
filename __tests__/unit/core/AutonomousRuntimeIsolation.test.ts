import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getAutonomyConfig } from '@core/config/systemConfig';
import { AutonomyRepertoire } from '@core/systems/AutonomyRepertoire';
import { ExecutiveGate } from '@core/systems/ExecutiveGate';
import { runAutonomousVolitionStep } from '@core/systems/eventloop/AutonomousVolitionStep';
import { createAutonomyRuntime } from '@core/systems/eventloop/AutonomyRuntime';

vi.mock('@llm/gemini', () => ({
  CortexService: {
    autonomousVolitionV2: vi.fn()
  }
}));

vi.mock('@services/SessionMemoryService', () => ({
  SessionMemoryService: {
    getSessionStatsSafe: vi.fn().mockResolvedValue({
      sessionsToday: 0,
      sessionsYesterday: 0,
      sessionsThisWeek: 0,
      messagesToday: 0,
      lastInteractionAt: null,
      lastSessionDurationMin: 0,
      recentTopics: [],
      dataStatus: 'no_data'
    })
  }
}));

vi.mock('@services/SessionChunkService', () => ({
  SessionChunkService: {
    fetchRecentSessionChunks: vi.fn().mockResolvedValue([])
  }
}));

vi.mock('@core/services/IdentityDataService', () => ({
  fetchIdentityShards: vi.fn().mockResolvedValue([])
}));

vi.mock('@core/systems/VolitionSystem', () => ({
  VolitionSystem: {
    shouldInitiateThought: vi.fn().mockReturnValue(true)
  },
  calculatePoeticScore: vi.fn().mockReturnValue(0)
}));

vi.mock('@tools/worldDirectoryAccess', () => ({
  getWorldDirectorySelection: vi.fn().mockReturnValue(null)
}));

describe('Autonomy runtime isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(AutonomyRepertoire, 'selectAction').mockReturnValue({
      action: 'SILENCE',
      allowed: true,
      reason: 'test',
      groundingScore: 0
    });
  });

  it('keeps autonomy backoff and action signatures isolated per runtime', async () => {
    const now = Date.now();
    const runtimeA = createAutonomyRuntime();
    const runtimeB = createAutonomyRuntime();

    const baseCtx = {
      soma: { energy: 100, cognitiveLoad: 0, isSleeping: false },
      limbic: { fear: 0, curiosity: 0.5, frustration: 0, satisfaction: 0.5 },
      neuro: { dopamine: 55, serotonin: 60, norepinephrine: 50 },
      conversation: [{ role: 'user', text: 'hello' }],
      autonomousMode: true,
      lastSpeakTimestamp: now - 120000,
      silenceStart: now - 120000,
      thoughtHistory: [],
      poeticMode: false,
      autonomousLimitPerMinute: 3,
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

    const callbacks = {
      onMessage: vi.fn(),
      onThought: vi.fn(),
      onLimbicUpdate: vi.fn()
    };

    const memorySpace = {
      hot: {
        semanticSearch: vi.fn().mockResolvedValue([])
      }
    };

    const autonomyCfg = getAutonomyConfig();

    const ctxA = { ...baseCtx, autonomyRuntime: runtimeA };
    const ctxB = { ...baseCtx, autonomyRuntime: runtimeB };

    await runAutonomousVolitionStep({
      ctx: ctxA as any,
      callbacks,
      memorySpace,
      trace: { traceId: 'trace-a', tickNumber: 1, agentId: null },
      gateContext: {
        ...ExecutiveGate.getDefaultContext(ctxA.limbic, now - ctxA.goalState.lastUserInteractionAt),
        isUserFacing: false,
        lastTool: null
      },
      silenceDurationSec: autonomyCfg.exploreMinSilenceSec + 1
    });

    expect(runtimeA.failureState.lastAttemptAt).toBeGreaterThan(0);
    expect(runtimeA.lastActionSignature).toBeTruthy();
    expect(runtimeB.failureState.lastAttemptAt).toBe(0);
    expect(runtimeB.lastActionSignature).toBeNull();

    await runAutonomousVolitionStep({
      ctx: ctxB as any,
      callbacks,
      memorySpace,
      trace: { traceId: 'trace-b', tickNumber: 1, agentId: null },
      gateContext: {
        ...ExecutiveGate.getDefaultContext(ctxB.limbic, now - ctxB.goalState.lastUserInteractionAt),
        isUserFacing: false,
        lastTool: null
      },
      silenceDurationSec: autonomyCfg.exploreMinSilenceSec + 1
    });

    expect(runtimeB.failureState.lastAttemptAt).toBeGreaterThan(0);
    expect(runtimeB.lastActionSignature).toBeTruthy();
  });
});
