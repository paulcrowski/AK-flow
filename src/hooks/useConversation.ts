/**
 * useConversation - Manages conversation state and user input handling
 * 
 * Extracted from useCognitiveKernelLite for single responsibility.
 * Handles: conversation state, message adding, input processing.
 * 
 * NOTE: This is temporary local state. P3 will move conversation to KernelState.
 * 
 * @module hooks/useConversation
 */

import { useState, useCallback, useRef, type MutableRefObject } from 'react';
import { EventLoop } from '@core/systems/EventLoop';
import { createLoopRuntimeState } from '@core/systems/LoopRuntimeState';
import { getCognitiveState, useCognitiveActions } from '../stores/cognitiveStore';
import type { CognitiveError } from '../types';
import type { AgentIdentity } from './useCognitiveKernelLite';

export interface ConversationMessage {
  role: string;
  text: string;
  type?: 'thought' | 'speech' | 'visual' | 'intel' | 'action' | 'tool_result';
  imageData?: string;
  sources?: any[];
}

interface UseConversationConfig {
  identityRef: MutableRefObject<AgentIdentity | null | undefined>;
}

const normalizeError = (e: unknown): CognitiveError => {
  let msg = "Unknown Error";
  try {
    if (e instanceof Error) msg = e.message;
    else if (typeof e === 'string') msg = e;
    else msg = JSON.stringify(e);
  } catch {
    msg = "Non-serializable Error";
  }
  return {
    code: (e as any)?.code || 'UNKNOWN',
    message: msg,
    retryable: (e as any)?.retryable ?? true,
    details: (e as any)?.details || ''
  };
};

export const useConversation = ({ identityRef }: UseConversationConfig) => {
  const [conversation, setConversation] = useState<ConversationMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentThought, setCurrentThought] = useState("Initializing Synapses...");
  const [systemError, setSystemError] = useState<CognitiveError | null>(null);
  
  const silenceStartRef = useRef(Date.now());
  const loopRuntimeRef = useRef(createLoopRuntimeState());
  const actions = useCognitiveActions();
  
  const handleInput = useCallback(async (userInput: string, imageData?: string) => {
    if (isProcessing) return;
    setIsProcessing(true);
    setSystemError(null);
    silenceStartRef.current = Date.now();
    
    try {
      // Add user message to conversation (optimistic UI update)
      setConversation(prev => [...prev, { 
        role: 'user', 
        text: userInput,
        ...(imageData ? { imageData } : {})
      }]);
      
      // Dispatch to kernel - this triggers CortexSystem through EventLoop
      actions.processUserInput(userInput);

      const state = getCognitiveState();
      const ctx: EventLoop.LoopContext = {
        soma: state.soma,
        limbic: state.limbic,
        neuro: state.neuro,
        conversation: [
          ...conversation.map(c => ({
            role: c.role as 'user' | 'assistant',
            text: c.text,
            type: c.type
          })),
          { role: 'user', text: userInput }
        ],
        autonomousMode: false,
        lastSpeakTimestamp: state.lastSpeakTimestamp,
        silenceStart: state.silenceStart,
        thoughtHistory: state.thoughtHistory,
        poeticMode: state.poeticMode,
        autonomousLimitPerMinute: 3,
        chemistryEnabled: state.chemistryEnabled,
        goalState: state.goalState,
        traitVector: state.traitVector,
        consecutiveAgentSpeeches: state.consecutiveAgentSpeeches,
        ticksSinceLastReward: state.ticksSinceLastReward,
        hadExternalRewardThisTick: false,
        runtime: loopRuntimeRef.current,
        agentIdentity: identityRef.current ? {
          name: identityRef.current.name,
          persona: identityRef.current.persona || '',
          coreValues: identityRef.current.core_values || [],
          traitVector: identityRef.current.trait_vector,
          voiceStyle: identityRef.current.voice_style || 'balanced',
          language: identityRef.current.language || 'English',
          stylePrefs: identityRef.current.style_prefs
        } : undefined,
        socialDynamics: state.socialDynamics,
        userStylePrefs: identityRef.current?.style_prefs || {}
      };

      await EventLoop.runSingleStep(ctx, userInput, {
        onMessage: (role, text, type, meta) => {
          if (role === 'assistant' && type === 'speech') {
            setConversation(prev => [...prev, { role, text, type: 'speech' }]);
            setCurrentThought(text.slice(0, 100) + '...');
          } else if (role === 'assistant' && type === 'thought') {
            setCurrentThought(text);
          } else if (role === 'assistant' && (type === 'intel' || type === 'tool_result')) {
            setConversation(prev => [
              ...prev,
              {
                role,
                text,
                type,
                ...(meta?.sources ? { sources: meta.sources } : {})
              }
            ]);
          }
        },
        onThought: (thought) => setCurrentThought(thought),
        onSomaUpdate: (soma) => actions.hydrate({ soma }),
        onLimbicUpdate: (limbic) => actions.hydrate({ limbic })
      });

    } catch (error) {
      console.error('[Conversation] Input error:', error);
      setSystemError(normalizeError(error));
    } finally {
      setIsProcessing(false);
    }
  }, [isProcessing, actions, conversation, identityRef]);
  
  const clearConversation = useCallback(() => {
    setConversation([]);
    setCurrentThought("Initializing Synapses...");
    setSystemError(null);
    setIsProcessing(false);
  }, []);
  
  const retryLastAction = useCallback(() => {
    setSystemError(null);
  }, []);
  
  return {
    conversation,
    isProcessing,
    currentThought,
    systemError,
    handleInput,
    clearConversation,
    retryLastAction,
    setCurrentThought,
    setSystemError,
    setIsProcessing
  };
};

export default useConversation;
