import type { AgentSpokePayload, KernelEvent, KernelOutput, KernelReducerResult, KernelState } from '../../types';
import { AgentType, PacketType } from '../../../../types';
import { MAX_THOUGHT_HISTORY } from '../constants';

export function handleAgentSpoke(state: KernelState, event: KernelEvent, outputs: KernelOutput[]): KernelReducerResult {
  const payload = event.payload as AgentSpokePayload | undefined;
  const now = event.timestamp;

  let nextState: KernelState = {
    ...state,
    consecutiveAgentSpeeches: state.consecutiveAgentSpeeches + 1,
    lastSpeakTimestamp: now,
    silenceStart: now
  };

  if (payload?.text) {
    const newHistory = [...state.thoughtHistory, payload.text];
    if (newHistory.length > MAX_THOUGHT_HISTORY) {
      newHistory.shift();
    }
    nextState = { ...nextState, thoughtHistory: newHistory };
  }

  outputs.push({
    type: 'EVENT_BUS_PUBLISH',
    payload: {
      source: AgentType.CORTEX_FLOW,
      type: PacketType.THOUGHT_CANDIDATE,
      payload: {
        speech_content: payload?.text,
        voice_pressure: payload?.voicePressure ?? 1.0,
        status: 'SPOKEN'
      },
      priority: 0.8
    }
  });

  outputs.push({
    type: 'LOG',
    payload: { context: 'SPEECH', state: nextState }
  });

  return { nextState, outputs };
}
