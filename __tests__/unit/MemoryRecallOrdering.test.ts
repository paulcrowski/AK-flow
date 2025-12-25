import { describe, it, expect, vi, beforeEach } from 'vitest';

const semanticSearch = vi.hoisted(() => vi.fn());
const recallRecent = vi.hoisted(() => vi.fn());

vi.mock('@services/supabase', () => ({
  MemoryService: {
    semanticSearch,
    recallRecent
  },
  getCurrentAgentId: vi.fn(() => 'agent-1')
}));

const fetchRecentSessionChunks = vi.hoisted(() => vi.fn());
vi.mock('@services/SessionChunkService', () => ({
  SessionChunkService: {
    fetchRecentSessionChunks
  }
}));

const fetchIdentityShards = vi.hoisted(() => vi.fn());
vi.mock('@core/services/IdentityDataService', () => ({
  fetchIdentityShards
}));

const isMemorySubEnabled = vi.hoisted(() => vi.fn(() => false));
vi.mock('@core/config/featureFlags', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...(actual as Record<string, unknown>),
    isMemorySubEnabled
  };
});

import { recallMemories } from '@core/systems/cortex/memoryRecall';

const baseEmotion = { fear: 0, curiosity: 0, frustration: 0, satisfaction: 0 };

describe('recallMemories ordering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('prefers session chunks, then identity shards, then semantic memories for recall intent', async () => {
    semanticSearch.mockResolvedValue([
      { id: 'mem-1', content: 'memory-A', timestamp: '2025-01-01T00:00:00Z', emotionalContext: baseEmotion },
      { id: 'mem-2', content: 'memory-B', timestamp: '2025-01-01T00:00:00Z', emotionalContext: baseEmotion }
    ]);

    fetchRecentSessionChunks.mockResolvedValue([
      {
        id: 'chunk-1',
        sessionId: 'sess-1',
        summary_text: 'Summary A',
        topics: ['topic-1'],
        endTime: '2025-01-01T01:00:00Z'
      }
    ]);

    fetchIdentityShards.mockResolvedValue([
      {
        id: 'shard-1',
        kind: 'belief',
        content: 'I value clarity',
        strength: 80,
        is_core: true,
        created_at: '2025-01-01T00:30:00Z'
      }
    ]);

    const memories = await recallMemories({ queryText: 'Przypomnij sobie ostatnie ustalenia' });

    expect(semanticSearch).toHaveBeenCalledWith('Przypomnij sobie ostatnie ustalenia', { limit: 40 });
    expect(fetchRecentSessionChunks).toHaveBeenCalledWith('agent-1', 8);
    expect(fetchIdentityShards).toHaveBeenCalledWith('agent-1', 20);

    expect(memories[0].content).toContain('SESSION_CHUNK');
    expect(memories[1].content).toContain('IDENTITY_SHARD');
    expect(memories[2].content).toContain('memory-A');
    expect(memories).toHaveLength(4);
  });
});
