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
import { CortexSystem } from '../core/systems/CortexSystem';
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
      
      // UNIFIED BRAIN: Process through CortexSystem (single path)
      // This is the ONLY place where CortexSystem is called for user input
      const state = getCognitiveState();
      const response = await CortexSystem.processUserMessage({
        text: userInput,
        currentLimbic: state.limbic,
        currentSoma: state.soma,
        conversationHistory: conversation.map(c => ({
          role: c.role as 'user' | 'assistant',
          content: c.text
        })),
        identity: identityRef.current ? {
          name: identityRef.current.name,
          persona: identityRef.current.persona || '',
          traitVector: identityRef.current.trait_vector,
          coreValues: identityRef.current.core_values || []
        } : undefined
      });
      
      // Add response to conversation
      setConversation(prev => [...prev, {
        role: 'assistant',
        text: response.responseText,
        type: 'speech'
      }]);
      
      // Apply mood shift if any
      if (response.moodShift) {
        actions.applyMoodShift(response.moodShift);
      }
      
      setCurrentThought(response.internalThought || response.responseText.slice(0, 100) + '...');
      
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
