import type { KernelEvent, KernelOutput, KernelReducerResult, KernelState, StateOverridePayload } from '../../types';
import { createInitialKernelState } from '../../initialState';

export function handleStateOverride(state: KernelState, event: KernelEvent, outputs: KernelOutput[]): KernelReducerResult {
  const payload = event.payload as StateOverridePayload | undefined;
  if (!payload) {
    return { nextState: state, outputs };
  }

  let nextState: KernelState = { ...state };

  if (payload.target === 'limbic') {
    nextState = {
      ...nextState,
      limbic: {
        ...nextState.limbic,
        [payload.key]: Math.max(0, Math.min(1, payload.value))
      }
    };
  } else if (payload.target === 'soma') {
    nextState = {
      ...nextState,
      soma: {
        ...nextState.soma,
        [payload.key]: Math.max(0, Math.min(100, payload.value))
      }
    };
  } else if (payload.target === 'neuro') {
    nextState = {
      ...nextState,
      neuro: {
        ...nextState.neuro,
        [payload.key]: Math.max(0, Math.min(100, payload.value))
      }
    };
  }

  return { nextState, outputs };
}

export function handleReset(state: KernelState, outputs: KernelOutput[]): KernelReducerResult {
  const nextState = createInitialKernelState({
    traitVector: state.traitVector
  });

  outputs.push({
    type: 'LOG',
    payload: { message: 'KERNEL RESET - Full State Reset' }
  });

  return { nextState, outputs };
}
