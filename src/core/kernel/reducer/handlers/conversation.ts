import type { AddMessagePayload, ConversationTurn, KernelEvent, KernelOutput, KernelReducerResult, KernelState } from '../../types';
import { MAX_CONVERSATION_TURNS } from '../constants';

export function handleAddMessage(state: KernelState, event: KernelEvent, outputs: KernelOutput[]): KernelReducerResult {
  const payload = event.payload as AddMessagePayload | undefined;
  if (!payload?.text) {
    return { nextState: state, outputs };
  }

  const newTurn: ConversationTurn = {
    role: payload.role,
    text: payload.text,
    type: payload.type || 'speech',
    timestamp: event.timestamp,
    imageData: payload.imageData,
    sources: payload.sources
  };

  let newConversation = [...state.conversation, newTurn];
  if (newConversation.length > MAX_CONVERSATION_TURNS) {
    newConversation = newConversation.slice(-MAX_CONVERSATION_TURNS);
  }

  const nextState: KernelState = {
    ...state,
    conversation: newConversation,
    silenceStart: event.timestamp
  };

  return { nextState, outputs };
}

export function handleClearConversation(state: KernelState, outputs: KernelOutput[]): KernelReducerResult {
  const nextState: KernelState = {
    ...state,
    conversation: []
  };

  outputs.push({
    type: 'LOG',
    payload: { message: 'CONVERSATION CLEARED' }
  });

  return { nextState, outputs };
}
