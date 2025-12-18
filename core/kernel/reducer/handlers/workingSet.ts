import type { KernelEvent, KernelOutput, KernelReducerResult, KernelState, WorkingSet, WorkingSetSetPayload } from '../../types';
import * as SomaSystem from '../../../systems/SomaSystem';

export function handleWorkingSetSet(state: KernelState, event: KernelEvent, outputs: KernelOutput[]): KernelReducerResult {
  const payload = event.payload as WorkingSetSetPayload | undefined;
  if (!payload || !Array.isArray(payload.steps) || payload.steps.length === 0) {
    return { nextState: state, outputs };
  }

  const now = event.timestamp;
  const id = `ws_${now}`;
  const steps = payload.steps
    .map((s) => String(s || '').trim())
    .filter(Boolean)
    .slice(0, 20)
    .map((text, i) => ({ id: `${id}_s${i}`, text, done: false }));

  if (steps.length === 0) return { nextState: state, outputs };

  const workingSet: WorkingSet = {
    id,
    title: payload.title ? String(payload.title).slice(0, 120) : undefined,
    steps,
    cursor: 0,
    createdAt: now,
    updatedAt: now
  };

  const nextState = {
    ...state,
    soma: SomaSystem.applyEnergyCost(state.soma, 1),
    workingSet
  };

  outputs.push({
    type: 'LOG',
    payload: { message: `WORKING_SET_SET: ${workingSet.id} steps=${workingSet.steps.length}` }
  });

  return { nextState, outputs };
}

export function handleWorkingSetAdvance(state: KernelState, event: KernelEvent, outputs: KernelOutput[]): KernelReducerResult {
  if (!state.workingSet) return { nextState: state, outputs };

  const ws = state.workingSet;
  const idx = Math.max(0, Math.min(ws.steps.length - 1, ws.cursor));
  const now = event.timestamp;

  const steps = ws.steps.map((s, i) => (i === idx ? { ...s, done: true } : s));
  const nextCursor = Math.min(ws.steps.length, idx + 1);

  const nextWs: WorkingSet = {
    ...ws,
    steps,
    cursor: nextCursor,
    updatedAt: now
  };

  const nextState = {
    ...state,
    soma: SomaSystem.applyEnergyCost(state.soma, 0.5),
    workingSet: nextWs
  };

  outputs.push({
    type: 'LOG',
    payload: { message: `WORKING_SET_ADVANCE: ${ws.id} cursor=${nextCursor}/${ws.steps.length}` }
  });

  return { nextState, outputs };
}

export function handleWorkingSetClear(state: KernelState, outputs: KernelOutput[]): KernelReducerResult {
  if (!state.workingSet) return { nextState: state, outputs };

  const nextState = {
    ...state,
    workingSet: null
  };

  outputs.push({ type: 'LOG', payload: { message: 'WORKING_SET_CLEAR' } });
  return { nextState, outputs };
}
