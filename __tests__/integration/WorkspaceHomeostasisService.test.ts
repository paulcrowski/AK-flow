import { describe, it, expect, vi, beforeEach } from 'vitest';

const fromMock = vi.fn();

vi.mock('../../services/supabase', () => {
  return {
    supabase: {
      from: fromMock
    },
    getCurrentAgentId: () => 'agent_1'
  };
});

import { WorkspaceHomeostasisService } from '../../services/WorkspaceHomeostasisService';

describe('WorkspaceHomeostasisService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should delete workspace memories beyond maxWorkspaceMemories (newest kept)', async () => {
    const kept = 3;

    const rows = Array.from({ length: 6 }).map((_, i) => ({
      id: `m${i + 1}`,
      raw_text: i === 0 ? 'WORKSPACE_DOC_SUMMARY\n...' : 'WORKSPACE_CHUNK_SUMMARY\n...',
      created_at: new Date(Date.now() - i * 1000).toISOString()
    }));

    const selectChain: any = {
      select: vi.fn(() => selectChain),
      eq: vi.fn(() => selectChain),
      ilike: vi.fn(() => selectChain),
      order: vi.fn(() => selectChain),
      range: vi.fn(async () => ({ data: rows, error: null }))
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
      expect(res.totalBefore).toBe(6);
      expect(res.deletedCount).toBe(3);
    }

    expect(deleteChain.in).toHaveBeenCalledTimes(1);
    const batchArg = (deleteChain.in as any).mock.calls[0][1] as string[];
    expect(batchArg).toEqual(['m4', 'm5', 'm6']);
  });

  it('should not delete when below limit', async () => {
    const rows = Array.from({ length: 2 }).map((_, i) => ({
      id: `m${i + 1}`,
      raw_text: 'WORKSPACE_DOC_SUMMARY\n...',
      created_at: new Date(Date.now() - i * 1000).toISOString()
    }));

    const selectChain: any = {
      select: vi.fn(() => selectChain),
      eq: vi.fn(() => selectChain),
      ilike: vi.fn(() => selectChain),
      order: vi.fn(() => selectChain),
      range: vi.fn(async () => ({ data: rows, error: null }))
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
