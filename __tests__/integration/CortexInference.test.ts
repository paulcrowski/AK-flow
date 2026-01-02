import { describe, it, expect, beforeEach, vi } from 'vitest';
import { eventBus } from '@core/EventBus';
import { p0MetricStartTick, publishP0Metric } from '@core/systems/TickLifecycleTelemetry';
import { pushTraceId, popTraceId } from '@core/trace/TraceContext';
import { buildMinimalCortexState, setCachedIdentity, clearIdentityCache } from '@core/builders/MinimalCortexStateBuilder';
import { META_STATES_BASELINE } from '@core/types/MetaStates';
import { DEFAULT_TRAIT_VECTOR } from '@core/types/TraitVector';
import { generateFromCortexState } from '@core/inference/CortexInference';

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
    generateContentMock.mockResolvedValue({
      text: 'not json',
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

    expect(metricEvent?.payload?.parseFailCount).toBe(1);
  });
});
