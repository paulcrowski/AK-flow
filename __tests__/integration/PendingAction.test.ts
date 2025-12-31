import { describe, it, expect, beforeEach, vi } from 'vitest';
import { runReactiveStep } from '@core/systems/eventloop/ReactiveStep';
import { p0MetricStartTick, publishP0Metric } from '@core/systems/TickLifecycleTelemetry';
import { pushTraceId, popTraceId } from '@core/trace/TraceContext';
import type { PendingAction } from '@core/systems/eventloop/pending';
import { useArtifactStore } from '@/stores/artifactStore';
import { eventBus } from '@core/EventBus';
import { PacketType } from '@/types';

describe('PendingAction - Slot Filling', () => {
  beforeEach(() => {
    eventBus.clear();
    useArtifactStore.getState().resetForTesting();
  });

  const createCtx = () => ({
    limbic: {},
    soma: {},
    conversation: [],
    silenceStart: Date.now(),
    lastSpeakTimestamp: Date.now(),
    goalState: { lastUserInteractionAt: Date.now() },
    consecutiveAgentSpeeches: 0,
    hadExternalRewardThisTick: false,
    ticksSinceLastReward: 0,
    pendingAction: null as PendingAction | null,
    agentIdentity: { language: 'Polish' }
  });

  const createCallbacks = () => {
    const messages: string[] = [];
    return {
      messages,
      callbacks: {
        onMessage: (_r: string, text: string) => messages.push(text),
        onThought: vi.fn(),
        onLimbicUpdate: vi.fn()
      }
    };
  };

  it('Scenario A: APPEND without payload -> pending -> payload -> execution', async () => {
    const store = useArtifactStore.getState();
    const id = store.create('notes.md', 'Initial');

    const ctx = createCtx();
    const { messages, callbacks } = createCallbacks();
    const trace = { traceId: 't1', tickNumber: 1, agentId: 'a1' };
    const memorySpace = { hot: { semanticSearch: vi.fn() } };

    await runReactiveStep({ ctx, userInput: 'dopisz do notes.md', callbacks, memorySpace, trace });

    expect(ctx.pendingAction).not.toBeNull();
    const pending = ctx.pendingAction as PendingAction;
    expect(pending.type).toBe('APPEND_CONTENT');
    expect(messages.some((m) => m.includes('Co chcesz dodac'))).toBe(true);

    messages.length = 0;
    await runReactiveStep({
      ctx,
      userInput: 'Nowa notatka z dnia dzisiejszego',
      callbacks,
      memorySpace,
      trace: { ...trace, tickNumber: 2 }
    });

    expect(ctx.pendingAction).toBeNull();
    const artifact = store.get(id);
    expect(artifact?.content).toContain('Nowa notatka');

    const toolIntent = eventBus.getHistory().find(
      (e) => e.type === PacketType.TOOL_INTENT && e.payload?.tool === 'APPEND'
    );
    expect(toolIntent).toBeDefined();
  });

  it('Scenario B: pending expires after TTL', async () => {
    const store = useArtifactStore.getState();
    store.create('test.md', 'X');

    const ctx = createCtx();
    ctx.pendingAction = {
      type: 'APPEND_CONTENT',
      targetId: store.lastCreatedId!,
      targetName: 'test.md',
      createdAt: Date.now() - 200000,
      expiresAt: Date.now() - 1000,
      originalUserInput: 'dopisz do test.md'
    };

    const { messages, callbacks } = createCallbacks();

    await runReactiveStep({
      ctx,
      userInput: 'jakas tresc',
      callbacks,
      memorySpace: { hot: { semanticSearch: vi.fn() } },
      trace: { traceId: 't2', tickNumber: 1, agentId: 'a1' }
    });

    expect(ctx.pendingAction).toBeNull();
    expect(messages.some((m) => m.includes('Minęło za dużo czasu'))).toBe(true);

    const expired = eventBus.getHistory().find((e) => e.payload?.event === 'PENDING_ACTION_EXPIRED');
    expect(expired).toBeDefined();
  });

  it('Scenario C: new command clears pending', async () => {
    const store = useArtifactStore.getState();
    store.create('first.md', 'First');

    const ctx = createCtx();
    ctx.pendingAction = {
      type: 'APPEND_CONTENT',
      targetId: store.lastCreatedId!,
      targetName: 'first.md',
      createdAt: Date.now(),
      expiresAt: Date.now() + 120000,
      originalUserInput: 'dopisz do first.md'
    };

    const { messages, callbacks } = createCallbacks();

    await runReactiveStep({
      ctx,
      userInput: 'utworz plik second.md z trescia Hello',
      callbacks,
      memorySpace: { hot: { semanticSearch: vi.fn() } },
      trace: { traceId: 't3', tickNumber: 1, agentId: 'a1' }
    });

    expect(ctx.pendingAction).toBeNull();
    const second = store.getByName('second.md')[0];
    expect(second).toBeDefined();
    expect(second.content).toContain('Hello');

    const events = eventBus.getHistory();
    const supersededIndex = events.findIndex((e) => e.payload?.event === 'PENDING_ACTION_SUPERSEDED');
    const createIntentIndex = events.findIndex(
      (e) => e.type === PacketType.TOOL_INTENT && e.payload?.tool === 'CREATE'
    );
    expect(supersededIndex).toBeGreaterThanOrEqual(0);
    expect(createIntentIndex).toBeGreaterThanOrEqual(0);
    expect(supersededIndex).toBeLessThan(createIntentIndex);

    const used = events.find((e) => e.payload?.event === 'PENDING_ACTION_USED');
    expect(used).toBeUndefined();
  });

  it('Scenario D: implicit append target uses last created artifact', async () => {
    const store = useArtifactStore.getState();

    const ctx = createCtx();
    const { messages, callbacks } = createCallbacks();
    const memorySpace = { hot: { semanticSearch: vi.fn() } };

    await runReactiveStep({
      ctx,
      userInput: 'utworz plik notatki.md z trescia Start',
      callbacks,
      memorySpace,
      trace: { traceId: 't4', tickNumber: 1, agentId: 'a1' }
    });

    const created = store.getByName('notatki.md')[0];
    expect(created).toBeDefined();

    eventBus.clear();

    const traceId = 't4-2';
    p0MetricStartTick(traceId, 2);
    pushTraceId(traceId);
    try {
      await runReactiveStep({
        ctx,
        userInput: 'dodaj do tego pliku',
        callbacks,
        memorySpace,
        trace: { traceId, tickNumber: 2, agentId: 'a1' }
      });
      publishP0Metric(traceId, Date.now());
    } finally {
      popTraceId(traceId);
    }

    expect(ctx.pendingAction).not.toBeNull();
    const pending = ctx.pendingAction as PendingAction;
    expect(pending.type).toBe('APPEND_CONTENT');

    const pendingEvent = eventBus.getHistory().find((e) => e.payload?.event === 'PENDING_ACTION_SET');
    expect(pendingEvent).toBeDefined();

    const metricEvent = eventBus.getHistory().find((e) => e.payload?.event === 'P0_METRIC');
    expect(metricEvent?.payload?.pendingActionSet).toBe(1);

    const fuzzyMismatch = eventBus
      .getHistory()
      .find((e) => e.type === PacketType.PREDICTION_ERROR && e.payload?.metric === 'FUZZY_REGEX_MISMATCH');
    expect(fuzzyMismatch).toBeUndefined();

    eventBus.clear();

    await runReactiveStep({
      ctx,
      userInput: 'stop',
      callbacks,
      memorySpace,
      trace: { traceId: 't4-3', tickNumber: 3, agentId: 'a1' }
    });

    expect(ctx.pendingAction).toBeNull();
    expect(messages.some((m) => m.includes('anulowa'))).toBe(true);

    const updated = store.getByName('notatki.md')[0];
    expect(updated?.content).not.toContain('stop');

    const cancelled = eventBus.getHistory().find((e) => e.payload?.event === 'PENDING_ACTION_CANCELLED');
    expect(cancelled).toBeDefined();
  });
});
