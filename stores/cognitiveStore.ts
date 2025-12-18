/**
 * CognitiveStore - Zustand adapter for KernelEngine
 * 
 * Architektura:
 * - KernelEngine: pure state machine (logika)
 * - Zustand: reactive state container (React bridge)
 * - Hook: tylko subskrybuje i renderuje (view layer)
 * 
 * "React is the eyes and hands, not the brain"
 * 
 * @module stores/cognitiveStore
 */

import { create } from 'zustand';
import { subscribeWithSelector, persist, createJSONStorage } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';
import {
  KernelEngine,
  KernelState,
  KernelEvent,
  KernelOutput,
  createInitialKernelState
} from '../core/kernel';
import type { LimbicState, SomaState, NeurotransmitterState, GoalState, TraitVector } from '../types';

// ... (existing imports)


// ═══════════════════════════════════════════════════════════════════════════
// STORE STATE INTERFACE
// ═══════════════════════════════════════════════════════════════════════════

interface CognitiveStoreState extends KernelState {
  // Engine instance (internal)
  _engine: KernelEngine;

  // Pending outputs from last dispatch (side effects)
  pendingOutputs: KernelOutput[];

  // Actions
  dispatch: (event: KernelEvent) => void;

  // Convenience actions (delegate to dispatch)
  tick: () => void;
  processUserInput: (input: string) => void;
  toggleAutonomousMode: (enabled: boolean) => void;
  togglePoeticMode: (enabled: boolean) => void;
  triggerSleep: () => void;
  wake: () => void;
  applyMoodShift: (delta: { fear_delta?: number; curiosity_delta?: number }) => void;
  updateNeuro: (neuro: Partial<NeurotransmitterState>) => void;
  formGoal: (goal: string, priority: number) => void;
  completeGoal: () => void;
  setWorkingSet: (steps: string[], title?: string) => void;
  advanceWorkingSet: () => void;
  clearWorkingSet: () => void;
  addThought: (thought: string) => void;
  addMessage: (role: 'user' | 'assistant', text: string, type?: 'thought' | 'speech' | 'visual' | 'intel' | 'action' | 'tool_result', imageData?: string, sources?: any[]) => void;
  clearConversation: () => void;
  updateSocialDynamics: (payload: { agentSpoke?: boolean; userResponded?: boolean }) => void;
  reset: () => void;
  hydrate: (state: Partial<KernelState>) => void;

  // Selectors (for atomic re-renders)
  getLimbic: () => LimbicState;
  getSoma: () => SomaState;
  getNeuro: () => NeurotransmitterState;
  getGoalState: () => GoalState;
  getTraitVector: () => TraitVector;
  isAutonomous: () => boolean;
  isSleeping: () => boolean;
  getEnergy: () => number;
}

// ═══════════════════════════════════════════════════════════════════════════
// CREATE STORE
// ═══════════════════════════════════════════════════════════════════════════

export const useCognitiveStore = create<CognitiveStoreState>()(
  persist(
    subscribeWithSelector((set, get) => {
      // Create engine instance
      const engine = new KernelEngine();

      // Subscribe to engine state changes → update Zustand
      engine.subscribe((newState, outputs) => {
        set({
          ...newState,
          pendingOutputs: outputs
        });
      });

      // Initial state from engine
      const initialState = engine.getState();

      return {
        // Spread initial kernel state
        ...initialState,

        // Internal
        _engine: engine,
        pendingOutputs: [],

        // ─────────────────────────────────────────────────────────────────────
        // MAIN DISPATCH - all state changes go through here
        // ─────────────────────────────────────────────────────────────────────
        dispatch: (event: KernelEvent) => {
          const { _engine } = get();
          _engine.dispatch(event);
          // State update happens via subscription above
        },

        // ─────────────────────────────────────────────────────────────────────
        // CONVENIENCE ACTIONS (sugar over dispatch)
        // ─────────────────────────────────────────────────────────────────────
        tick: () => {
          get().dispatch({ type: 'TICK', timestamp: Date.now() });
        },

        processUserInput: (input: string) => {
          get().dispatch({
            type: 'USER_INPUT',
            timestamp: Date.now(),
            payload: { input }
          });
        },

        toggleAutonomousMode: (enabled: boolean) => {
          get().dispatch({
            type: 'TOGGLE_AUTONOMY',
            timestamp: Date.now(),
            payload: { enabled }
          });
        },

        togglePoeticMode: (enabled: boolean) => {
          get().dispatch({
            type: 'TOGGLE_POETIC',
            timestamp: Date.now(),
            payload: { enabled }
          });
        },

        triggerSleep: () => {
          get().dispatch({ type: 'SLEEP_START', timestamp: Date.now() });
        },

        wake: () => {
          get().dispatch({ type: 'SLEEP_END', timestamp: Date.now() });
        },

        applyMoodShift: (delta) => {
          get().dispatch({
            type: 'MOOD_SHIFT',
            timestamp: Date.now(),
            payload: { delta }
          });
        },

        updateNeuro: (delta) => {
          get().dispatch({
            type: 'NEURO_UPDATE',
            timestamp: Date.now(),
            payload: { delta }
          });
        },

        formGoal: (goal: string, priority: number) => {
          get().dispatch({
            type: 'GOAL_FORMED',
            timestamp: Date.now(),
            payload: { goal, priority }
          });
        },

        completeGoal: () => {
          get().dispatch({ type: 'GOAL_COMPLETED', timestamp: Date.now() });
        },

        setWorkingSet: (steps: string[], title?: string) => {
          get().dispatch({
            type: 'WORKING_SET_SET',
            timestamp: Date.now(),
            payload: { steps, ...(title ? { title } : {}) }
          });
        },

        advanceWorkingSet: () => {
          get().dispatch({ type: 'WORKING_SET_ADVANCE', timestamp: Date.now() });
        },

        clearWorkingSet: () => {
          get().dispatch({ type: 'WORKING_SET_CLEAR', timestamp: Date.now() });
        },

        addThought: (thought: string) => {
          get().dispatch({
            type: 'THOUGHT_GENERATED',
            timestamp: Date.now(),
            payload: { thought }
          });
        },

        addMessage: (role, text, type = 'speech', imageData, sources) => {
          get().dispatch({
            type: 'ADD_MESSAGE',
            timestamp: Date.now(),
            payload: { role, text, type, imageData, sources }
          });
        },

        clearConversation: () => {
          get().dispatch({ type: 'CLEAR_CONVERSATION', timestamp: Date.now() });
        },

        updateSocialDynamics: (payload: { agentSpoke?: boolean; userResponded?: boolean }) => {
          get().dispatch({
            type: 'SOCIAL_DYNAMICS_UPDATE',
            timestamp: Date.now(),
            payload
          });
        },

        reset: () => {
          get().dispatch({ type: 'RESET', timestamp: Date.now() });
        },

        hydrate: (state: Partial<KernelState>) => {
          get().dispatch({
            type: 'HYDRATE',
            timestamp: Date.now(),
            payload: { state }
          });
        },

        // ─────────────────────────────────────────────────────────────────────
        // SELECTORS (for atomic re-renders with subscribeWithSelector)
        // ─────────────────────────────────────────────────────────────────────
        getLimbic: () => get().limbic,
        getSoma: () => get().soma,
        getNeuro: () => get().neuro,
        getGoalState: () => get().goalState,
        getTraitVector: () => get().traitVector,
        isAutonomous: () => get().autonomousMode,
        isSleeping: () => get().soma.isSleeping,
        getEnergy: () => get().soma.energy,
      };
    }),
    {
      name: 'ak-flow-cognitive-state',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        // Persist only personality traits (privacy-safe)
        traitVector: state.traitVector,
        // Do NOT persist: conversation (privacy), pendingOutputs, _engine
      }),
      onRehydrateStorage: () => (state) => {
        if (state?.traitVector) {
          console.log('[CognitiveStore] Hydrated traitVector from storage');
          // Hydrate kernel engine with persisted traits
          state._engine?.dispatch({
            type: 'HYDRATE',
            timestamp: Date.now(),
            payload: { state: { traitVector: state.traitVector } }
          });
        }
      }
    }
  )
);

// ═══════════════════════════════════════════════════════════════════════════
// ATOMIC SELECTORS (for minimal re-renders)
// ═══════════════════════════════════════════════════════════════════════════

// Usage: const limbic = useLimbic();
export const useLimbic = () => useCognitiveStore((s) => s.limbic);
export const useSoma = () => useCognitiveStore((s) => s.soma);
export const useNeuro = () => useCognitiveStore((s) => s.neuro);
export const useGoalState = () => useCognitiveStore((s) => s.goalState);
export const useTraitVector = () => useCognitiveStore((s) => s.traitVector);
export const useResonance = () => useCognitiveStore((s) => s.resonance);

// Boolean selectors
export const useIsAutonomous = () => useCognitiveStore((s) => s.autonomousMode);
export const useIsPoetic = () => useCognitiveStore((s) => s.poeticMode);
export const useIsSleeping = () => useCognitiveStore((s) => s.soma.isSleeping);
export const useIsChemistryEnabled = () => useCognitiveStore((s) => s.chemistryEnabled);

// Social Dynamics selectors (FAZA 6)
export const useSocialDynamics = () => useCognitiveStore((s) => s.socialDynamics);
export const useSocialCost = () => useCognitiveStore((s) => s.socialDynamics.socialCost);
export const useAutonomyBudget = () => useCognitiveStore((s) => s.socialDynamics.autonomyBudget);
export const useUserPresenceScore = () => useCognitiveStore((s) => s.socialDynamics.userPresenceScore);

// Numeric selectors
export const useEnergy = () => useCognitiveStore((s) => s.soma.energy);
export const useDopamine = () => useCognitiveStore((s) => s.neuro.dopamine);
export const useSerotonin = () => useCognitiveStore((s) => s.neuro.serotonin);
export const useFear = () => useCognitiveStore((s) => s.limbic.fear);
export const useCuriosity = () => useCognitiveStore((s) => s.limbic.curiosity);

// History selectors
export const useThoughtHistory = () => useCognitiveStore((s) => s.thoughtHistory);
export const useConversation = () => useCognitiveStore((s) => s.conversation);
export const usePendingOutputs = () => useCognitiveStore((s) => s.pendingOutputs);

// Actions (stable references)
export const useCognitiveActions = () => useCognitiveStore(useShallow((s) => ({
  dispatch: s.dispatch,
  tick: s.tick,
  processUserInput: s.processUserInput,
  toggleAutonomousMode: s.toggleAutonomousMode,
  togglePoeticMode: s.togglePoeticMode,
  triggerSleep: s.triggerSleep,
  wake: s.wake,
  applyMoodShift: s.applyMoodShift,
  updateNeuro: s.updateNeuro,
  formGoal: s.formGoal,
  completeGoal: s.completeGoal,
  setWorkingSet: s.setWorkingSet,
  advanceWorkingSet: s.advanceWorkingSet,
  clearWorkingSet: s.clearWorkingSet,
  addThought: s.addThought,
  addMessage: s.addMessage,
  clearConversation: s.clearConversation,
  updateSocialDynamics: s.updateSocialDynamics,
  reset: s.reset,
  hydrate: s.hydrate,
})));

// ═══════════════════════════════════════════════════════════════════════════
// NON-REACT ACCESS (for services, tests, CLI)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get current state without React hook
 * Useful for services, tests, CLI
 */
export const getCognitiveState = () => useCognitiveStore.getState();

/**
 * Dispatch event without React hook
 */
export const dispatchCognitiveEvent = (event: KernelEvent) => {
  useCognitiveStore.getState().dispatch(event);
};

/**
 * Subscribe to state changes outside React
 */
export const subscribeToCognitive = (
  selector: (state: CognitiveStoreState) => unknown,
  callback: (value: unknown) => void
) => {
  return useCognitiveStore.subscribe(selector, callback);
};
