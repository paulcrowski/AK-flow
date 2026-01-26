import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { eventBus } from '@core/EventBus';
import { PacketType } from '@/types';
import { getAutonomyConfig } from '@core/config/systemConfig';
import { runAutonomousVolitionStep, resetAutonomyBackoff } from '@core/systems/eventloop/AutonomousVolitionStep';
import { ExecutiveGate } from '@core/systems/ExecutiveGate';
import { CortexService } from '@llm/gemini';
import { AutonomyRepertoire } from '@core/systems/AutonomyRepertoire';

vi.mock('@llm/gemini', () => ({
  CortexService: {
    autonomousVolitionV2: vi.fn(),
    performDeepResearch: vi.fn()
  }
}));

vi.mock('@services/SessionMemoryService', () => {
  const emptyStats = {
    sessionsToday: 0,
    sessionsYesterday: 0,
    sessionsThisWeek: 0,
    messagesToday: 0,
    lastInteractionAt: null,
    lastSessionDurationMin: 0,
    recentTopics: [],
    dataStatus: 'no_data'
  };
  return {
    SessionMemoryService: {
      getSessionStatsSafe: vi.fn().mockResolvedValue(emptyStats)
    },
    default: {
      getSessionStatsSafe: vi.fn().mockResolvedValue(emptyStats)
    }
  };
});

describe('Grounding auto-search', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    eventBus.clear();
    resetAutonomyBackoff();
  });

  afterEach(() => {
    eventBus.clear();
  });

  it('emits SEARCH TOOL_INTENT and TOOL_RESULT when grounding fails', async () => {
    vi.spyOn(AutonomyRepertoire, 'selectAction').mockReturnValue({
      action: 'REFLECT',
      allowed: true,
      reason: 'test',
      groundingScore: 0.6
    });
    vi.spyOn(AutonomyRepertoire, 'validateSpeech').mockReturnValue({
      valid: false,
      reason: 'test grounding failure',
      groundingScore: 0
    });

    vi.mocked(CortexService.autonomousVolitionV2).mockResolvedValue({
      internal_monologue: 'test',
      voice_pressure: 0.5,
      speech_content: 'Unrelated response'
    });

    vi.mocked(CortexService.performDeepResearch).mockResolvedValue({
      synthesis: 'Search result',
      sources: [{ title: 'Source', uri: 'http://example.com' }]
    });

    const now = Date.now();
    const ctx = {
      soma: { energy: 100, cognitiveLoad: 0, isSleeping: false },
      limbic: { fear: 0, curiosity: 0.5, frustration: 0, satisfaction: 0.5 },
      neuro: { dopamine: 55, serotonin: 60, norepinephrine: 50 },
      conversation: [{ role: 'user', text: 'jaki jest dzien?' }],
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

    const autonomyCfg = getAutonomyConfig();
    const gateContext = {
      ...ExecutiveGate.getDefaultContext(ctx.limbic, now - ctx.goalState.lastUserInteractionAt),
      isUserFacing: false,
      lastTool: null
    };

    await runAutonomousVolitionStep({
      ctx: ctx as any,
      callbacks,
      memorySpace: {
        hot: {
          semanticSearch: vi.fn().mockResolvedValue([])
        }
      },
      trace: { traceId: 'trace-auto-search', tickNumber: 1, agentId: 'agent_1' },
      gateContext,
      silenceDurationSec: autonomyCfg.exploreMinSilenceSec + 1,
      budgetTracker: {
        checkBudget: () => true,
        consume: () => undefined
      }
    });

    const intentEvent = eventBus.getHistory().find(
      (e) => e.type === PacketType.TOOL_INTENT && e.payload?.tool === 'SEARCH'
    );
    const resultEvent = eventBus.getHistory().find(
      (e) => e.type === PacketType.TOOL_RESULT && e.payload?.tool === 'SEARCH'
    );

    expect(intentEvent).toBeDefined();
    expect(resultEvent).toBeDefined();
    expect(resultEvent?.payload?.intentId).toBe(intentEvent?.payload?.intentId);
  });
});
