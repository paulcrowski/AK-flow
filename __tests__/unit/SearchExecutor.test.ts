import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runSearchAndPersist } from '@tools/searchExecutor';
import { CortexService } from '@llm/gemini';
import { persistSearchKnowledgeChunk } from '@services/SearchKnowledgeChunker';
import { evidenceLedger } from '@core/systems/EvidenceLedger';

vi.mock('@llm/gemini', () => ({
  CortexService: {
    performDeepResearch: vi.fn()
  }
}));

vi.mock('@services/SearchKnowledgeChunker', () => ({
  persistSearchKnowledgeChunk: vi.fn()
}));

describe('searchExecutor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('persists knowledge chunk when synthesis is present', async () => {
    vi.mocked(CortexService.performDeepResearch).mockResolvedValue({
      synthesis: 'Test synthesis',
      sources: []
    });

    const outcome = await runSearchAndPersist({
      query: 'alpha',
      reason: 'unit test',
      intentId: 'intent-1',
      deps: {}
    });

    expect(outcome.ok).toBe(true);
    expect(persistSearchKnowledgeChunk).toHaveBeenCalled();
  });

  it('records evidence when sources are present', async () => {
    const recordSpy = vi.spyOn(evidenceLedger, 'record').mockReturnValue('ev-1');
    vi.mocked(CortexService.performDeepResearch).mockResolvedValue({
      synthesis: 'Test synthesis',
      sources: [{ uri: 'https://example.com', title: 'Example' }]
    });

    await runSearchAndPersist({
      query: 'beta',
      reason: 'unit test',
      intentId: 'intent-2',
      deps: {}
    });

    expect(recordSpy).toHaveBeenCalledWith('SEARCH_HIT', 'beta');
    recordSpy.mockRestore();
  });

  it('should handle search errors gracefully', async () => {
    vi.mocked(CortexService.performDeepResearch).mockRejectedValue(new Error('API Failure'));

    const outcome = await runSearchAndPersist({
      query: 'gamma',
      reason: 'failure test',
      intentId: 'intent-3',
      deps: {}
    });

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) { // TypeScript guard
      expect(outcome.error).toBe('API Failure');
    }
  });
});
