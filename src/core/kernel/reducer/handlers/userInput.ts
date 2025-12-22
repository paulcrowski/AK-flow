import type { KernelEvent, KernelOutput, KernelReducerResult, KernelState, UserInputPayload } from '../../types';
import * as SomaSystem from '../../../systems/SomaSystem';
import { deriveWorkingSetFromUserInput, shouldAutoCreateWorkingSetFromUserInput, shouldClearWorkingSetFromUserInput } from '../../workingSetPolicy';
import { handleSocialDynamicsUpdate } from './socialDynamics';
import { handleWorkingSetSet } from './workingSet';

export function handleUserInput(state: KernelState, event: KernelEvent, outputs: KernelOutput[]): KernelReducerResult {
  const payload = event.payload as UserInputPayload | undefined;
  const now = event.timestamp;

  let nextState: KernelState = {
    ...state,
    consecutiveAgentSpeeches: 0,
    ticksSinceLastReward: 0,
    lastUserInteractionAt: now,
    silenceStart: now,
    goalState: {
      ...state.goalState,
      lastUserInteractionAt: now
    },
    socialDynamics: handleSocialDynamicsUpdate(
      state,
      { type: 'SOCIAL_DYNAMICS_UPDATE', timestamp: now, payload: { userResponded: true } } as KernelEvent,
      []
    ).nextState.socialDynamics
  };

  if (state.soma.isSleeping) {
    nextState = {
      ...nextState,
      soma: SomaSystem.forceWake(state.soma)
    };
  }

  if (payload?.detectedStyle === 'POETIC') {
    nextState = { ...nextState, poeticMode: true };
  } else if (payload?.detectedStyle === 'SIMPLE') {
    nextState = { ...nextState, poeticMode: false };
  }

  const userText = String((payload as any)?.text ?? (payload as any)?.input ?? '').trim();
  if (userText) {
    if (shouldClearWorkingSetFromUserInput(userText)) {
      nextState = { ...nextState, workingSet: null };
      outputs.push({ type: 'LOG', payload: { message: 'WORKING_SET_AUTO_CLEAR' } });
    } else if (!nextState.workingSet && shouldAutoCreateWorkingSetFromUserInput(userText)) {
      const derived = deriveWorkingSetFromUserInput(userText);
      if (derived.steps.length > 0) {
        const r = handleWorkingSetSet(
          nextState,
          {
            type: 'WORKING_SET_SET',
            timestamp: now,
            payload: { steps: derived.steps, ...(derived.title ? { title: derived.title } : {}) }
          } as KernelEvent,
          []
        );
        nextState = { ...r.nextState };
        outputs.push({ type: 'LOG', payload: { message: 'WORKING_SET_AUTO_CREATE' } });
      }
    }
  }

  return { nextState, outputs };
}
