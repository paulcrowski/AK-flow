/**
 * CognitiveStore Tests
 * 
 * Tests for Zustand store adapter to KernelEngine.
 * 
 * @module __tests__/stores/cognitiveStore.test.ts
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { 
  useCognitiveStore, 
  getCognitiveState,
  dispatchCognitiveEvent 
} from '../../stores/cognitiveStore';

describe('CognitiveStore', () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    useCognitiveStore.getState().reset();
  });

  describe('Initialization', () => {
    it('should have initial state from KernelEngine', () => {
      const state = getCognitiveState();
      
      expect(state.limbic).toBeDefined();
      expect(state.soma).toBeDefined();
      expect(state.neuro).toBeDefined();
      expect(state.autonomousMode).toBe(false);
      expect(state.poeticMode).toBe(false);
    });

    it('should have _engine instance', () => {
      const state = getCognitiveState();
      expect(state._engine).toBeDefined();
    });
  });

  describe('Actions', () => {
    it('tick() should update state via TICK event', () => {
      const { tick } = useCognitiveStore.getState();
      const initialEnergy = getCognitiveState().soma.energy;
      
      tick();
      
      // Energy should decrease slightly after tick (metabolism)
      const newEnergy = getCognitiveState().soma.energy;
      expect(newEnergy).toBeLessThanOrEqual(initialEnergy);
    });

    it('processUserInput() should reset silence tracking', () => {
      const { processUserInput } = useCognitiveStore.getState();
      
      processUserInput('Hello');
      
      const state = getCognitiveState();
      expect(state.consecutiveAgentSpeeches).toBe(0);
    });

    it('toggleAutonomousMode() should toggle autonomy', () => {
      const { toggleAutonomousMode } = useCognitiveStore.getState();
      
      expect(getCognitiveState().autonomousMode).toBe(false);
      
      toggleAutonomousMode(true);
      expect(getCognitiveState().autonomousMode).toBe(true);
      
      toggleAutonomousMode(false);
      expect(getCognitiveState().autonomousMode).toBe(false);
    });

    it('togglePoeticMode() should toggle poetic mode', () => {
      const { togglePoeticMode } = useCognitiveStore.getState();
      
      togglePoeticMode(true);
      expect(getCognitiveState().poeticMode).toBe(true);
    });

    it('triggerSleep() should set isSleeping', () => {
      const { triggerSleep } = useCognitiveStore.getState();
      
      triggerSleep();
      
      expect(getCognitiveState().soma.isSleeping).toBe(true);
    });

    it('wake() should clear isSleeping', () => {
      const { triggerSleep, wake } = useCognitiveStore.getState();
      
      triggerSleep();
      expect(getCognitiveState().soma.isSleeping).toBe(true);
      
      wake();
      expect(getCognitiveState().soma.isSleeping).toBe(false);
    });

    it('applyMoodShift() should update limbic', () => {
      const { applyMoodShift } = useCognitiveStore.getState();
      const initialFear = getCognitiveState().limbic.fear;
      
      applyMoodShift({ fear_delta: 0.2 });
      
      expect(getCognitiveState().limbic.fear).toBeGreaterThan(initialFear);
    });

    it('updateNeuro() should update neurotransmitters with delta', () => {
      const { updateNeuro } = useCognitiveStore.getState();
      const initialDopamine = getCognitiveState().neuro.dopamine;
      
      // NEURO_UPDATE uses delta values, not absolute
      updateNeuro({ dopamine: 10 }); // Add 10 to current
      
      expect(getCognitiveState().neuro.dopamine).toBe(Math.min(100, initialDopamine + 10));
    });

    it('formGoal() should set active goal', () => {
      const { formGoal } = useCognitiveStore.getState();
      
      formGoal('Test goal', 0.8);
      
      const state = getCognitiveState();
      expect(state.goalState.activeGoal).not.toBeNull();
      expect(state.goalState.activeGoal?.description).toBe('Test goal');
    });

    it('completeGoal() should clear active goal', () => {
      const { formGoal, completeGoal } = useCognitiveStore.getState();
      
      formGoal('Test goal', 0.8);
      expect(getCognitiveState().goalState.activeGoal).not.toBeNull();
      
      completeGoal();
      expect(getCognitiveState().goalState.activeGoal).toBeNull();
    });

    it('addThought() should add to thought history', () => {
      const { addThought } = useCognitiveStore.getState();
      
      addThought('First thought');
      addThought('Second thought');
      
      const history = getCognitiveState().thoughtHistory;
      expect(history).toContain('First thought');
      expect(history).toContain('Second thought');
    });

    it('reset() should restore initial state', () => {
      const { toggleAutonomousMode, formGoal, reset } = useCognitiveStore.getState();
      
      toggleAutonomousMode(true);
      formGoal('Test', 0.5);
      
      reset();
      
      const state = getCognitiveState();
      expect(state.autonomousMode).toBe(false);
      expect(state.goalState.activeGoal).toBeNull();
    });

    it('hydrate() should merge external state', () => {
      const { hydrate } = useCognitiveStore.getState();
      
      hydrate({
        autonomousMode: true,
        limbic: { fear: 0.9, curiosity: 0.1, frustration: 0.5, satisfaction: 0.3 }
      });
      
      const state = getCognitiveState();
      expect(state.autonomousMode).toBe(true);
      expect(state.limbic.fear).toBe(0.9);
    });
  });

  describe('Selectors', () => {
    it('getLimbic() should return limbic state', () => {
      const state = getCognitiveState();
      const limbic = state.getLimbic();
      
      expect(limbic).toEqual(state.limbic);
    });

    it('getSoma() should return soma state', () => {
      const state = getCognitiveState();
      const soma = state.getSoma();
      
      expect(soma).toEqual(state.soma);
    });

    it('getEnergy() should return energy value', () => {
      const state = getCognitiveState();
      const energy = state.getEnergy();
      
      expect(energy).toBe(state.soma.energy);
    });

    it('isAutonomous() should return autonomy mode', () => {
      const { toggleAutonomousMode } = useCognitiveStore.getState();
      
      expect(getCognitiveState().isAutonomous()).toBe(false);
      
      toggleAutonomousMode(true);
      expect(getCognitiveState().isAutonomous()).toBe(true);
    });

    it('isSleeping() should return sleep state', () => {
      const { triggerSleep } = useCognitiveStore.getState();
      
      expect(getCognitiveState().isSleeping()).toBe(false);
      
      triggerSleep();
      expect(getCognitiveState().isSleeping()).toBe(true);
    });
  });

  describe('Non-React API', () => {
    it('dispatchCognitiveEvent() should work outside React', () => {
      dispatchCognitiveEvent({
        type: 'TOGGLE_AUTONOMY',
        timestamp: Date.now(),
        payload: { enabled: true }
      });
      
      expect(getCognitiveState().autonomousMode).toBe(true);
    });
  });

  describe('Pending Outputs', () => {
    it('should capture outputs from dispatch', () => {
      const { triggerSleep } = useCognitiveStore.getState();
      
      triggerSleep();
      
      const outputs = getCognitiveState().pendingOutputs;
      expect(outputs.length).toBeGreaterThan(0);
    });
  });
});
