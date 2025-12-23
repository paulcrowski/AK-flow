import { describe, it, expect, vi, afterEach } from 'vitest';
import { SessionMemoryService } from '@services/SessionMemoryService';

describe('SessionMemoryService.getSessionStatsSafe', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns stats when getSessionStats succeeds', async () => {
    const stats = {
      sessionsToday: 1,
      sessionsYesterday: 2,
      sessionsThisWeek: 3,
      messagesToday: 4,
      lastInteractionAt: null,
      lastSessionDurationMin: 0,
      recentTopics: [],
      dataStatus: 'ok' as const
    };

    vi.spyOn(SessionMemoryService, 'getSessionStats').mockResolvedValue(stats);

    const result = await SessionMemoryService.getSessionStatsSafe();

    expect(result).toEqual(stats);
  });

  it('returns empty stats when getSessionStats throws', async () => {
    vi.spyOn(SessionMemoryService, 'getSessionStats').mockRejectedValue(new Error('boom'));

    const result = await SessionMemoryService.getSessionStatsSafe();

    expect(result.sessionsToday).toBe(0);
    expect(result.sessionsYesterday).toBe(0);
    expect(result.sessionsThisWeek).toBe(0);
    expect(result.dataStatus).toBe('no_data');
  });
});
