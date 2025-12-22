import { describe, it, expect, beforeEach, vi } from 'vitest';
import { runReactiveStep } from '../../core/systems/eventloop/ReactiveStep';
import { useArtifactStore } from '../../stores/artifactStore';
import { eventBus } from '../../core/EventBus';
import { PacketType } from '../../types';

describe('Action-First integration', () => {
  beforeEach(() => {
    eventBus.clear();
    useArtifactStore.getState().resetForTesting();
  });

  it('utworz test.md should create artifact and emit tool events', async () => {
    const messages: string[] = [];
    const callbacks = {
      onMessage: (role: string, text: string) => {
        messages.push(`${role}:${text}`);
      },
      onThought: vi.fn(),
      onLimbicUpdate: vi.fn()
    };

    const ctx: any = {
      limbic: {},
      soma: {},
      conversation: [],
      silenceStart: Date.now(),
      lastSpeakTimestamp: Date.now(),
      goalState: { lastUserInteractionAt: Date.now() },
      consecutiveAgentSpeeches: 0,
      hadExternalRewardThisTick: false,
      ticksSinceLastReward: 0
    };

    await runReactiveStep({
      ctx,
      userInput: 'utworz test.md',
      callbacks,
      memorySpace: { hot: { semanticSearch: vi.fn() } },
      trace: { traceId: 'trace_action_first', tickNumber: 1, agentId: 'agent-1' }
    });

    const created = useArtifactStore.getState().getByName('test.md')[0];
    expect(created).toBeDefined();
    expect(String(created.name)).toBe('test.md');
    expect(messages.some((m) => m.includes('test.md'))).toBe(true);

    const intent = eventBus.getHistory().find((e) => e.type === PacketType.TOOL_INTENT && e.payload?.tool === 'CREATE');
    const result = eventBus.getHistory().find((e) => e.type === PacketType.TOOL_RESULT && e.payload?.tool === 'CREATE');
    expect(intent).toBeDefined();
    expect(result).toBeDefined();
  });
});
