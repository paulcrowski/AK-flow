import type { KernelEvent, KernelOutput, KernelReducerResult, KernelState } from '../../types';
import * as SomaSystem from '../../../systems/SomaSystem';
import { AgentType, PacketType } from '../../../../types';
import { BASELINE_NEURO } from '../../initialState';

export function handleSleepStart(state: KernelState, event: KernelEvent, outputs: KernelOutput[]): KernelReducerResult {
  const nextState: KernelState = {
    ...state,
    soma: SomaSystem.forceSleep(state.soma),
    neuro: BASELINE_NEURO,
    hasConsolidatedThisSleep: false
  };

  outputs.push({
    type: 'EVENT_BUS_PUBLISH',
    payload: {
      source: AgentType.SOMA,
      type: PacketType.SYSTEM_ALERT,
      payload: {
        event: 'SLEEP_START',
        energy: state.soma.energy,
        limbic: state.limbic,
        neuro: state.neuro,
        message: '🌙 Agent entering sleep mode'
      },
      priority: 0.9
    }
  });

  outputs.push({ type: 'DREAM_CONSOLIDATION', payload: {} });

  return { nextState, outputs };
}

export function handleSleepEnd(state: KernelState, event: KernelEvent, outputs: KernelOutput[]): KernelReducerResult {
  const nextState: KernelState = {
    ...state,
    soma: SomaSystem.forceWake(state.soma),
    hasConsolidatedThisSleep: false
  };

  outputs.push({
    type: 'EVENT_BUS_PUBLISH',
    payload: {
      source: AgentType.SOMA,
      type: PacketType.SYSTEM_ALERT,
      payload: {
        event: 'SLEEP_END',
        energy: state.soma.energy,
        message: '☀️ Agent is waking up'
      },
      priority: 0.9
    }
  });

  outputs.push({ type: 'WAKE_PROCESS', payload: {} });

  return { nextState, outputs };
}
