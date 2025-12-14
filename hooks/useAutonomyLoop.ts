/**
 * useAutonomyLoop - Manages autonomous cognitive tick loop
 * 
 * Extracted from useCognitiveKernelLite for single responsibility.
 * Handles: tick scheduling, energy-based intervals, loop lifecycle.
 * 
 * @module hooks/useAutonomyLoop
 */

import { useEffect, useRef } from 'react';
import { MIN_TICK_MS, MAX_TICK_MS } from '../core/constants';
import { getCognitiveState, useCognitiveActions } from '../stores/cognitiveStore';

interface UseAutonomyLoopConfig {
  enabled: boolean;
  onError?: (error: Error) => void;
}

export const useAutonomyLoop = ({ enabled, onError }: UseAutonomyLoopConfig) => {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLoopRunning = useRef(false);
  const actions = useCognitiveActions();
  
  useEffect(() => {
    if (!enabled) {
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
        console.error('[AutonmyLoop] Tick error:', error);
        onError?.(error instanceof Error ? error : new Error(String(error)));
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
  }, [enabled, actions, onError]);
  
  return {
    isRunning: isLoopRunning.current
  };
};

export default useAutonomyLoop;
