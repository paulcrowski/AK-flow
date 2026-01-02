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
        usage: { prompt_tokens: 5, completion_tokens: 7, total_tokens: 12 }
      })
      .mockResolvedValueOnce({
        text: 'still not json',
        usage: { prompt_tokens: 5, completion_tokens: 7, total_tokens: 12 }
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
        usage: { prompt_tokens: 3, completion_tokens: 4, total_tokens: 7 }
      })
      .mockResolvedValueOnce({
        text: '{"internal_thought":"ok","speech_content":"retry"}',
        usage: { prompt_tokens: 4, completion_tokens: 5, total_tokens: 9 }
      });

    const state = buildMinimalCortexState({
      agentId,
      metaStates: META_STATES_BASELINE,
      userInput: 'retry me'
    });

    const traceId = 'trace-retry';
    pushTraceId(traceId);
    const output = await generateFromCortexState(state);
    popTraceId(traceId);

    expect(generateContentMock).toHaveBeenCalledTimes(2);
    const secondCall = generateContentMock.mock.calls[1]?.[0] as {
      contents: string;
      config: { temperature: number; maxOutputTokens: number };
    };
    expect(secondCall.contents).toContain('JSON zgodny ze schem');
    expect(secondCall.contents).toContain('Bez markdown');
    expect(secondCall.contents).toContain('Bez komentarzy');
    expect(secondCall.contents).not.toContain('Analyze the input state');
    expect(secondCall.config.temperature).toBe(0.2);
    expect(secondCall.config.maxOutputTokens).toBe(6144);
    expect(output.speech_content).toBe('retry');

    const tokenEvents = eventBus.getHistory().filter(
      (e) => e.type === PacketType.PREDICTION_ERROR && e.payload?.metric === 'TOKEN_USAGE'
    );
    expect(tokenEvents).toHaveLength(2);
    const attempts = tokenEvents.map((e) => e.payload?.attempt);
    expect(attempts).toContain(0);
    expect(attempts).toContain(1);
    tokenEvents.forEach((e) => expect(e.payload?.traceId).toBe(traceId));
    const sum = tokenEvents.reduce((acc, e) => acc + (e.payload?.total_tokens || 0), 0);
    expect(sum).toBe(16);
  });

  it('returns fallback message after retry fails', async () => {
    generateContentMock
      .mockResolvedValueOnce({
        text: 'not json',
        usage: { prompt_tokens: 2, completion_tokens: 2, total_tokens: 4 }
      })
      .mockResolvedValueOnce({
        text: 'still not json',
        usage: { prompt_tokens: 2, completion_tokens: 2, total_tokens: 4 }
      });

    const state = buildMinimalCortexState({
      agentId,
      metaStates: META_STATES_BASELINE,
      userInput: 'fail twice'
    });

    const output = await generateFromCortexState(state);

    expect(generateContentMock).toHaveBeenCalledTimes(2);
    expect(output.speech_content).toContain('JSON');
    expect(output.speech_content).toContain('Powt');
  });

  it('emits TOKEN_USAGE telemetry on successful response', async () => {
    generateContentMock.mockResolvedValue({
      text: '{"internal_thought":"ok","speech_content":"hello"}',
      usage: { prompt_tokens: 2, completion_tokens: 3, total_tokens: 5 }
    });

    const state = buildMinimalCortexState({
      agentId,
      metaStates: META_STATES_BASELINE,
      userInput: 'hello'
    });

    const traceId = 'trace-success';
    pushTraceId(traceId);
    await generateFromCortexState(state);
    popTraceId(traceId);

    const tokenEvents = eventBus.getHistory().filter(
      (e) => e.type === PacketType.PREDICTION_ERROR && e.payload?.metric === 'TOKEN_USAGE'
    );
    expect(tokenEvents).toHaveLength(1);
    const tokenEvent = tokenEvents[0];
    expect(tokenEvent?.payload?.op).toBe('cortexInference');
    expect(tokenEvent?.payload?.input_tokens).toBe(2);
    expect(tokenEvent?.payload?.output_tokens).toBe(3);
    expect(tokenEvent?.payload?.total_tokens).toBe(5);
    expect(tokenEvent?.payload?.status).toBe('success');
    expect(tokenEvent?.payload?.attempt).toBe(0);
    expect(tokenEvent?.payload?.traceId).toBe(traceId);
  });

  it('emits parse_fail event with zero tokens when usage is missing', async () => {
    generateContentMock.mockResolvedValue({
      text: 'not json'
    });

    const state = buildMinimalCortexState({
      agentId,
      metaStates: META_STATES_BASELINE,
      userInput: 'no usage'
    });

    const traceId = 'trace-no-usage';
    pushTraceId(traceId);
    await generateFromCortexState(state);
    popTraceId(traceId);

    const tokenEvents = eventBus.getHistory().filter(
      (e) => e.type === PacketType.PREDICTION_ERROR && e.payload?.metric === 'TOKEN_USAGE'
    );
    expect(tokenEvents).toHaveLength(2);
    tokenEvents.forEach((tokenEvent) => {
      expect(tokenEvent?.payload?.status).toBe('parse_fail');
      expect(tokenEvent?.payload?.input_tokens).toBe(0);
      expect(tokenEvent?.payload?.output_tokens).toBe(0);
      expect(tokenEvent?.payload?.total_tokens).toBe(0);
      expect(tokenEvent?.payload?.traceId).toBe(traceId);
    });
  });
});
