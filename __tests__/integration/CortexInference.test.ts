import { describe, it, expect, beforeEach, vi } from 'vitest';
import { eventBus } from '@core/EventBus';
import { p0MetricStartTick, publishP0Metric } from '@core/systems/TickLifecycleTelemetry';
import { pushTraceId, popTraceId } from '@core/trace/TraceContext';
import { buildMinimalCortexState, setCachedIdentity, clearIdentityCache } from '@core/builders/MinimalCortexStateBuilder';
import { META_STATES_BASELINE } from '@core/types/MetaStates';
import { DEFAULT_TRAIT_VECTOR } from '@core/types/TraitVector';
import { generateFromCortexState } from '@core/inference/CortexInference';
import { PacketType } from '@/types';

const generateContentMock = vi.fn();

vi.mock('@google/genai', () => ({
  GoogleGenAI: class {
    models = { generateContent: (...args: unknown[]) => generateContentMock(...args) };
    constructor(_opts: unknown) {}
  },
  Type: { OBJECT: 'object', STRING: 'string', NUMBER: 'number' }
}));

describe('CortexInference telemetry', () => {
  const agentId = 'agent-test';

  beforeEach(() => {
    eventBus.clear();
    clearIdentityCache();
    generateContentMock.mockReset();
    vi.stubEnv('VITE_GEMINI_API_KEY', 'test-key');
    setCachedIdentity(
      agentId,
      { name: 'TestAgent', core_values: ['help'], constitutional_constraints: [] },
      DEFAULT_TRAIT_VECTOR,
      [],
      'Polish'
    );
  });

  it('increments parseFailCount in P0_METRIC on parse failure', async () => {
    generateContentMock
      .mockResolvedValueOnce({
        text: 'not json',
        usageMetadata: { promptTokenCount: 5, candidatesTokenCount: 7, totalTokenCount: 12 }
      })
      .mockResolvedValueOnce({
        text: 'still not json',
        usageMetadata: { promptTokenCount: 5, candidatesTokenCount: 7, totalTokenCount: 12 }
      });

    const state = buildMinimalCortexState({
      agentId,
      metaStates: META_STATES_BASELINE,
      userInput: 'test'
    });

    const traceId = 'trace-parse-fail';
    p0MetricStartTick(traceId, 1);
    pushTraceId(traceId);
    try {
      await generateFromCortexState(state);
      publishP0Metric(traceId, Date.now());
    } finally {
      popTraceId(traceId);
    }

    const metricEvent = eventBus.getHistory().find(
      (e) => e.payload?.event === 'P0_METRIC' && e.traceId === traceId
    );

    expect(metricEvent?.payload?.parseFailCount).toBe(2);

    const tokenEvents = eventBus.getHistory().filter(
      (e) => e.type === PacketType.PREDICTION_ERROR && e.payload?.metric === 'TOKEN_USAGE'
    );
    expect(tokenEvents).toHaveLength(2);
    tokenEvents.forEach((e) => expect(e.payload?.op).toBe('cortexInference'));
  });

  it('retries once with JSON-only prompt and retry config', async () => {
    generateContentMock
      .mockResolvedValueOnce({
        text: 'not json',
        usageMetadata: { promptTokenCount: 3, candidatesTokenCount: 4, totalTokenCount: 7 }
      })
      .mockResolvedValueOnce({
        text: '{"internal_thought":"ok","speech_content":"retry"}',
        usageMetadata: { promptTokenCount: 4, candidatesTokenCount: 5, totalTokenCount: 9 }
      });

    const state = buildMinimalCortexState({
      agentId,
      metaStates: META_STATES_BASELINE,
      userInput: 'retry me'
    });

    const output = await generateFromCortexState(state);

    expect(generateContentMock).toHaveBeenCalledTimes(2);
    const secondCall = generateContentMock.mock.calls[1]?.[0] as {
      contents: string;
      config: { temperature: number; maxOutputTokens: number };
    };
    expect(secondCall.contents).toContain('Wyłącznie poprawny JSON zgodny ze schemą. Bez markdown. Bez komentarzy.');
    expect(secondCall.contents).not.toContain('Analyze the input state');
    expect(secondCall.config.temperature).toBe(0.2);
    expect(secondCall.config.maxOutputTokens).toBe(6144);
    expect(output.speech_content).toBe('retry');
  });

  it('returns fallback message after retry fails', async () => {
    generateContentMock
      .mockResolvedValueOnce({
        text: 'not json',
        usageMetadata: { promptTokenCount: 2, candidatesTokenCount: 2, totalTokenCount: 4 }
      })
      .mockResolvedValueOnce({
        text: 'still not json',
        usageMetadata: { promptTokenCount: 2, candidatesTokenCount: 2, totalTokenCount: 4 }
      });

    const state = buildMinimalCortexState({
      agentId,
      metaStates: META_STATES_BASELINE,
      userInput: 'fail twice'
    });

    const output = await generateFromCortexState(state);

    expect(generateContentMock).toHaveBeenCalledTimes(2);
    expect(output.speech_content).toBe('Nie dostałem poprawnego JSON. Powtórz polecenie jednym zdaniem.');
  });

  it('emits TOKEN_USAGE telemetry on successful response', async () => {
    generateContentMock.mockResolvedValue({
      text: '{"internal_thought":"ok","speech_content":"hello"}',
      usageMetadata: { promptTokenCount: 2, candidatesTokenCount: 3, totalTokenCount: 5 }
    });

    const state = buildMinimalCortexState({
      agentId,
      metaStates: META_STATES_BASELINE,
      userInput: 'hello'
    });

    await generateFromCortexState(state);

    const tokenEvent = eventBus.getHistory().find(
      (e) => e.type === PacketType.PREDICTION_ERROR && e.payload?.metric === 'TOKEN_USAGE'
    );
    expect(tokenEvent?.payload?.op).toBe('cortexInference');
    expect(tokenEvent?.payload?.total).toBe(5);
  });
});
