/**
 * KernelEngine Types
 * 
 * Pure TypeScript types dla cognitive state machine.
 * ZERO React, ZERO side effects.
 * 
 * @module core/kernel/types
 */

import type { LimbicState, SomaState, NeurotransmitterState, GoalState, ResonanceField } from '../../types';
import type { TraitVector } from '../../types';

// ═══════════════════════════════════════════════════════════════════════════
// KERNEL STATE - Immutable snapshot of cognitive system
// ═══════════════════════════════════════════════════════════════════════════

export interface KernelState {
  // Biological substrates
  limbic: LimbicState;
  soma: SomaState;
  neuro: NeurotransmitterState;
  resonance: ResonanceField;
  
  // Personality & Goals
  traitVector: TraitVector;
  goalState: GoalState;
  
  // Mode flags
  autonomousMode: boolean;
  poeticMode: boolean;
  chemistryEnabled: boolean;
  
  // Temporal tracking
  lastSpeakTimestamp: number;
  silenceStart: number;
  lastUserInteractionAt: number;
  
  // Counters (for RPE, narcissism guard, etc.)
  consecutiveAgentSpeeches: number;
  ticksSinceLastReward: number;
  
  // History (bounded)
  thoughtHistory: string[];
}

// ═══════════════════════════════════════════════════════════════════════════
// KERNEL EVENTS - All possible inputs to the state machine
// ═══════════════════════════════════════════════════════════════════════════

export type KernelEventType =
  | 'TICK'                    // Autonomous loop tick
  | 'USER_INPUT'              // User sent message
  | 'AGENT_SPOKE'             // Agent produced speech
  | 'TOOL_RESULT'             // External tool returned result
  | 'SLEEP_START'             // Enter sleep mode
  | 'SLEEP_END'               // Wake up
  | 'GOAL_FORMED'             // New goal created
  | 'GOAL_COMPLETED'          // Goal finished
  | 'MOOD_SHIFT'              // Limbic update
  | 'NEURO_UPDATE'            // Neurotransmitter change
  | 'TOGGLE_AUTONOMY'         // Switch autonomy mode
  | 'TOGGLE_CHEMISTRY'        // Enable/disable neurochemistry
  | 'TOGGLE_POETIC'           // Switch poetic mode
  | 'THOUGHT_GENERATED'       // New thought added to history
  | 'HYDRATE'                 // Restore state from storage
  | 'STATE_OVERRIDE'          // Debug: manual state injection
  | 'RESET';                  // Full kernel reset

export interface KernelEvent {
  type: KernelEventType;
  payload?: KernelEventPayload;
  timestamp: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// EVENT PAYLOADS - Discriminated union for type-safe payloads
// ═══════════════════════════════════════════════════════════════════════════

export type KernelEventPayload =
  | TickPayload
  | UserInputPayload
  | AgentSpokePayload
  | ToolResultPayload
  | MoodShiftPayload
  | NeuroUpdatePayload
  | StateOverridePayload
  | GoalPayload
  | EmptyPayload;

export interface TickPayload {
  deltaMs: number;
}

export interface UserInputPayload {
  text: string;
  detectedStyle?: 'POETIC' | 'SIMPLE' | 'NEUTRAL';
}

export interface AgentSpokePayload {
  text: string;
  voicePressure: number;
}

export interface ToolResultPayload {
  toolType: 'SEARCH' | 'VISUALIZE';
  success: boolean;
}

export interface MoodShiftPayload {
  delta: { fear_delta?: number; curiosity_delta?: number };
}

export interface NeuroUpdatePayload {
  delta: Partial<NeurotransmitterState>;
  reason?: string;
}

export interface StateOverridePayload {
  target: 'limbic' | 'soma' | 'neuro';
  key: string;
  value: number;
}

export interface GoalPayload {
  goalId?: string;
  description?: string;
}

export interface EmptyPayload {}

// ═══════════════════════════════════════════════════════════════════════════
// KERNEL OUTPUTS - Side effects to be executed by runtime
// ═══════════════════════════════════════════════════════════════════════════

export type KernelOutputType =
  | 'LOG'                     // Console/telemetry log
  | 'EVENT_BUS_PUBLISH'       // Publish to EventBus
  | 'MEMORY_STORE'            // Store to Supabase
  | 'SCHEDULE_TICK'           // Schedule next tick
  | 'DREAM_CONSOLIDATION'     // Trigger dream service
  | 'WAKE_PROCESS';           // Trigger wake service

export interface KernelOutput {
  type: KernelOutputType;
  payload: any;
}

// ═══════════════════════════════════════════════════════════════════════════
// REDUCER RESULT - New state + side effects
// ═══════════════════════════════════════════════════════════════════════════

export interface KernelReducerResult {
  nextState: KernelState;
  outputs: KernelOutput[];
}
