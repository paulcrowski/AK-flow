import { describe, it, expect, vi, beforeEach } from 'vitest';

const fromMock = vi.fn();
let lastInsertPayload: any[] | null = null;

vi.mock('@supabase/supabase-js', () => {
  return {
    createClient: () => ({
      from: (...args: any[]) => fromMock(...args)
    })
  };
});

describe('MemoryService owner_id (unit)', () => {
  beforeEach(() => {
    lastInsertPayload = null;
    fromMock.mockReset();
    fromMock.mockImplementation((table: string) => {
      if (table === 'memories') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue({ data: [], error: null })
          })),
          insert: vi.fn((payload: any[]) => {
            lastInsertPayload = payload;
            return {
              select: vi.fn(() => ({
                single: vi.fn(async () => ({ data: { id: 'mem-1' }, error: null }))
              }))
            };
          })
        };
      }

      return {
        insert: vi.fn(async () => ({ error: null }))
      };
    });
  });

  it('should include owner_id when current owner is set (v3.2 payload)', async () => {
    const mod = await import('@services/supabase');
    mod.setCurrentAgentId('agent-1');
    mod.setCurrentOwnerId('owner-1');

    const result = await mod.MemoryService.storeMemory({
      content: 'hello',
      emotionalContext: { fear: 0, curiosity: 0, frustration: 0, satisfaction: 0 },
      timestamp: new Date().toISOString(),
      skipEmbedding: true
    } as any);

    expect(result.skipped).toBe(false);
    expect(Array.isArray(lastInsertPayload)).toBe(true);
    expect(lastInsertPayload?.[0]?.agent_id).toBe('agent-1');
    expect(lastInsertPayload?.[0]?.owner_id).toBe('owner-1');
  });

  it('should omit owner_id when current owner is not set', async () => {
    const mod = await import('@services/supabase');
    mod.setCurrentAgentId('agent-2');
    mod.setCurrentOwnerId(null);

    const result = await mod.MemoryService.storeMemory({
      content: 'hello',
      emotionalContext: { fear: 0, curiosity: 0, frustration: 0, satisfaction: 0 },
      timestamp: new Date().toISOString(),
      skipEmbedding: true
    } as any);

    expect(result.skipped).toBe(false);
    expect(lastInsertPayload?.[0]?.agent_id).toBe('agent-2');
    expect('owner_id' in (lastInsertPayload?.[0] ?? {})).toBe(false);
  });
});
