import { describe, it, expect, vi, beforeEach } from 'vitest';
import { eventBus } from '@core/EventBus';
import { PacketType } from '@/types';
import { createProcessOutputForTools, type ToolParserDeps } from '@tools/toolParser';

vi.mock('@services/LibraryService', () => ({
  searchLibraryChunks: vi.fn(),
  getLibraryChunkByIndex: vi.fn(),
  downloadLibraryDocumentText: vi.fn()
}));

import { downloadLibraryDocumentText } from '@services/LibraryService';

describe('SPLIT_TODO3 Tool (deterministic)', () => {
  let deps: ToolParserDeps;

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

  it('should emit TOOL_RESULT and add tool_result message', async () => {
    vi.mocked(downloadLibraryDocumentText).mockResolvedValue({
      ok: true,
      doc: { original_name: 'ak-flow-state.json' },
      text: JSON.stringify({ tasks: [{ content: 'A', priority: 'HIGH' }] })
    } as any);

    const process = createProcessOutputForTools(deps);
    await process('[SPLIT_TODO3: doc_1]');

    const intent = eventBus.getHistory().find(e => e.type === PacketType.TOOL_INTENT);
    const result = eventBus.getHistory().find(e => e.type === PacketType.TOOL_RESULT);

    expect(intent).toBeDefined();
    expect(intent!.payload.tool).toBe('SPLIT_TODO3');
    expect(result).toBeDefined();
    expect(result!.payload.tool).toBe('SPLIT_TODO3');

    expect(deps.addMessage).toHaveBeenCalledWith('assistant', expect.stringContaining('SPLIT_TODO3'), 'tool_result');
  });
});
