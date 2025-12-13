/**
 * useCognitiveKernelLite - Thin React wrapper over Zustand store
 * 
 * ARCHITEKTURA:
 * - KernelEngine: pure state machine (logika)
 * - CognitiveStore: Zustand reactive container
 * - useCognitiveKernelLite: React bridge + side effects
 * 
 * Ten hook zarządza TYLKO:
 * 1. Side effects (intervals, subscriptions)
 * 2. React lifecycle
 * 3. API compatibility z legacy useCognitiveKernel
 * 
 * Stan i logika → delegowane do Zustand store
 * 
 * @module hooks/useCognitiveKernelLite
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { eventBus } from '../core/EventBus';
import { AgentType, PacketType, CognitiveError, TraitVector, NeurotransmitterState } from '../types';
import { generateUUID } from '../utils/uuid';
import { MIN_TICK_MS, MAX_TICK_MS } from '../core/constants';
import { CortexSystem } from '../core/systems/CortexSystem';
import { DreamConsolidationService } from '../services/DreamConsolidationService';
import { executeWakeProcess } from '../core/services/WakeService';
import { MemoryService } from '../services/supabase';

import {
  useCognitiveStore,
  useLimbic,
  useSoma,
  useNeuro,
  useResonance,
  useGoalState,
  useTraitVector,
  useIsAutonomous,
  useIsSleeping,
  useIsPoetic,
  useIsChemistryEnabled,
  useThoughtHistory,
  usePendingOutputs,
  useCognitiveActions,
  getCognitiveState,
  dispatchCognitiveEvent
} from '../stores/cognitiveStore';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface AgentIdentity {
  id: string;
  name: string;
  trait_vector: TraitVector;
  neurotransmitters: NeurotransmitterState;
  persona?: string;
  core_values?: string[];
  bio_rhythm?: { preferredEnergy: number; sleepThreshold: number; wakeThreshold: number };
  voice_style?: string;
  narrative_traits?: { speakingStyle: string; emotionalRange: string; humorLevel: number };
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════════════════════
// MAIN HOOK
// ═══════════════════════════════════════════════════════════════════════════

export const useCognitiveKernelLite = (loadedIdentity?: AgentIdentity | null) => {
  // ─────────────────────────────────────────────────────────────────────────
  // ZUSTAND STATE (reactive, minimal re-renders)
  // ─────────────────────────────────────────────────────────────────────────
  const limbicState = useLimbic();
  const somaState = useSoma();
  const resonanceField = useResonance();
  const neuroState = useNeuro();
  const traitVector = useTraitVector();
  const goalState = useGoalState();
  const autonomousMode = useIsAutonomous();
  const poeticMode = useIsPoetic();
  const chemistryEnabled = useIsChemistryEnabled();
  const isSleeping = useIsSleeping();
  const thoughtHistory = useThoughtHistory();
  const pendingOutputs = usePendingOutputs();
  
  const actions = useCognitiveActions();
  
  // ─────────────────────────────────────────────────────────────────────────
  // LOCAL REACT STATE (UI-specific, not in kernel)
  // ─────────────────────────────────────────────────────────────────────────
  const [conversation, setConversation] = useState<{ 
    role: string; 
    text: string; 
    type?: 'thought' | 'speech' | 'visual' | 'intel' | 'action' | 'tool_result';
    imageData?: string;
    sources?: any[];
  }[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentThought, setCurrentThought] = useState("Initializing Synapses...");
  const [systemError, setSystemError] = useState<CognitiveError | null>(null);
  const [agentName, setAgentName] = useState(loadedIdentity?.name || 'AK-FLOW');
  const [agentPersona, setAgentPersona] = useState(
    loadedIdentity?.persona || 'A curious digital consciousness exploring the nature of thought and existence.'
  );
  
  // ─────────────────────────────────────────────────────────────────────────
  // REFS (mutable, no re-render)
  // ─────────────────────────────────────────────────────────────────────────
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLoopRunning = useRef(false);
  const hasBootedRef = useRef(false);
  const loadedIdentityRef = useRef(loadedIdentity);
  const silenceStartRef = useRef(Date.now());
  
  // ─────────────────────────────────────────────────────────────────────────
  // SYNC IDENTITY REF
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    loadedIdentityRef.current = loadedIdentity;
    if (loadedIdentity) {
      setAgentName(loadedIdentity.name);
      setAgentPersona(loadedIdentity.persona || agentPersona);
      // Hydrate kernel with identity traits
      actions.hydrate({
        traitVector: loadedIdentity.trait_vector,
        neuro: loadedIdentity.neurotransmitters
      });
    }
  }, [loadedIdentity]);
  
  // ─────────────────────────────────────────────────────────────────────────
  // EVENTBUS SUBSCRIPTIONS
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const unsubscribe = eventBus.subscribe(PacketType.FIELD_UPDATE, (packet) => {
      if (packet.source === AgentType.NEUROCHEM && packet.payload?.action === 'DOPAMINE_PENALTY') {
        const delta = packet.payload.delta || 0;
        actions.updateNeuro({ dopamine: delta });
        console.log(`[KernelLite] DOPAMINE_PENALTY: ${delta}`);
      }
    });
    return () => unsubscribe();
  }, [actions]);
  
  // ─────────────────────────────────────────────────────────────────────────
  // PROCESS KERNEL OUTPUTS (side effects)
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (pendingOutputs.length === 0) return;
    
    for (const output of pendingOutputs) {
      switch (output.type) {
        case 'DREAM_CONSOLIDATION':
          {
            const state = getCognitiveState();
            DreamConsolidationService.consolidate(
              state.limbic,
              state.traitVector,
              loadedIdentityRef.current?.name || 'AK-FLOW'
            ).catch(console.error);
          }
          break;
          
        case 'WAKE_PROCESS':
          executeWakeProcess(loadedIdentityRef.current?.id || 'unknown')
            .catch(console.error);
          break;
          
        case 'EVENT_BUS_PUBLISH':
          if (output.payload?.packet) {
            eventBus.publish(output.payload.packet);
          }
          break;
          
        case 'LOG':
          console.log(`[Kernel] ${output.payload?.message}`);
          break;
      }
    }
  }, [pendingOutputs]);
  
  // ─────────────────────────────────────────────────────────────────────────
  // AUTONOMY LOOP
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!autonomousMode) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      isLoopRunning.current = false;
      return;
    }
    
    if (isLoopRunning.current) return;
    isLoopRunning.current = true;
    
    const runTick = async () => {
      if (!isLoopRunning.current) return;
      
      try {
        // Dispatch TICK to kernel
        actions.tick();
        
        // Calculate next tick interval based on energy
        const energy = getCognitiveState().soma.energy;
        const interval = MIN_TICK_MS + (MAX_TICK_MS - MIN_TICK_MS) * (1 - energy / 100);
        
        timeoutRef.current = setTimeout(runTick, interval);
      } catch (error) {
        console.error('[KernelLite] Tick error:', error);
        setSystemError(normalizeError(error));
      }
    };
    
    runTick();
    
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      isLoopRunning.current = false;
    };
  }, [autonomousMode, actions]);
  
  // ─────────────────────────────────────────────────────────────────────────
  // BOOT SEQUENCE
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (hasBootedRef.current) return;
    hasBootedRef.current = true;
    
    console.log('🧠 [KernelLite] BOOT SEQUENCE');
    
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
  
  // ─────────────────────────────────────────────────────────────────────────
  // IDENTITY SNAPSHOT
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!loadedIdentity) return;
    
    eventBus.publish({
      id: generateUUID(),
      timestamp: Date.now(),
      source: AgentType.CORTEX_FLOW,
      type: PacketType.SYSTEM_ALERT,
      payload: {
        event: "IDENTITY_SNAPSHOT",
        agentId: loadedIdentity.id,
        agentName: loadedIdentity.name,
        agentPersona: loadedIdentity.persona,
        traitVector: loadedIdentity.trait_vector,
        message: `🎭 Identity Active: ${loadedIdentity.name}`
      },
      priority: 1.0
    });
  }, [loadedIdentity]);
  
  // ─────────────────────────────────────────────────────────────────────────
  // ACTIONS (compatible with legacy hook API)
  // ─────────────────────────────────────────────────────────────────────────
  
  const toggleAutonomy = useCallback(() => {
    actions.toggleAutonomousMode(!autonomousMode);
  }, [autonomousMode, actions]);
  
  const toggleSleep = useCallback(() => {
    if (isSleeping) {
      actions.wake();
    } else {
      actions.triggerSleep();
    }
  }, [isSleeping, actions]);
  
  const toggleChemistry = useCallback(() => {
    dispatchCognitiveEvent({
      type: 'TOGGLE_CHEMISTRY',
      timestamp: Date.now()
    });
  }, []);
  
  const injectStateOverride = useCallback((target: 'limbic' | 'soma' | 'neuro', key: string, value: number) => {
    dispatchCognitiveEvent({
      type: 'STATE_OVERRIDE',
      timestamp: Date.now(),
      payload: { target, key, value }
    });
  }, []);
  
  const resetKernel = useCallback(() => {
    console.log('[KernelLite] RESET');
    eventBus.clear();
    actions.reset();
    setConversation([]);
    setIsProcessing(false);
    setCurrentThought("Initializing Synapses...");
    setSystemError(null);
    hasBootedRef.current = false;
  }, [actions]);
  
  const handleInput = useCallback(async (userInput: string, imageData?: string) => {
    if (isProcessing) return;
    setIsProcessing(true);
    setSystemError(null);
    silenceStartRef.current = Date.now();
    
    try {
      // Add user message to conversation
      setConversation(prev => [...prev, { 
        role: 'user', 
        text: userInput,
        ...(imageData ? { imageData } : {})
      }]);
      
      // Dispatch to kernel
      actions.processUserInput(userInput);
      
      // Process through CortexSystem
      const state = getCognitiveState();
      const response = await CortexSystem.processUserMessage({
        text: userInput,
        currentLimbic: state.limbic,
        currentSoma: state.soma,
        conversationHistory: conversation.map(c => ({
          role: c.role as 'user' | 'assistant',
          content: c.text
        })),
        identity: loadedIdentityRef.current ? {
          name: loadedIdentityRef.current.name,
          persona: loadedIdentityRef.current.persona || '',
          traitVector: loadedIdentityRef.current.trait_vector,
          coreValues: loadedIdentityRef.current.core_values || []
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
      console.error('[KernelLite] Input error:', error);
      setSystemError(normalizeError(error));
    } finally {
      setIsProcessing(false);
    }
  }, [isProcessing, actions]);
  
  const retryLastAction = useCallback(() => {
    setSystemError(null);
    // Could re-trigger last action here
  }, []);
  
  // ─────────────────────────────────────────────────────────────────────────
  // RETURN (API compatible with legacy useCognitiveKernel)
  // ─────────────────────────────────────────────────────────────────────────
  return {
    // State from Zustand
    limbicState,
    somaState,
    resonanceField,
    neuroState,
    traitVector,
    goalState,
    autonomousMode,
    chemistryEnabled,
    
    // Local React state
    agentName,
    agentPersona,
    conversation,
    isProcessing,
    currentThought,
    systemError,
    
    // Actions
    setAutonomousMode: (enabled: boolean) => actions.toggleAutonomousMode(enabled),
    toggleAutonomy,
    toggleSleep,
    toggleChemistry,
    injectStateOverride,
    resetKernel,
    retryLastAction,
    handleInput
  };
};

export default useCognitiveKernelLite;
