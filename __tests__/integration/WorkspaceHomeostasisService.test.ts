import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@services/supabase', () => {
  const fromMock = vi.fn();
  return {
    supabase: {
      from: fromMock
    },
    getCurrentAgentId: () => 'agent_1',
    __mocks: { fromMock }
  };
});

import { WorkspaceHomeostasisService } from '@services/WorkspaceHomeostasisService';

describe('WorkspaceHomeostasisService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should delete workspace memories beyond maxWorkspaceMemories (newest kept)', async () => {
    const kept = 50;

    const mocked = await import('@services/supabase');
    const fromMock = (mocked as any).__mocks.fromMock as ReturnType<typeof vi.fn>;

    let page = 0;

    const rows = Array.from({ length: 53 }).map((_, i) => ({
      id: `m${i + 1}`,
      raw_text: i === 0 ? 'WORKSPACE_DOC_SUMMARY\n...' : 'WORKSPACE_CHUNK_SUMMARY\n...',
      created_at: new Date(Date.now() - i * 1000).toISOString()
    }));

    const selectChain: any = {
      select: vi.fn(() => selectChain),
      eq: vi.fn(() => selectChain),
      ilike: vi.fn(() => selectChain),
      order: vi.fn(() => selectChain),
      range: vi.fn(async () => {
        page += 1;
        return page === 1 ? { data: rows, error: null } : { data: [], error: null };
      })
    };

    const deleteChain: any = {
      delete: vi.fn(() => deleteChain),
      eq: vi.fn(() => deleteChain),
      in: vi.fn(async () => ({ data: null, error: null }))
    };

    fromMock.mockImplementation((table: string) => {
      if (table !== 'memories') throw new Error('unexpected table');
      return {
        ...selectChain,
        ...deleteChain
      };
    });

    const res = await WorkspaceHomeostasisService.applyForCurrentAgent({ maxWorkspaceMemories: kept });
    expect(res.ok).toBe(true);

    if (res.ok) {
      expect(res.maxWorkspaceMemories).toBe(50);
      expect(res.totalBefore).toBe(53);
      expect(res.deletedCount).toBe(3);
    }

    expect(deleteChain.in).toHaveBeenCalledTimes(1);
    const batchArg = (deleteChain.in as any).mock.calls[0][1] as string[];
    expect(batchArg).toEqual(['m51', 'm52', 'm53']);
  });

  it('should not delete when below limit', async () => {
    const rows = Array.from({ length: 2 }).map((_, i) => ({
      id: `m${i + 1}`,
      raw_text: 'WORKSPACE_DOC_SUMMARY\n...',
      created_at: new Date(Date.now() - i * 1000).toISOString()
    }));

    const mocked = await import('@services/supabase');
    const fromMock = (mocked as any).__mocks.fromMock as ReturnType<typeof vi.fn>;

    let page = 0;

    const selectChain: any = {
      select: vi.fn(() => selectChain),
      eq: vi.fn(() => selectChain),
      ilike: vi.fn(() => selectChain),
      order: vi.fn(() => selectChain),
      range: vi.fn(async () => {
        page += 1;
        return page === 1 ? { data: rows, error: null } : { data: [], error: null };
      })
    };

    const deleteChain: any = {
      delete: vi.fn(() => deleteChain),
      eq: vi.fn(() => deleteChain),
      in: vi.fn(async () => ({ data: null, error: null }))
    };

    fromMock.mockImplementation((table: string) => {
      if (table !== 'memories') throw new Error('unexpected table');
      return {
        ...selectChain,
        ...deleteChain
      };
    });

    const res = await WorkspaceHomeostasisService.applyForCurrentAgent({ maxWorkspaceMemories: 10 });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.totalBefore).toBe(2);
      expect(res.deletedCount).toBe(0);
    }

    expect(deleteChain.in).not.toHaveBeenCalled();
  });
});
