import { describe, it, expect, vi, beforeEach } from 'vitest';
import { formGoal, type GoalContext } from '@core/systems/GoalSystem';
import { SYSTEM_CONFIG } from '@core/config/systemConfig';
import type { GoalState } from '@/types';

const fetchRecentSessionChunks = vi.hoisted(() => vi.fn());
vi.mock('@services/SessionChunkService', () => ({
  SessionChunkService: {
    fetchRecentSessionChunks
  }
}));

const createGoal = vi.hoisted(() => vi.fn().mockResolvedValue(null));
const getActiveGoals = vi.hoisted(() => vi.fn().mockResolvedValue([]));
vi.mock('@services/GoalJournalService', () => ({
  GoalJournalService: {
    createGoal,
    getActiveGoals
  }
}));

const getCurrentAgentId = vi.hoisted(() => vi.fn(() => 'agent-1'));
vi.mock('@services/supabase', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@services/supabase')>();
  return {
    ...actual,
    getCurrentAgentId
  };
});

function createContext(now: number, overrides: Partial<GoalContext> = {}): GoalContext {
  return {
    now,
    lastUserInteractionAt: now - SYSTEM_CONFIG.goals.minSilenceMs - 1000,
    soma: { energy: 80, cognitiveLoad: 0, isSleeping: false },
    neuro: { dopamine: 55, serotonin: 55, norepinephrine: 55 },
    limbic: { fear: 0.1, curiosity: 0.5, frustration: 0.1, satisfaction: 0.5 },
    conversation: [],
    ...overrides
  };
}

function createGoalState(lastUserInteractionAt: number): GoalState {
  return {
    activeGoal: null,
    backlog: [],
    lastUserInteractionAt,
    goalsFormedTimestamps: [],
    lastGoals: []
  };
}

describe('GoalSystem formGoal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses the latest user topic for curiosity descriptions', async () => {
    const now = Date.now();
    const ctx = createContext(now, {
      conversation: [
        { role: 'assistant', text: 'Not relevant' },
        { role: 'user', text: 'Memory United rollout plan for retrieval' }
      ],
      neuro: { dopamine: 50, serotonin: 55, norepinephrine: 55 }
    });
    const goalState = createGoalState(ctx.lastUserInteractionAt);

    const goal = await formGoal(ctx, goalState);

    expect(goal?.description).toBe('Dopytaj uzytkownika o memory united rollout plan for retrieval');
    expect(fetchRecentSessionChunks).not.toHaveBeenCalled();
  });

  it('falls back to session chunk topics when conversation is empty', async () => {
    const now = Date.now();
    fetchRecentSessionChunks.mockResolvedValueOnce([
      { topics: ['system overhaul'], summary_json: { topics: ['other'] } }
    ]);
    const ctx = createContext(now, {
      conversation: [],
      neuro: { dopamine: 80, serotonin: 55, norepinephrine: 55 }
    });
    const goalState = createGoalState(ctx.lastUserInteractionAt);

    const goal = await formGoal(ctx, goalState);

    expect(fetchRecentSessionChunks).toHaveBeenCalledWith('agent-1', 1);
    expect(goal?.description).toBe(
      'Wykonaj gleboka analize (Deep Research) lub wyszukaj nowe informacje na temat system overhaul.'
    );
  });
  it('handles SessionChunkService failure gracefully (fallback to safe topic)', async () => {
    const now = Date.now();
    fetchRecentSessionChunks.mockRejectedValue(new Error('Session retrieval failed'));

    const ctx = createContext(now, {
      conversation: [], // Empty conversation triggers chunk fallback
      neuro: { dopamine: 80, serotonin: 55, norepinephrine: 55 }
    });
    const goalState = createGoalState(ctx.lastUserInteractionAt);

    const goal = await formGoal(ctx, goalState);

    // Should fallback to default topic 'ostatni temat rozmowy' instead of crashing
    expect(goal?.description).toContain('ostatni temat rozmowy');
  });

  it('handles GoalJournalService failure gracefully (fire and forget)', async () => {
    const now = Date.now();
    const ctx = createContext(now, {
      conversation: [{ role: 'user', text: 'test' }],
      neuro: { dopamine: 50, serotonin: 55, norepinephrine: 55 }
    });
    const goalState = createGoalState(ctx.lastUserInteractionAt);

    // Journal fails, but goal should still be formed in memory
    createGoal.mockRejectedValue(new Error('Journal write failed'));

    const goal = await formGoal(ctx, goalState);

    expect(goal).not.toBeNull();
    expect(goal?.description).toBeTruthy();
    expect(createGoal).toHaveBeenCalled();
    // No crash
  });
});

