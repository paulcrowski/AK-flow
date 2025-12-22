import type { KernelEvent, KernelOutput, KernelReducerResult, KernelState } from './types';

import {
  handleAddMessage,
  handleAgentSpoke,
  handleClearConversation,
  handleGoalCompleted,
  handleGoalFormed,
  handleHydrate,
  handleMoodShift,
  handleNeuroUpdate,
  handleReset,
  handleSleepEnd,
  handleSleepStart,
  handleSocialDynamicsUpdate,
  handleStateOverride,
  handleThoughtGenerated,
  handleTick,
  handleToggleAutonomy,
  handleToggleChemistry,
  handleTogglePoetic,
  handleToolResult,
  handleUserInput,
  handleWorkingSetAdvance,
  handleWorkingSetClear,
  handleWorkingSetSet
} from './reducer/handlers';

export function kernelReducer(state: KernelState, event: KernelEvent): KernelReducerResult {
  const outputs: KernelOutput[] = [];
  
  switch (event.type) {
    case 'TICK':
      return handleTick(state, event, outputs);
      
    case 'USER_INPUT':
      return handleUserInput(state, event, outputs);
      
    case 'AGENT_SPOKE':
      return handleAgentSpoke(state, event, outputs);
      
    case 'TOOL_RESULT':
      return handleToolResult(state, event, outputs);
      
    case 'SLEEP_START':
      return handleSleepStart(state, event, outputs);
      
    case 'SLEEP_END':
      return handleSleepEnd(state, event, outputs);
      
    case 'MOOD_SHIFT':
      return handleMoodShift(state, event, outputs);
      
    case 'NEURO_UPDATE':
      return handleNeuroUpdate(state, event, outputs);
      
    case 'TOGGLE_AUTONOMY':
      return handleToggleAutonomy(state, event, outputs);
      
    case 'TOGGLE_CHEMISTRY':
      return handleToggleChemistry(state, outputs);
      
    case 'TOGGLE_POETIC':
      return handleTogglePoetic(state, outputs);
      
    case 'GOAL_FORMED':
      return handleGoalFormed(state, event, outputs);
      
    case 'GOAL_COMPLETED':
      return handleGoalCompleted(state, outputs);
      
    case 'THOUGHT_GENERATED':
      return handleThoughtGenerated(state, event, outputs);
      
    case 'HYDRATE':
      return handleHydrate(state, event, outputs);
      
    case 'STATE_OVERRIDE':
      return handleStateOverride(state, event, outputs);
      
    case 'ADD_MESSAGE':
      return handleAddMessage(state, event, outputs);
      
    case 'CLEAR_CONVERSATION':
      return handleClearConversation(state, outputs);

    case 'WORKING_SET_SET':
      return handleWorkingSetSet(state, event, outputs);

    case 'WORKING_SET_ADVANCE':
      return handleWorkingSetAdvance(state, event, outputs);

    case 'WORKING_SET_CLEAR':
      return handleWorkingSetClear(state, outputs);
      
    case 'SOCIAL_DYNAMICS_UPDATE':
      return handleSocialDynamicsUpdate(state, event, outputs);
      
    case 'RESET':
      return handleReset(state, outputs);
      
    default:
      // Unknown event - no-op
      return { nextState: state, outputs };
  }
}
