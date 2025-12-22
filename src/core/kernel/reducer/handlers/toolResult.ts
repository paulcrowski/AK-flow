import type { KernelEvent, KernelOutput, KernelReducerResult, KernelState, ToolResultPayload } from '../../types';
import { handleWorkingSetAdvance } from './workingSet';

export function handleToolResult(state: KernelState, event: KernelEvent, outputs: KernelOutput[]): KernelReducerResult {
  let nextState: KernelState = {
    ...state,
    ticksSinceLastReward: 0
  };

  const payload = event.payload as ToolResultPayload | undefined;
  if (payload?.success && nextState.workingSet) {
    const r = handleWorkingSetAdvance(
      nextState,
      { type: 'WORKING_SET_ADVANCE', timestamp: event.timestamp } as KernelEvent,
      []
    );
    nextState = { ...r.nextState };
    outputs.push({ type: 'LOG', payload: { message: 'WORKING_SET_AUTO_ADVANCE' } });
  }

  outputs.push({
    type: 'LOG',
    payload: { message: 'TOOL_REWARD: Tool result received, resetting ticksSinceLastReward' }
  });

  return { nextState, outputs };
}
