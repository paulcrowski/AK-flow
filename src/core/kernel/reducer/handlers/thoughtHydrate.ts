import type { KernelEvent, KernelOutput, KernelReducerResult, KernelState } from '../../types';
import { MAX_THOUGHT_HISTORY } from '../constants';

export function handleThoughtGenerated(state: KernelState, event: KernelEvent, outputs: KernelOutput[]): KernelReducerResult {
  const payload = event.payload as { thought: string } | undefined;
  if (!payload?.thought) {
    return { nextState: state, outputs };
  }

  const newHistory = [...state.thoughtHistory, payload.thought];
  if (newHistory.length > MAX_THOUGHT_HISTORY) {
    newHistory.shift();
  }

  return {
    nextState: {
      ...state,
      thoughtHistory: newHistory
    },
    outputs
  };
}

export function handleHydrate(state: KernelState, event: KernelEvent, outputs: KernelOutput[]): KernelReducerResult {
  const payload = event.payload as { state: Partial<KernelState> } | undefined;
  if (!payload?.state) {
    return { nextState: state, outputs };
  }

  const nextState: KernelState = {
    ...state,
    ...payload.state,
    limbic: { ...state.limbic, ...payload.state.limbic },
    soma: { ...state.soma, ...payload.state.soma },
    neuro: { ...state.neuro, ...payload.state.neuro },
    goalState: { ...state.goalState, ...payload.state.goalState },
    resonance: { ...state.resonance, ...payload.state.resonance }
  };

  outputs.push({
    type: 'LOG',
    payload: { message: 'STATE HYDRATED' }
  });

  return { nextState, outputs };
}
