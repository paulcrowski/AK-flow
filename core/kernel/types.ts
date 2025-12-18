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
// CONVERSATION TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface ConversationTurn {
  role: 'user' | 'assistant';
  text: string;
  type?: 'thought' | 'speech' | 'visual' | 'intel' | 'action' | 'tool_result';
  timestamp: number;
  imageData?: string;
  sources?: any[];
}

// ═══════════════════════════════════════════════════════════════════════════
// SOCIAL DYNAMICS - Soft homeostasis for autonomous speech regulation
// ═══════════════════════════════════════════════════════════════════════════

export interface SocialDynamics {
  socialCost: number;                    // 0-1, increases with speeches, decays over time
  autonomyBudget: number;                // 0-1, spent on speech, regenerates slowly
  userPresenceScore: number;             // 0-1, high when user active, decays in silence
  consecutiveWithoutResponse: number;    // Counter for speeches without user reply
}

export interface WorkingSetStep {
  id: string;
  text: string;
  done: boolean;
}

export interface WorkingSet {
  id: string;
  title?: string;
  steps: WorkingSetStep[];
  cursor: number; // index of current step
  createdAt: number;
  updatedAt: number;
}

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
  workingSet: WorkingSet | null;

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

  // Social dynamics (soft homeostasis for autonomous speech)
  socialDynamics: SocialDynamics;

  // History (bounded)
  thoughtHistory: string[];

  // Conversation history (bounded, persists in state machine)
  conversation: ConversationTurn[];
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
  | 'ADD_MESSAGE'             // Add message to conversation
  | 'CLEAR_CONVERSATION'      // Clear conversation history
  | 'WORKING_SET_SET'         // Set/replace working plan
  | 'WORKING_SET_ADVANCE'     // Mark current step done and advance cursor
  | 'WORKING_SET_CLEAR'       // Clear working set
  | 'SOCIAL_DYNAMICS_UPDATE'  // Update social dynamics (soft homeostasis)
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
  | WorkingSetSetPayload
  | AddMessagePayload
  | SocialDynamicsPayload
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

export interface WorkingSetSetPayload {
  title?: string;
  steps: string[];
}

export interface AddMessagePayload {
  role: 'user' | 'assistant';
  text: string;
  type?: 'thought' | 'speech' | 'visual' | 'intel' | 'action' | 'tool_result';
  imageData?: string;
  sources?: any[];
}

export interface SocialDynamicsPayload {
  agentSpoke?: boolean;         // Agent just spoke
  userResponded?: boolean;      // User just responded
}

export interface EmptyPayload { }

// ═══════════════════════════════════════════════════════════════════════════
// KERNEL OUTPUTS - Side effects to be executed by runtime
// ═══════════════════════════════════════════════════════════════════════════

export type KernelOutputType =
  | 'LOG'                     // Console/telemetry log
  | 'EVENT_BUS_PUBLISH'       // Publish to EventBus
  | 'MEMORY_STORE'            // Store to Supabase
  | 'SCHEDULE_TICK'           // Schedule next tick
  | 'DREAM_CONSOLIDATION'     // Trigger dream service
  | 'WAKE_PROCESS'            // Trigger wake service
  | 'MAYBE_REM_CYCLE'         // Probabilistic REM cycle (runtime decides)
  | 'MAYBE_DREAM_CONSOLIDATION'; // Probabilistic dream consolidation (runtime decides)

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
