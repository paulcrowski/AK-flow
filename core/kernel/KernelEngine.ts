/**
 * KernelEngine - Pure Cognitive State Machine
 * 
 * ZERO React. ZERO side effects w logice.
 * Wszystkie side effects są zwracane jako outputs i wykonywane przez Runtime.
 * 
 * Architektura:
 *   Event -> Reducer -> { nextState, outputs }
 *                            |
 *                            v
 *                       Runtime executes outputs
 * 
 * @module core/kernel/KernelEngine
 */

import type { KernelState, KernelEvent, KernelEventType, KernelOutput, KernelReducerResult } from './types';
import { kernelReducer } from './reducer';
import { createInitialKernelState } from './initialState';

// ═══════════════════════════════════════════════════════════════════════════
// LISTENER TYPE
// ═══════════════════════════════════════════════════════════════════════════

export type KernelListener = (state: KernelState, outputs: KernelOutput[]) => void;

// ═══════════════════════════════════════════════════════════════════════════
// KERNEL ENGINE CLASS
// ═══════════════════════════════════════════════════════════════════════════

export class KernelEngine {
  private state: KernelState;
  private listeners: Set<KernelListener> = new Set();
  private eventHistory: KernelEvent[] = [];
  private readonly maxHistorySize = 100;
  
  constructor(initialState?: Partial<KernelState>) {
    this.state = createInitialKernelState(initialState);
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * Dispatch event to the state machine.
   * Returns outputs that need to be executed by runtime.
   */
  dispatch(event: KernelEvent): KernelOutput[] {
    // Store event in history
    this.eventHistory.push(event);
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.shift();
    }
    
    // Run pure reducer
    const result = kernelReducer(this.state, event);
    
    // Update state
    this.state = result.nextState;
    
    // Notify listeners
    this.notify(result.outputs);
    
    return result.outputs;
  }
  
  /**
   * Convenience method: dispatch with just type and optional payload.
   */
  emit(type: KernelEventType, payload?: any): KernelOutput[] {
    return this.dispatch({
      type,
      payload,
      timestamp: Date.now()
    });
  }
  
  /**
   * Get current state (immutable snapshot).
   */
  getState(): Readonly<KernelState> {
    return this.state;
  }
  
  /**
   * Get specific slice of state.
   */
  select<K extends keyof KernelState>(key: K): KernelState[K] {
    return this.state[key];
  }
  
  /**
   * Subscribe to state changes.
   * Returns unsubscribe function.
   */
  subscribe(listener: KernelListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
  
  /**
   * Get event history (for debugging/replay).
   */
  getEventHistory(): readonly KernelEvent[] {
    return this.eventHistory;
  }
  
  /**
   * Reset to initial state (preserves traitVector).
   */
  reset(): KernelOutput[] {
    return this.emit('RESET');
  }
  
  /**
   * Force set state (for hydration from persistence).
   * Use with caution - bypasses reducer.
   */
  hydrate(state: KernelState): void {
    this.state = state;
    this.notify([]);
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // CONVENIENCE DISPATCHERS
  // ═══════════════════════════════════════════════════════════════════════
  
  tick(deltaMs: number = 0): KernelOutput[] {
    return this.emit('TICK', { deltaMs });
  }
  
  userInput(text: string, detectedStyle?: 'POETIC' | 'SIMPLE' | 'NEUTRAL'): KernelOutput[] {
    return this.emit('USER_INPUT', { text, detectedStyle });
  }
  
  agentSpoke(text: string, voicePressure: number = 1.0): KernelOutput[] {
    return this.emit('AGENT_SPOKE', { text, voicePressure });
  }
  
  toolResult(toolType: 'SEARCH' | 'VISUALIZE', success: boolean): KernelOutput[] {
    return this.emit('TOOL_RESULT', { toolType, success });
  }
  
  sleepStart(): KernelOutput[] {
    return this.emit('SLEEP_START');
  }
  
  sleepEnd(): KernelOutput[] {
    return this.emit('SLEEP_END');
  }
  
  moodShift(delta: { fear_delta?: number; curiosity_delta?: number }): KernelOutput[] {
    return this.emit('MOOD_SHIFT', { delta });
  }
  
  neuroUpdate(delta: { dopamine?: number; serotonin?: number; norepinephrine?: number }, reason?: string): KernelOutput[] {
    return this.emit('NEURO_UPDATE', { delta, reason });
  }
  
  toggleAutonomy(): KernelOutput[] {
    return this.emit('TOGGLE_AUTONOMY');
  }
  
  toggleChemistry(): KernelOutput[] {
    return this.emit('TOGGLE_CHEMISTRY');
  }
  
  togglePoetic(): KernelOutput[] {
    return this.emit('TOGGLE_POETIC');
  }
  
  stateOverride(target: 'limbic' | 'soma' | 'neuro', key: string, value: number): KernelOutput[] {
    return this.emit('STATE_OVERRIDE', { target, key, value });
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // PRIVATE
  // ═══════════════════════════════════════════════════════════════════════
  
  private notify(outputs: KernelOutput[]): void {
    for (const listener of this.listeners) {
      try {
        listener(this.state, outputs);
      } catch (e) {
        console.error('[KernelEngine] Listener error:', e);
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SINGLETON INSTANCE (optional - for global access)
// ═══════════════════════════════════════════════════════════════════════════

let globalEngine: KernelEngine | null = null;

export function getKernelEngine(): KernelEngine {
  if (!globalEngine) {
    globalEngine = new KernelEngine();
  }
  return globalEngine;
}

export function resetGlobalEngine(): void {
  globalEngine = null;
}

// ═══════════════════════════════════════════════════════════════════════════
// FACTORY
// ═══════════════════════════════════════════════════════════════════════════

export function createKernelEngine(initialState?: Partial<KernelState>): KernelEngine {
  return new KernelEngine(initialState);
}
