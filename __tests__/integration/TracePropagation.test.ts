import { describe, it, expect, afterEach, vi } from 'vitest';
import { eventBus } from '../../core/EventBus';
import { EventLoop } from '../../core/systems/EventLoop';
import { setCurrentAgentId } from '../../services/supabase';
import { setFeatureFlagForTesting } from '../../core/config/featureFlags';

// Mock LLM plumbing for reactive path
vi.mock('../../services/gemini', () => ({
  CortexService: {
    detectIntent: vi.fn().mockResolvedValue({ style: 'SIMPLE', intent: 'casual' })
  }
}));

vi.mock('../../core/systems/CortexSystem', () => ({
  CortexSystem: {
    processUserMessage: vi.fn().mockResolvedValue({
      responseText: 'OK',
      internalThought: '...',
      moodShift: null
    })
  }
}));

describe('Trace propagation (P0 ONE MIND)', () => {
  afterEach(() => {
    eventBus.clear();
  });

  it('should attach traceId to all packets emitted during a tick (auto-inject ON)', async () => {
    setFeatureFlagForTesting('USE_TRACE_AUTO_INJECT', true);
    setFeatureFlagForTesting('USE_ONE_MIND_PIPELINE', true);

    // Ensure trace.agentId exists
    setCurrentAgentId('agent-test');

    const ctx: EventLoop.LoopContext = {
      soma: { energy: 100, cognitiveLoad: 0, isSleeping: false },
      limbic: { fear: 0.1, curiosity: 0.8, frustration: 0.0, satisfaction: 0.5 },
      neuro: { dopamine: 50, serotonin: 50, norepinephrine: 50 },
      conversation: [],
      autonomousMode: false,
      lastSpeakTimestamp: Date.now(),
      silenceStart: Date.now(),
      thoughtHistory: [],
      poeticMode: false,
      autonomousLimitPerMinute: 10,
      chemistryEnabled: false,
      goalState: {
        activeGoal: null,
        backlog: [],
        lastUserInteractionAt: Date.now(),
        goalsFormedTimestamps: [],
        lastGoals: []
      },
      traitVector: {
        arousal: 0.5,
        verbosity: 0.5,
        conscientiousness: 0.5,
        socialAwareness: 0.5,
        curiosity: 0.5
      },
      ticksSinceLastReward: 0,
      hadExternalRewardThisTick: false,
      consecutiveAgentSpeeches: 0
    };

    const callbacks: EventLoop.LoopCallbacks = {
      onMessage: () => {},
      onThought: () => {},
      onSomaUpdate: () => {},
      onLimbicUpdate: () => {}
    };

    const beforeLen = eventBus.getHistory().length;
    await EventLoop.runSingleStep(ctx, 'hi', callbacks);
    const after = eventBus.getHistory().slice(beforeLen);

    const tickStart = after.find(p => p.type === 'SYSTEM_ALERT' && (p.payload as any)?.event === 'TICK_START');
    expect(tickStart).toBeTruthy();
    const traceId = tickStart!.traceId;
    expect(traceId).toBeTruthy();

    const emittedWithMissing = after.filter(p => !p.traceId);
    expect(emittedWithMissing.length).toBe(0);

    const mismatched = after.filter(p => p.traceId !== traceId);
    expect(mismatched.length).toBe(0);
  });
});
