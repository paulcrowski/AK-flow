import { describe, it, expect, vi, beforeEach } from 'vitest';
import { eventBus } from '@core/EventBus';
import { PacketType } from '@/types';
import { createProcessOutputForTools } from '@tools/toolParser';
import { CortexService } from '@llm/gemini';

vi.mock('@llm/gemini', () => ({
  CortexService: {
    performDeepResearch: vi.fn(),
    generateVisualThought: vi.fn(),
    analyzeVisualInput: vi.fn()
  }
}));

describe('Tool intent settlement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    eventBus.clear();
  });

  it('settles TOOL_INTENT with TOOL_RESULT or TOOL_ERROR', async () => {
    vi.mocked(CortexService.performDeepResearch).mockResolvedValue({
      synthesis: 'Search result',
      sources: []
    });

    const deps = {
      setCurrentThought: vi.fn(),
      addMessage: vi.fn(),
      setSomaState: vi.fn(),
      setLimbicState: vi.fn(),
      lastVisualTimestampRef: { current: 0 },
      visualBingeCountRef: { current: 0 },
      stateRef: { current: { limbicState: { fear: 0, curiosity: 0.5, frustration: 0, satisfaction: 0.5 } } },
      getActiveSessionId: () => 'sess_test'
    };

    const processOutput = createProcessOutputForTools(deps);
    await processOutput('[SEARCH: alpha]');
    await new Promise((resolve) => setTimeout(resolve, 0));

    const events = eventBus.getHistory();
    const intents = events.filter((e) => e.type === PacketType.TOOL_INTENT);
    const settled = new Set(
      events
        .filter((e) => e.type === PacketType.TOOL_RESULT || e.type === PacketType.TOOL_ERROR)
        .map((e) => e.payload?.intentId)
        .filter(Boolean)
    );

    expect(intents.length).toBeGreaterThan(0);
    for (const intent of intents) {
      expect(settled.has(intent.payload?.intentId)).toBe(true);
    }
  });
});
