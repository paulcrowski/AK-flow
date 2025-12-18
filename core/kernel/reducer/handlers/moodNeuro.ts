import type { KernelEvent, KernelOutput, KernelReducerResult, KernelState, MoodShiftPayload, NeuroUpdatePayload } from '../../types';
import * as LimbicSystem from '../../../systems/LimbicSystem';

export function handleMoodShift(state: KernelState, event: KernelEvent, outputs: KernelOutput[]): KernelReducerResult {
  const payload = event.payload as MoodShiftPayload | undefined;
  if (!payload?.delta) {
    return { nextState: state, outputs };
  }

  const nextState: KernelState = {
    ...state,
    limbic: LimbicSystem.applyMoodShift(state.limbic, payload.delta)
  };

  return { nextState, outputs };
}

export function handleNeuroUpdate(state: KernelState, event: KernelEvent, outputs: KernelOutput[]): KernelReducerResult {
  const payload = event.payload as NeuroUpdatePayload | undefined;
  if (!payload?.delta) {
    return { nextState: state, outputs };
  }

  const clamp = (v: number) => Math.max(0, Math.min(100, v));

  const nextState: KernelState = {
    ...state,
    neuro: {
      dopamine: clamp(state.neuro.dopamine + (payload.delta.dopamine ?? 0)),
      serotonin: clamp(state.neuro.serotonin + (payload.delta.serotonin ?? 0)),
      norepinephrine: clamp(state.neuro.norepinephrine + (payload.delta.norepinephrine ?? 0))
    }
  };

  if (payload.reason) {
    outputs.push({
      type: 'LOG',
      payload: { message: `NEURO_UPDATE: ${payload.reason}`, delta: payload.delta }
    });
  }

  return { nextState, outputs };
}
