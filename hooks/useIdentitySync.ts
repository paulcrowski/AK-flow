/**
 * useIdentitySync - Syncs loaded identity to kernel state
 * 
 * Extracted from useCognitiveKernelLite for single responsibility.
 * Handles: identity hydration, boot sequence, identity snapshot publishing.
 * 
 * @module hooks/useIdentitySync
 */

import { useEffect, useRef } from 'react';
import { eventBus } from '../core/EventBus';
import { AgentType, PacketType } from '../types';
import { generateUUID } from '../utils/uuid';
import { useCognitiveActions } from '../stores/cognitiveStore';
import type { AgentIdentity } from './useCognitiveKernelLite';

interface UseIdentitySyncConfig {
  identity: AgentIdentity | null | undefined;
  onNameChange?: (name: string) => void;
  onPersonaChange?: (persona: string) => void;
}

export const useIdentitySync = ({ identity, onNameChange, onPersonaChange }: UseIdentitySyncConfig) => {
  const actions = useCognitiveActions();
  const hasBootedRef = useRef(false);
  const identityRef = useRef(identity);
  
  // Keep identity ref in sync (for stale closure fix)
  useEffect(() => {
    identityRef.current = identity;
    if (identity) {
      onNameChange?.(identity.name);
      onPersonaChange?.(identity.persona || 'A curious digital consciousness exploring the nature of thought and existence.');
      
      // Hydrate kernel with identity traits
      actions.hydrate({
        traitVector: identity.trait_vector,
        neuro: identity.neurotransmitters
      });
    }
  }, [identity, actions, onNameChange, onPersonaChange]);
  
  // Boot sequence (once per mount)
  useEffect(() => {
    if (hasBootedRef.current) return;
    hasBootedRef.current = true;
    
    console.log('🧠 [IdentitySync] BOOT SEQUENCE');
    
    eventBus.publish({
      id: generateUUID(),
      timestamp: Date.now(),
      source: AgentType.CORTEX_FLOW,
      type: PacketType.SYSTEM_ALERT,
      payload: {
        event: "KERNEL_BOOT",
        architecture: "KernelEngine + Zustand + React",
        message: "🧠 Cognitive Kernel Lite Activated"
      },
      priority: 1.0
    });
  }, []);
  
  // Identity snapshot on load
  useEffect(() => {
    if (!identity) return;
    
    eventBus.publish({
      id: generateUUID(),
      timestamp: Date.now(),
      source: AgentType.CORTEX_FLOW,
      type: PacketType.SYSTEM_ALERT,
      payload: {
        event: "IDENTITY_SNAPSHOT",
        agentId: identity.id,
        agentName: identity.name,
        agentPersona: identity.persona,
        traitVector: identity.trait_vector,
        message: `🎭 Identity Active: ${identity.name}`
      },
      priority: 1.0
    });
  }, [identity]);
  
  return {
    identityRef,
    resetBoot: () => { hasBootedRef.current = false; }
  };
};

export default useIdentitySync;
