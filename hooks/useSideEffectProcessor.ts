/**
 * useSideEffectProcessor - Processes kernel outputs as side effects
 * 
 * Extracted from useCognitiveKernelLite for single responsibility.
 * Handles: EventBus publishing, dream consolidation, wake process, probabilistic outputs.
 * 
 * @module hooks/useSideEffectProcessor
 */

import { useEffect, useRef } from 'react';
import { eventBus } from '../core/EventBus';
import { AgentType, PacketType } from '../types';
import { generateUUID } from '../utils/uuid';
import { DreamConsolidationService } from '../services/DreamConsolidationService';
import { executeWakeProcess } from '../core/services/WakeService';
import { getCognitiveState, usePendingOutputs } from '../stores/cognitiveStore';
import { createRng } from '../core/utils/rng';
import { SYSTEM_CONFIG } from '../core/config/systemConfig';
import type { KernelOutput } from '../core/kernel/types';

// Deterministic RNG for reproducible behavior
const rng = createRng(SYSTEM_CONFIG.rng.seed);

interface UseSideEffectProcessorConfig {
  agentName: string;
  agentId?: string;
}

export const useSideEffectProcessor = ({ agentName, agentId }: UseSideEffectProcessorConfig) => {
  const pendingOutputs = usePendingOutputs();
  const agentNameRef = useRef(agentName);
  const agentIdRef = useRef(agentId);
  
  // Keep refs in sync
  useEffect(() => {
    agentNameRef.current = agentName;
    agentIdRef.current = agentId;
  }, [agentName, agentId]);
  
  useEffect(() => {
    if (pendingOutputs.length === 0) return;
    
    for (const output of pendingOutputs) {
      try {
        processOutput(output, agentNameRef.current, agentIdRef.current);
      } catch (e) {
        console.error('[SideEffectProcessor] Error processing output:', output.type, e);
        // Continue processing other outputs
      }
    }
  }, [pendingOutputs]);
};

function processOutput(output: KernelOutput, agentName: string, agentId?: string): void {
  switch (output.type) {
    case 'DREAM_CONSOLIDATION':
      {
        const state = getCognitiveState();
        DreamConsolidationService.consolidate(
          state.limbic,
          state.traitVector,
          agentName
        ).catch(console.error);
      }
      break;
      
    case 'WAKE_PROCESS':
      {
        const state = getCognitiveState();
        executeWakeProcess({
          agentId: agentId || 'unknown',
          agentName: agentName,
          currentTraits: state.traitVector,
          currentLimbic: state.limbic,
          currentNeuro: state.neuro
        }).catch(console.error);
      }
      break;
      
    case 'EVENT_BUS_PUBLISH':
      if (output.payload?.packet) {
        eventBus.publish(output.payload.packet);
      }
      break;
      
    case 'LOG':
      console.log(`[Kernel] ${output.payload?.message}`);
      break;
      
    case 'MAYBE_REM_CYCLE':
      // Runtime handles randomness - reducer stays pure
      if (rng() < (output.payload?.probability || 0.3)) {
        eventBus.publish({
          id: generateUUID(),
          timestamp: Date.now(),
          source: AgentType.VISUAL_CORTEX,
          type: PacketType.THOUGHT_CANDIDATE,
          payload: { 
            internal_monologue: `REM Cycle: Dreaming... Energy at ${output.payload?.energy || 0}%` 
          },
          priority: 0.1
        });
      }
      break;
      
    case 'MAYBE_DREAM_CONSOLIDATION':
      // Runtime handles randomness - reducer stays pure
      if (rng() < (output.payload?.probability || 0.5)) {
        const state = getCognitiveState();
        DreamConsolidationService.consolidate(
          state.limbic,
          state.traitVector,
          agentName
        ).catch(console.error);
      }
      break;
  }
}

export default useSideEffectProcessor;
