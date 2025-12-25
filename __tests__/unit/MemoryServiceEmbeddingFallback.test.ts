import { describe, it, expect, vi } from 'vitest';

vi.mock('@llm/gemini', () => ({
  CortexService: {
    generateEmbedding: vi.fn(async () => null)
  }
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    rpc: vi.fn(async () => ({ data: [], error: null })),
    from: vi.fn(() => ({
      insert: vi.fn(async () => ({ error: null }))
    }))
  })
}));

describe('MemoryService semanticSearch embedding fallback', () => {
  it('returns [] when embedding is unavailable', async () => {
    const mod = await import('@services/supabase');
    mod.setCurrentAgentId('agent-1');

    const result = await mod.MemoryService.semanticSearch('hello');

    expect(result).toEqual([]);
  });
});
