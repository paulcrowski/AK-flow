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
import { CortexService } from '../../services/gemini';

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
  }
}));

describe('P0 Tool Lifecycle', () => {
  let mockDeps: ToolParserDeps;

  // Helper to get events from history
  const getEvents = (): CognitivePacket[] => eventBus.getHistory();

  beforeEach(() => {
    vi.clearAllMocks();
    eventBus.clear();

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

      const events = getEvents();
      const resultEvent = events.find(e => e.type === PacketType.TOOL_RESULT);
      expect(resultEvent).toBeDefined();
      expect(resultEvent!.payload.tool).toBe('SEARCH');
      expect(resultEvent!.payload.sourcesCount).toBe(1);
    });

    it('should emit TOOL_ERROR on failure', async () => {
      vi.mocked(CortexService.performDeepResearch).mockRejectedValue(new Error('API Error'));

      const processOutput = createProcessOutputForTools(mockDeps);
      await processOutput('[SEARCH: failing query]');

      const events = getEvents();
      const errorEvent = events.find(e => e.type === PacketType.TOOL_ERROR);
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

      const events = getEvents();
      const errorEvent = events.find(e => e.type === PacketType.TOOL_ERROR);
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
      const resultEvent = events.find(e => e.type === PacketType.TOOL_RESULT);

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

      const events = getEvents();
      const resultEvent = events.find(e => e.type === PacketType.TOOL_RESULT);
      expect(resultEvent).toBeDefined();
      expect(resultEvent!.payload.tool).toBe('VISUALIZE');
      expect(resultEvent!.payload.hasImage).toBe(true);
    });

    it('should emit TOOL_ERROR on null image', async () => {
      vi.mocked(CortexService.generateVisualThought).mockResolvedValue(null);

      const processOutput = createProcessOutputForTools(mockDeps);
      await processOutput('[VISUALIZE: failed image]');

      const events = getEvents();
      const errorEvent = events.find(e => e.type === PacketType.TOOL_ERROR);
      expect(errorEvent).toBeDefined();
      expect(errorEvent!.payload.error).toBe('Null image result');
    });

    it('should emit TOOL_ERROR on exception', async () => {
      vi.mocked(CortexService.generateVisualThought).mockRejectedValue(new Error('Image generation failed'));

      const processOutput = createProcessOutputForTools(mockDeps);
      await processOutput('[VISUALIZE: error image]');

      const events = getEvents();
      const errorEvent = events.find(e => e.type === PacketType.TOOL_ERROR);
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
});
