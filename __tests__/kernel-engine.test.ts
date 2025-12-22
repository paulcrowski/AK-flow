/**
 * KernelEngine Tests
 * 
 * Testy pure state machine bez React.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  KernelEngine, 
  createKernelEngine,
  createInitialKernelState,
  INITIAL_LIMBIC,
  INITIAL_SOMA,
  INITIAL_NEURO
} from '@core/kernel';

describe('KernelEngine', () => {
  let engine: KernelEngine;
  
  beforeEach(() => {
    engine = createKernelEngine();
  });
  
  describe('Initialization', () => {
    it('should create with default initial state', () => {
      const state = engine.getState();
      
      expect(state.limbic).toEqual(INITIAL_LIMBIC);
      expect(state.soma).toEqual(INITIAL_SOMA);
      expect(state.neuro).toEqual(INITIAL_NEURO);
      expect(state.autonomousMode).toBe(false);
      expect(state.poeticMode).toBe(false);
      expect(state.chemistryEnabled).toBe(true);
    });
    
    it('should accept partial initial state overrides', () => {
      const customEngine = createKernelEngine({
        autonomousMode: true,
        poeticMode: true
      });
      
      const state = customEngine.getState();
      expect(state.autonomousMode).toBe(true);
      expect(state.poeticMode).toBe(true);
      // Rest should be defaults
      expect(state.limbic).toEqual(INITIAL_LIMBIC);
    });
  });
  
  describe('Event Dispatching', () => {
    it('should handle USER_INPUT event', () => {
      const outputs = engine.userInput('Hello world');
      const state = engine.getState();
      
      expect(state.consecutiveAgentSpeeches).toBe(0);
      expect(state.ticksSinceLastReward).toBe(0);
    });
    
    it('should handle AGENT_SPOKE event', () => {
      engine.agentSpoke('Test speech', 0.8);
      const state = engine.getState();
      
      expect(state.consecutiveAgentSpeeches).toBe(1);
      expect(state.thoughtHistory).toContain('Test speech');
    });
    
    it('should increment consecutiveAgentSpeeches on multiple speaks', () => {
      engine.agentSpoke('First');
      engine.agentSpoke('Second');
      engine.agentSpoke('Third');
      
      const state = engine.getState();
      expect(state.consecutiveAgentSpeeches).toBe(3);
    });
    
    it('should reset consecutiveAgentSpeeches on user input', () => {
      engine.agentSpoke('First');
      engine.agentSpoke('Second');
      engine.userInput('User speaks');
      
      const state = engine.getState();
      expect(state.consecutiveAgentSpeeches).toBe(0);
    });
    
    it('should handle TOOL_RESULT event (reset RPE counter)', () => {
      // Simulate some ticks to increase counter
      engine.emit('TOGGLE_AUTONOMY'); // Enable autonomy first
      
      const customEngine = createKernelEngine({ ticksSinceLastReward: 5 });
      customEngine.toolResult('SEARCH', true);
      
      const state = customEngine.getState();
      expect(state.ticksSinceLastReward).toBe(0);
    });
  });
  
  describe('Mode Toggles', () => {
    it('should toggle autonomy mode', () => {
      expect(engine.getState().autonomousMode).toBe(false);
      
      engine.toggleAutonomy();
      expect(engine.getState().autonomousMode).toBe(true);
      
      engine.toggleAutonomy();
      expect(engine.getState().autonomousMode).toBe(false);
    });
    
    it('should toggle chemistry mode', () => {
      expect(engine.getState().chemistryEnabled).toBe(true);
      
      engine.toggleChemistry();
      expect(engine.getState().chemistryEnabled).toBe(false);
      
      engine.toggleChemistry();
      expect(engine.getState().chemistryEnabled).toBe(true);
    });
    
    it('should toggle poetic mode', () => {
      expect(engine.getState().poeticMode).toBe(false);
      
      engine.togglePoetic();
      expect(engine.getState().poeticMode).toBe(true);
    });
    
    it('should set poetic mode based on detected style in user input', () => {
      engine.userInput('Write me a poem', 'POETIC');
      expect(engine.getState().poeticMode).toBe(true);
      
      engine.userInput('Just facts please', 'SIMPLE');
      expect(engine.getState().poeticMode).toBe(false);
    });
  });
  
  describe('State Override', () => {
    it('should override limbic values with clamping', () => {
      engine.stateOverride('limbic', 'fear', 0.9);
      expect(engine.getState().limbic.fear).toBe(0.9);
      
      // Test clamping
      engine.stateOverride('limbic', 'fear', 1.5);
      expect(engine.getState().limbic.fear).toBe(1);
      
      engine.stateOverride('limbic', 'fear', -0.5);
      expect(engine.getState().limbic.fear).toBe(0);
    });
    
    it('should override soma values with clamping', () => {
      engine.stateOverride('soma', 'energy', 50);
      expect(engine.getState().soma.energy).toBe(50);
      
      // Test clamping
      engine.stateOverride('soma', 'energy', 150);
      expect(engine.getState().soma.energy).toBe(100);
    });
    
    it('should override neuro values with clamping', () => {
      engine.stateOverride('neuro', 'dopamine', 80);
      expect(engine.getState().neuro.dopamine).toBe(80);
    });
  });
  
  describe('Neuro Updates', () => {
    it('should apply neuro delta with clamping', () => {
      engine.neuroUpdate({ dopamine: 20 }, 'Test boost');
      expect(engine.getState().neuro.dopamine).toBe(75); // 55 + 20
      
      engine.neuroUpdate({ dopamine: 50 }); // Should clamp to 100
      expect(engine.getState().neuro.dopamine).toBe(100);
      
      engine.neuroUpdate({ dopamine: -150 }); // Should clamp to 0
      expect(engine.getState().neuro.dopamine).toBe(0);
    });
  });
  
  describe('Sleep Cycle', () => {
    it('should handle SLEEP_START event', () => {
      engine.sleepStart();
      const state = engine.getState();
      
      expect(state.soma.isSleeping).toBe(true);
      // Neuro should reset to baseline
      expect(state.neuro.dopamine).toBe(55);
      expect(state.neuro.serotonin).toBe(60);
      expect(state.neuro.norepinephrine).toBe(50);
    });
    
    it('should handle SLEEP_END event', () => {
      engine.sleepStart();
      engine.sleepEnd();
      
      const state = engine.getState();
      expect(state.soma.isSleeping).toBe(false);
    });
    
    it('should return WAKE_PROCESS output on sleep end', () => {
      engine.sleepStart();
      const outputs = engine.sleepEnd();
      
      const wakeOutput = outputs.find(o => o.type === 'WAKE_PROCESS');
      expect(wakeOutput).toBeDefined();
    });
  });
  
  describe('Reset', () => {
    it('should reset to initial state but preserve traitVector', () => {
      // Modify state
      engine.stateOverride('limbic', 'fear', 0.9);
      engine.stateOverride('soma', 'energy', 30);
      engine.agentSpoke('Test');
      
      // Modify trait vector
      const customTraits = { ...engine.getState().traitVector, curiosity: 0.9 };
      const customEngine = createKernelEngine({ traitVector: customTraits });
      customEngine.stateOverride('limbic', 'fear', 0.9);
      customEngine.reset();
      
      const state = customEngine.getState();
      expect(state.limbic.fear).toBe(INITIAL_LIMBIC.fear);
      expect(state.traitVector.curiosity).toBe(0.9); // Preserved
    });
  });
  
  describe('Subscriptions', () => {
    it('should notify listeners on state change', () => {
      const listener = vi.fn();
      engine.subscribe(listener);
      
      engine.toggleAutonomy();
      
      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ autonomousMode: true }),
        expect.any(Array)
      );
    });
    
    it('should allow unsubscribing', () => {
      const listener = vi.fn();
      const unsubscribe = engine.subscribe(listener);
      
      engine.toggleAutonomy();
      expect(listener).toHaveBeenCalledTimes(1);
      
      unsubscribe();
      engine.toggleAutonomy();
      expect(listener).toHaveBeenCalledTimes(1); // No additional call
    });
    
    it('should handle listener errors gracefully', () => {
      const errorListener = vi.fn(() => { throw new Error('Listener error'); });
      const goodListener = vi.fn();
      
      engine.subscribe(errorListener);
      engine.subscribe(goodListener);
      
      // Should not throw, and good listener should still be called
      expect(() => engine.toggleAutonomy()).not.toThrow();
      expect(goodListener).toHaveBeenCalled();
    });
  });
  
  describe('Event History', () => {
    it('should store event history', () => {
      engine.toggleAutonomy();
      engine.userInput('Test');
      engine.agentSpoke('Response');
      
      const history = engine.getEventHistory();
      expect(history.length).toBe(3);
      expect(history[0].type).toBe('TOGGLE_AUTONOMY');
      expect(history[1].type).toBe('USER_INPUT');
      expect(history[2].type).toBe('AGENT_SPOKE');
    });
    
    it('should limit history size', () => {
      // Create engine and dispatch more than maxHistorySize events
      for (let i = 0; i < 150; i++) {
        engine.togglePoetic();
      }
      
      const history = engine.getEventHistory();
      expect(history.length).toBe(100); // Max history size
    });
  });
  
  describe('Thought History', () => {
    it('should limit thought history to 20 entries', () => {
      for (let i = 0; i < 25; i++) {
        engine.agentSpoke(`Thought ${i}`);
      }
      
      const state = engine.getState();
      expect(state.thoughtHistory.length).toBe(20);
      expect(state.thoughtHistory[0]).toBe('Thought 5'); // First 5 were shifted out
      expect(state.thoughtHistory[19]).toBe('Thought 24');
    });
  });
  
  describe('Outputs', () => {
    it('should return EVENT_BUS_PUBLISH outputs for agent speech', () => {
      const outputs = engine.agentSpoke('Test');
      
      const publishOutput = outputs.find(o => o.type === 'EVENT_BUS_PUBLISH');
      expect(publishOutput).toBeDefined();
      expect(publishOutput?.payload.payload.speech_content).toBe('Test');
    });
    
    it('should return LOG outputs for relevant events', () => {
      const outputs = engine.neuroUpdate({ dopamine: 10 }, 'Reward');
      
      const logOutput = outputs.find(o => o.type === 'LOG');
      expect(logOutput).toBeDefined();
    });
    
    it('should return DREAM_CONSOLIDATION output on sleep start', () => {
      const outputs = engine.sleepStart();
      
      const dreamOutput = outputs.find(o => o.type === 'DREAM_CONSOLIDATION');
      expect(dreamOutput).toBeDefined();
    });
  });
  
  describe('Select', () => {
    it('should return specific state slice', () => {
      expect(engine.select('autonomousMode')).toBe(false);
      expect(engine.select('limbic')).toEqual(INITIAL_LIMBIC);
    });
  });
  
  describe('Hydrate', () => {
    it('should force set state from external source', () => {
      const customState = createInitialKernelState({
        autonomousMode: true,
        poeticMode: true,
        limbic: { fear: 0.5, curiosity: 0.5, frustration: 0.5, satisfaction: 0.5 }
      });
      
      engine.hydrate(customState);
      
      const state = engine.getState();
      expect(state.autonomousMode).toBe(true);
      expect(state.poeticMode).toBe(true);
      expect(state.limbic.fear).toBe(0.5);
    });
    
    it('should notify listeners after hydration', () => {
      const listener = vi.fn();
      engine.subscribe(listener);
      
      const customState = createInitialKernelState({ autonomousMode: true });
      engine.hydrate(customState);
      
      expect(listener).toHaveBeenCalled();
    });
  });
});
