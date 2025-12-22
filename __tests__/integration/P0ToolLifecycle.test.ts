/**
 * P0 13/10: Tool Lifecycle Integration Tests
 * 
 * Verifies:
 * 1. TOOL_INTENT -> TOOL_RESULT/ERROR/TIMEOUT invariant
 * 2. Timeout mechanism (10s)
 * 3. Event emission for SEARCH and VISUALIZE
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { eventBus } from '../../core/EventBus';
import { PacketType, CognitivePacket } from '../../types';
import { createProcessOutputForTools, ToolParserDeps } from '../../utils/toolParser';
import { useArtifactStore } from '../../stores/artifactStore';
import { CortexService } from '../../services/gemini';
import {
  downloadLibraryDocumentText,
  findLibraryDocumentByName,
  getLibraryChunkByIndex,
  searchLibraryChunks,
  uploadLibraryFile
} from '../../services/LibraryService';

// Mock CortexService
vi.mock('../../services/gemini', () => ({
  CortexService: {
    performDeepResearch: vi.fn(),
    generateVisualThought: vi.fn(),
    analyzeVisualInput: vi.fn()
  }
}));

// Mock MemoryService
vi.mock('../../services/supabase', () => ({
  MemoryService: {
    storeMemory: vi.fn()
  },
  getCurrentOwnerId: vi.fn(() => 'U1'),
  getCurrentUserEmail: vi.fn(() => 'u1@test.local'),
  getCurrentAgentId: vi.fn(() => 'agent_1')
}));

// Mock LibraryService (Workspace tools)
vi.mock('../../services/LibraryService', () => ({
  searchLibraryChunks: vi.fn(),
  getLibraryChunkByIndex: vi.fn(),
  downloadLibraryDocumentText: vi.fn(),
  findLibraryDocumentByName: vi.fn(),
  uploadLibraryFile: vi.fn()
}));

describe('P0 Tool Lifecycle', () => {
  let mockDeps: ToolParserDeps;

  // Helper to get events from history
  const getEvents = (): CognitivePacket[] => eventBus.getHistory();

  const waitForEvent = async (predicate: (e: CognitivePacket) => boolean, timeoutMs = 50) => {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const found = getEvents().find(predicate);
      if (found) return found;
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    return undefined;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    eventBus.clear();

    // Default: resolve non-UUID document refs like "doc_1" by name.
    vi.mocked(findLibraryDocumentByName).mockResolvedValue({
      ok: true,
      document: { id: 'doc_1' }
    } as any);

    // Create mock dependencies
    mockDeps = {
      setCurrentThought: vi.fn(),
      addMessage: vi.fn(),
      setSomaState: vi.fn(),
      setLimbicState: vi.fn(),
      lastVisualTimestampRef: { current: 0 },
      visualBingeCountRef: { current: 0 },
      stateRef: { current: { limbicState: { fear: 0, curiosity: 0.5, frustration: 0, satisfaction: 0.5 } } }
    };
  });

  describe('WORKSPACE Tools (Library-backed)', () => {
    it('SEARCH_LIBRARY should emit TOOL_INTENT and TOOL_RESULT on success', async () => {
      vi.mocked(searchLibraryChunks).mockResolvedValue({
        ok: true,
        hits: [
          {
            document_id: 'doc_1',
            chunk_index: 0,
            start_offset: 0,
            end_offset: 10,
            summary: null,
            snippet: 'AGI is...'
          }
        ]
      } as any);

      const processOutput = createProcessOutputForTools(mockDeps);
      await processOutput('Check workspace. [SEARCH_LIBRARY: AGI]');

      const events = getEvents();
      const intentEvent = events.find(e => e.type === PacketType.TOOL_INTENT);
      const resultEvent = events.find(e => e.type === PacketType.TOOL_RESULT);
      expect(intentEvent).toBeDefined();
      expect(intentEvent!.payload.tool).toBe('SEARCH_LIBRARY');
      expect(resultEvent).toBeDefined();
      expect(resultEvent!.payload.tool).toBe('SEARCH_LIBRARY');
    });

    it('SEARCH_LIBRARY should still emit TOOL_RESULT on empty hits', async () => {
      vi.mocked(searchLibraryChunks).mockResolvedValue({ ok: true, hits: [] } as any);

      const processOutput = createProcessOutputForTools(mockDeps);
      await processOutput('[SEARCH_LIBRARY: nothing]');

      const resultEvent = getEvents().find(e => e.type === PacketType.TOOL_RESULT);
      expect(resultEvent).toBeDefined();
      expect(resultEvent!.payload.tool).toBe('SEARCH_LIBRARY');
      expect(resultEvent!.payload.hitsCount).toBe(0);
    });

    it('READ_LIBRARY_CHUNK should emit TOOL_ERROR when chunk is missing', async () => {
      vi.mocked(getLibraryChunkByIndex).mockResolvedValue({ ok: true, chunk: null } as any);

      const processOutput = createProcessOutputForTools(mockDeps);
      await processOutput('[READ_LIBRARY_CHUNK: 1234567890abcdef#2]');

      const errorEvent = getEvents().find(e => e.type === PacketType.TOOL_ERROR);
      expect(errorEvent).toBeDefined();
      expect(errorEvent!.payload.tool).toBe('READ_LIBRARY_CHUNK');
    });

    it('READ_LIBRARY_DOC should emit TOOL_ERROR on service error', async () => {
      vi.mocked(downloadLibraryDocumentText).mockResolvedValue({ ok: false, error: 'RLS' } as any);

      const processOutput = createProcessOutputForTools(mockDeps);
      await processOutput('[READ_LIBRARY_DOC: doc_1]');

      const errorEvent = getEvents().find(e => e.type === PacketType.TOOL_ERROR);
      expect(errorEvent).toBeDefined();
      expect(errorEvent!.payload.tool).toBe('READ_LIBRARY_DOC');
      expect(String(errorEvent!.payload.error)).toContain('RLS');
    });

    it('should support multiple workspace tags in one response', async () => {
      vi.mocked(searchLibraryChunks).mockResolvedValue({ ok: true, hits: [] } as any);
      vi.mocked(downloadLibraryDocumentText).mockResolvedValue({
        ok: true,
        doc: { original_name: 'x.md' },
        text: 'hello'
      } as any);

      const processOutput = createProcessOutputForTools(mockDeps);
      await processOutput('[SEARCH_LIBRARY: x] then [READ_LIBRARY_DOC: doc_1]');

      const intents = getEvents().filter(e => e.type === PacketType.TOOL_INTENT);
      expect(intents.length).toBeGreaterThanOrEqual(2);
    });

    it('SEARCH_LIBRARY should emit TOOL_TIMEOUT when execution exceeds limit', async () => {
      vi.mocked(searchLibraryChunks).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({ ok: true, hits: [] }), 15000)) as any
      );

      const processOutput = createProcessOutputForTools(mockDeps);

      vi.useFakeTimers();
      const promise = processOutput('[SEARCH_LIBRARY: slow query]');
      await vi.advanceTimersByTimeAsync(11000);
      await promise;
      vi.useRealTimers();

      const timeoutEvent = getEvents().find(e => e.type === PacketType.TOOL_TIMEOUT);
      expect(timeoutEvent).toBeDefined();
      expect(timeoutEvent!.payload.tool).toBe('SEARCH_LIBRARY');
    });

    it('SEARCH_IN_REPO should behave as alias of SEARCH_LIBRARY', async () => {
      vi.mocked(searchLibraryChunks).mockResolvedValue({ ok: true, hits: [] } as any);

      const processOutput = createProcessOutputForTools(mockDeps);
      await processOutput('[SEARCH_IN_REPO: AGI]');

      const intentEvent = getEvents().find(e => e.type === PacketType.TOOL_INTENT);
      const resultEvent = getEvents().find(e => e.type === PacketType.TOOL_RESULT);

      expect(intentEvent).toBeDefined();
      expect(intentEvent!.payload.tool).toBe('SEARCH_LIBRARY');
      expect(resultEvent).toBeDefined();
      expect(resultEvent!.payload.tool).toBe('SEARCH_LIBRARY');
    });

    it('READ_FILE should behave as alias of READ_LIBRARY_DOC', async () => {
      vi.mocked(downloadLibraryDocumentText).mockResolvedValue({
        ok: true,
        doc: { original_name: 'x.md' },
        text: 'hello'
      } as any);

      const processOutput = createProcessOutputForTools(mockDeps);
      await processOutput('[READ_FILE: doc_1]');

      const intentEvent = getEvents().find(e => e.type === PacketType.TOOL_INTENT);
      const resultEvent = getEvents().find(e => e.type === PacketType.TOOL_RESULT);

      expect(intentEvent).toBeDefined();
      expect(intentEvent!.payload.tool).toBe('READ_LIBRARY_DOC');
      expect(resultEvent).toBeDefined();
      expect(resultEvent!.payload.tool).toBe('READ_LIBRARY_DOC');
    });

    it('READ_LIBRARY_RANGE should emit TOOL_INTENT and TOOL_RESULT with range payload', async () => {
      vi.mocked(downloadLibraryDocumentText).mockResolvedValue({
        ok: true,
        doc: { original_name: 'x.md' },
        text: 'abcdefghijklmnopqrstuvwxyz'
      } as any);

      const processOutput = createProcessOutputForTools(mockDeps);
      await processOutput('[READ_LIBRARY_RANGE: doc_1#0:5]');

      const intentEvent = getEvents().find(e => e.type === PacketType.TOOL_INTENT);
      const resultEvent = getEvents().find(e => e.type === PacketType.TOOL_RESULT);

      expect(intentEvent).toBeDefined();
      expect(intentEvent!.payload.tool).toBe('READ_LIBRARY_RANGE');

      expect(resultEvent).toBeDefined();
      expect(resultEvent!.payload.tool).toBe('READ_LIBRARY_RANGE');
      expect(resultEvent!.payload.totalLength).toBe(26);
      expect(resultEvent!.payload.range).toEqual({ start: 0, end: 5 });
      expect(typeof resultEvent!.payload.hash).toBe('string');
    });

    it('READ_FILE_RANGE should behave as alias of READ_LIBRARY_RANGE', async () => {
      vi.mocked(downloadLibraryDocumentText).mockResolvedValue({
        ok: true,
        doc: { original_name: 'x.md' },
        text: 'abcdefghijklmnopqrstuvwxyz'
      } as any);

      const processOutput = createProcessOutputForTools(mockDeps);
      await processOutput('[READ_FILE_RANGE: doc_1#5:10]');

      const intentEvent = getEvents().find(e => e.type === PacketType.TOOL_INTENT);
      const resultEvent = getEvents().find(e => e.type === PacketType.TOOL_RESULT);

      expect(intentEvent).toBeDefined();
      expect(intentEvent!.payload.tool).toBe('READ_LIBRARY_RANGE');
      expect(resultEvent).toBeDefined();
      expect(resultEvent!.payload.tool).toBe('READ_LIBRARY_RANGE');
      expect(resultEvent!.payload.range).toEqual({ start: 5, end: 10 });
    });
  });

  afterEach(() => {
    eventBus.clear();
  });

  describe('SEARCH Tool', () => {
    it('should emit TOOL_INTENT before execution', async () => {
      vi.mocked(CortexService.performDeepResearch).mockResolvedValue({
        synthesis: 'Test result',
        sources: []
      });

      const processOutput = createProcessOutputForTools(mockDeps);
      await processOutput('Test [SEARCH: test query]');

      const events = getEvents();
      const intentEvent = events.find(e => e.type === PacketType.TOOL_INTENT);
      expect(intentEvent).toBeDefined();
      expect(intentEvent!.payload.tool).toBe('SEARCH');
      expect(intentEvent!.payload.query).toBe('test query');
    });

    it('should emit TOOL_RESULT on success', async () => {
      vi.mocked(CortexService.performDeepResearch).mockResolvedValue({
        synthesis: 'Research complete',
        sources: [{ title: 'Source 1', uri: 'http://example.com' }]
      });

      const processOutput = createProcessOutputForTools(mockDeps);
      await processOutput('[SEARCH: successful query]');

      const resultEvent = await waitForEvent(e => e.type === PacketType.TOOL_RESULT);
      expect(resultEvent).toBeDefined();
      expect(resultEvent!.payload.tool).toBe('SEARCH');
      expect(resultEvent!.payload.sourcesCount).toBe(1);
    });

    it('should emit TOOL_ERROR on failure', async () => {
      vi.mocked(CortexService.performDeepResearch).mockRejectedValue(new Error('API Error'));

      const processOutput = createProcessOutputForTools(mockDeps);
      await processOutput('[SEARCH: failing query]');

      const errorEvent = await waitForEvent(e => e.type === PacketType.TOOL_ERROR);
      expect(errorEvent).toBeDefined();
      expect(errorEvent!.payload.tool).toBe('SEARCH');
      expect(errorEvent!.payload.error).toContain('API Error');
    });

    it('should emit TOOL_ERROR on empty result', async () => {
      vi.mocked(CortexService.performDeepResearch).mockResolvedValue({
        synthesis: '',
        sources: []
      });

      const processOutput = createProcessOutputForTools(mockDeps);
      await processOutput('[SEARCH: empty result query]');

      const errorEvent = await waitForEvent(e => e.type === PacketType.TOOL_ERROR);
      expect(errorEvent).toBeDefined();
      expect(errorEvent!.payload.error).toBe('Empty result');
    });

    it('should emit TOOL_TIMEOUT when execution exceeds limit', async () => {
      // Mock a slow response that exceeds timeout
      vi.mocked(CortexService.performDeepResearch).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({ synthesis: 'late', sources: [] }), 15000))
      );

      const processOutput = createProcessOutputForTools(mockDeps);
      
      // Use fake timers to speed up the test
      vi.useFakeTimers();
      const promise = processOutput('[SEARCH: slow query]');
      
      // Fast-forward past timeout
      await vi.advanceTimersByTimeAsync(11000);
      await promise;
      
      vi.useRealTimers();

      const events = getEvents();
      const timeoutEvent = events.find(e => e.type === PacketType.TOOL_TIMEOUT);
      expect(timeoutEvent).toBeDefined();
      expect(timeoutEvent!.payload.tool).toBe('SEARCH');
    });

    it('should always have matching intentId between INTENT and RESULT/ERROR', async () => {
      vi.mocked(CortexService.performDeepResearch).mockResolvedValue({
        synthesis: 'Result',
        sources: []
      });

      const processOutput = createProcessOutputForTools(mockDeps);
      await processOutput('[SEARCH: tracked query]');

      const events = getEvents();
      const intentEvent = events.find(e => e.type === PacketType.TOOL_INTENT);
      const resultEvent = await waitForEvent(e => e.type === PacketType.TOOL_RESULT);

      expect(intentEvent).toBeDefined();
      expect(resultEvent).toBeDefined();
      expect(resultEvent!.payload.intentId).toBe(intentEvent!.id);
    });
  });

  describe('VISUALIZE Tool', () => {
    it('should emit TOOL_INTENT before execution', async () => {
      vi.mocked(CortexService.generateVisualThought).mockResolvedValue('data:image/jpeg;base64,abc123');
      vi.mocked(CortexService.analyzeVisualInput).mockResolvedValue('A beautiful image');

      const processOutput = createProcessOutputForTools(mockDeps);
      await processOutput('[VISUALIZE: sunset over ocean]');

      const events = getEvents();
      const intentEvent = events.find(e => e.type === PacketType.TOOL_INTENT);
      expect(intentEvent).toBeDefined();
      expect(intentEvent!.payload.tool).toBe('VISUALIZE');
    });

    it('should emit TOOL_RESULT on success', async () => {
      vi.mocked(CortexService.generateVisualThought).mockResolvedValue('data:image/jpeg;base64,abc123');
      vi.mocked(CortexService.analyzeVisualInput).mockResolvedValue('A beautiful image');

      const processOutput = createProcessOutputForTools(mockDeps);
      await processOutput('[VISUALIZE: mountain landscape]');

      const resultEvent = await waitForEvent(e => e.type === PacketType.TOOL_RESULT);
      expect(resultEvent).toBeDefined();
      expect(resultEvent!.payload.tool).toBe('VISUALIZE');
      expect(resultEvent!.payload.hasImage).toBe(true);
    });

    it('should emit TOOL_ERROR on null image', async () => {
      vi.mocked(CortexService.generateVisualThought).mockResolvedValue(null);

      const processOutput = createProcessOutputForTools(mockDeps);
      await processOutput('[VISUALIZE: failed image]');

      const errorEvent = await waitForEvent(e => e.type === PacketType.TOOL_ERROR);
      expect(errorEvent).toBeDefined();
      expect(errorEvent!.payload.error).toBe('Null image result');
    });

    it('should emit TOOL_ERROR on exception', async () => {
      vi.mocked(CortexService.generateVisualThought).mockRejectedValue(new Error('Image generation failed'));

      const processOutput = createProcessOutputForTools(mockDeps);
      await processOutput('[VISUALIZE: error image]');

      const errorEvent = await waitForEvent(e => e.type === PacketType.TOOL_ERROR);
      expect(errorEvent).toBeDefined();
      expect(errorEvent!.payload.tool).toBe('VISUALIZE');
    });
  });

  describe('Invariants', () => {
    it('TOOL_INTENT must always be followed by RESULT, ERROR, or TIMEOUT', async () => {
      // Test success path
      vi.mocked(CortexService.performDeepResearch).mockResolvedValue({
        synthesis: 'Result',
        sources: []
      });

      const processOutput = createProcessOutputForTools(mockDeps);
      await processOutput('[SEARCH: invariant test]');

      await waitForEvent(e => e.type === PacketType.TOOL_RESULT || e.type === PacketType.TOOL_ERROR || e.type === PacketType.TOOL_TIMEOUT);

      const events = getEvents();
      const intentEvents = events.filter(e => e.type === PacketType.TOOL_INTENT);
      const outcomeEvents = events.filter(e => 
        e.type === PacketType.TOOL_RESULT || 
        e.type === PacketType.TOOL_ERROR || 
        e.type === PacketType.TOOL_TIMEOUT
      );

      // Every intent should have a corresponding outcome
      expect(outcomeEvents.length).toBeGreaterThanOrEqual(intentEvents.length);
    });
  });

  describe('ARTIFACT Tools', () => {
    it('PUBLISH should sanitize artifact id argument (quotes/brackets)', async () => {
      vi.mocked(uploadLibraryFile).mockResolvedValue({ ok: true, document: { id: 'doc_1' } } as any);

      const processOutput = createProcessOutputForTools(mockDeps);
      await processOutput('[CREATE: report.md]hello[/CREATE]');

      const createCall = vi
        .mocked(mockDeps.addMessage)
        .mock.calls.find((c: any[]) => c?.[0] === 'assistant' && String(c?.[1] || '').includes('CREATE_OK:'));
      expect(createCall).toBeDefined();
      const createdIdMatch = String(createCall?.[1] || '').match(/CREATE_OK:\s*(art-[^\s]+)/);
      expect(createdIdMatch).toBeDefined();
      const artifactId = String(createdIdMatch?.[1] || '');
      expect(artifactId.startsWith('art-')).toBe(true);

      await processOutput(`[PUBLISH: "${artifactId}"]`);
      const intent = getEvents().find((e) => e.type === PacketType.TOOL_INTENT && e.payload?.tool === 'PUBLISH');
      expect(intent).toBeDefined();
      expect(intent!.payload.arg).toBe(artifactId);

      const error = getEvents().find((e) => e.type === PacketType.TOOL_ERROR && e.payload?.tool === 'PUBLISH');
      if (error) expect(String(error.payload?.error || '')).not.toContain('ARTIFACT_ID_INVALID');
    });

	  it('APPEND should accept artifact name (note.md) and auto-resolve to id (no ARTIFACT_ID_INVALID)', async () => {
	    const store = useArtifactStore.getState();
	    store.resetForTesting();
	    store.create('note.md', 'hello');

	    const processOutput = createProcessOutputForTools(mockDeps);
	    await processOutput('[APPEND: note.md] world');

	    const updated = store.getByName('note.md')[0];
	    expect(updated.content).toContain('world');
	    const error = getEvents().find((e) => e.type === PacketType.TOOL_ERROR && e.payload?.tool === 'APPEND');
	    if (error) expect(String(error.payload?.error || '')).not.toContain('ARTIFACT_ID_INVALID');
	  });

	  it('APPEND missing.md should emit controlled TOOL_ERROR (NOT_FOUND) and not throw ARTIFACT_ID_INVALID', async () => {
	    const store = useArtifactStore.getState();
	    store.resetForTesting();

	    const processOutput = createProcessOutputForTools(mockDeps);
	    await processOutput('[APPEND: missing.md] x');

	    const error = getEvents().find((e) => e.type === PacketType.TOOL_ERROR && e.payload?.tool === 'APPEND');
	    expect(error).toBeDefined();
	    expect(String((error as any)?.payload?.error || '')).toContain('Nie znalazłem artefaktu');
	    expect(String((error as any)?.payload?.error || '')).not.toContain('ARTIFACT_ID_INVALID');
	  });
  });
});
