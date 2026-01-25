/**
 * KernelEngine - Barrel Export
 * 
 * @module core/kernel
 */

// Types
export type {
  KernelState,
  KernelEvent,
  KernelEventType,
  KernelEventPayload,
  KernelOutput,
  KernelOutputType,
  KernelReducerResult,
  Focus,
  Cursor,
  WorkingSet,
  WorkingSetStep,
  TickPayload,
  UserInputPayload,
  AgentSpokePayload,
  ToolResultPayload,
  MoodShiftPayload,
  NeuroUpdatePayload,
  StateOverridePayload,
  GoalPayload,
  EmptyPayload
} from './types';

// Initial State
export {
  INITIAL_LIMBIC,
  INITIAL_SOMA,
  INITIAL_NEURO,
  INITIAL_RESONANCE,
  DEFAULT_TRAIT_VECTOR,
  INITIAL_GOAL_STATE,
  BASELINE_NEURO,
  createInitialKernelState
} from './initialState';

// Reducer
export { kernelReducer } from './reducer';

// Engine
export {
  KernelEngine,
  getKernelEngine,
  resetGlobalEngine,
  createKernelEngine
} from './KernelEngine';
export type { KernelListener } from './KernelEngine';
