import type { KernelEvent, KernelOutput, KernelReducerResult, KernelState } from '../../types';

export function handleToggleAutonomy(state: KernelState, event: KernelEvent, outputs: KernelOutput[]): KernelReducerResult {
  const payload = (event.payload as { enabled?: boolean } | undefined) ?? undefined;
  const nextEnabled = typeof payload?.enabled === 'boolean' ? payload.enabled : !state.autonomousMode;

  const nextState: KernelState = {
    ...state,
    autonomousMode: nextEnabled,
    silenceStart: Date.now()
  };

  return { nextState, outputs };
}

export function handleToggleChemistry(state: KernelState, outputs: KernelOutput[]): KernelReducerResult {
  return {
    nextState: { ...state, chemistryEnabled: !state.chemistryEnabled },
    outputs
  };
}

export function handleTogglePoetic(state: KernelState, outputs: KernelOutput[]): KernelReducerResult {
  return {
    nextState: { ...state, poeticMode: !state.poeticMode },
    outputs
  };
}
