import { describe, it, expect, vi, beforeEach } from 'vitest';
import { eventBus } from '../../core/EventBus';
import { PacketType, CognitivePacket } from '../../types';
import { createProcessOutputForTools, type ToolParserDeps } from '../../utils/toolParser';

vi.mock('../../services/LibraryService', () => ({
  searchLibraryChunks: vi.fn(),
  getLibraryChunkByIndex: vi.fn(),
  downloadLibraryDocumentText: vi.fn()
}));

import { searchLibraryChunks, downloadLibraryDocumentText } from '../../services/LibraryService';

describe('Workspace Tools E2E (toolParser + EventBus)', () => {
  let deps: ToolParserDeps;

  const getEvents = (): CognitivePacket[] => eventBus.getHistory();

  beforeEach(() => {
    vi.clearAllMocks();
    eventBus.clear();

    deps = {
      setCurrentThought: vi.fn(),
      addMessage: vi.fn(),
      setSomaState: vi.fn(),
      setLimbicState: vi.fn(),
      lastVisualTimestampRef: { current: 0 },
      visualBingeCountRef: { current: 0 },
      stateRef: { current: { limbicState: { fear: 0, curiosity: 0.5, frustration: 0, satisfaction: 0.5 } } }
    };
  });

  it('SEARCH_LIBRARY should emit TOOL_INTENT and TOOL_RESULT and add tool_result message', async () => {
    vi.mocked(searchLibraryChunks).mockResolvedValue({ ok: true, hits: [] } as any);

    const process = createProcessOutputForTools(deps);
    await process('x [SEARCH_LIBRARY: AGI] y');

    const intent = getEvents().find((e) => e.type === PacketType.TOOL_INTENT);
    const result = getEvents().find((e) => e.type === PacketType.TOOL_RESULT);

    expect(intent).toBeDefined();
    expect(intent!.payload.tool).toBe('SEARCH_LIBRARY');
    expect(result).toBeDefined();
    expect(result!.payload.tool).toBe('SEARCH_LIBRARY');

    expect(deps.addMessage).toHaveBeenCalledWith('assistant', expect.stringContaining('SEARCH_LIBRARY'), 'tool_result');
  });

  it('should support multiple workspace tags in one response (SEARCH_LIBRARY + READ_LIBRARY_DOC)', async () => {
    vi.mocked(searchLibraryChunks).mockResolvedValue({ ok: true, hits: [] } as any);
    vi.mocked(downloadLibraryDocumentText).mockResolvedValue({
      ok: true,
      doc: { original_name: 'x.md' },
      text: 'hello'
    } as any);

    const process = createProcessOutputForTools(deps);
    await process('[SEARCH_LIBRARY: x] then [READ_LIBRARY_DOC: doc_1]');

    const intents = getEvents().filter((e) => e.type === PacketType.TOOL_INTENT);
    const results = getEvents().filter((e) => e.type === PacketType.TOOL_RESULT);

    expect(intents.length).toBeGreaterThanOrEqual(2);
    expect(results.length).toBeGreaterThanOrEqual(2);

    expect(deps.addMessage).toHaveBeenCalledWith('assistant', expect.stringContaining('READ_LIBRARY_DOC'), 'tool_result');
  });
});
