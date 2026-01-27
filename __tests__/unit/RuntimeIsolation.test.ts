import { describe, it, expect } from 'vitest';
import { createDecisionGateRuntime, processDecisionGate } from '@core/systems/DecisionGate';
import { createToolRuntimeState } from '@tools/toolRuntime';
import type { CortexOutput } from '@core/types/CortexOutput';
import type { SomaState } from '@/types';

describe('Runtime isolation', () => {
  it('keeps DecisionGate state per runtime instance', () => {
    const output: CortexOutput = {
      internal_thought: 'Need data.',
      speech_content: 'Let me check.',
      stimulus_response: { valence: 'neutral', salience: 'medium', novelty: 'routine' },
      tool_intent: {
        tool: 'SEARCH',
        query: 'isolation',
        reason: 'test'
      }
    };

    const soma: SomaState = { energy: 80, cognitiveLoad: 0, isSleeping: false } as SomaState;

    const runtimeA = createDecisionGateRuntime();
    const runtimeB = createDecisionGateRuntime();

    const first = processDecisionGate(output, soma, undefined, 'agent-1', runtimeA);
    const second = processDecisionGate(output, soma, undefined, 'agent-1', runtimeA);
    const isolated = processDecisionGate(output, soma, undefined, 'agent-1', runtimeB);

    expect(first.telemetry.intentExecuted).toBe(true);
    expect(second.telemetry.intentExecuted).toBe(false);
    expect(isolated.telemetry.intentExecuted).toBe(true);
  });

  it('keeps tool runtime inFlight maps isolated', () => {
    const runtimeA = createToolRuntimeState();
    const runtimeB = createToolRuntimeState();

    runtimeA.searchInFlight.set('query', { settled: false } as any);
    runtimeA.visualInFlight.set('prompt', { settled: false } as any);

    expect(runtimeB.searchInFlight.has('query')).toBe(false);
    expect(runtimeB.visualInFlight.has('prompt')).toBe(false);
  });
});
