/**
 * SocialDynamics Integration Tests
 * 
 * Tests for soft homeostasis mechanism that regulates autonomous speech.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { kernelReducer } from '../../core/kernel/reducer';
import { createInitialKernelState, INITIAL_SOCIAL_DYNAMICS } from '../../core/kernel/initialState';
import { KernelState, KernelEvent, SocialDynamics } from '../../core/kernel/types';

describe('SocialDynamics', () => {
  let initialState: KernelState;

  beforeEach(() => {
    initialState = createInitialKernelState();
  });

  describe('Initial State', () => {
    it('should have correct initial values', () => {
      expect(initialState.socialDynamics).toEqual(INITIAL_SOCIAL_DYNAMICS);
      expect(initialState.socialDynamics.socialCost).toBe(0.05);
      expect(initialState.socialDynamics.autonomyBudget).toBe(1);
      expect(initialState.socialDynamics.userPresenceScore).toBe(0.5); // Neutral at start
      expect(initialState.socialDynamics.consecutiveWithoutResponse).toBe(0);
    });
  });

  describe('Agent Spoke', () => {
    it('should increase socialCost when agent speaks', () => {
      const event: KernelEvent = {
        type: 'SOCIAL_DYNAMICS_UPDATE',
        timestamp: Date.now(),
        payload: { agentSpoke: true }
      };

      const { nextState } = kernelReducer(initialState, event);

      expect(nextState.socialDynamics.socialCost).toBeGreaterThan(0);
      expect(nextState.socialDynamics.consecutiveWithoutResponse).toBe(1);
    });

    it('should decrease autonomyBudget when agent speaks', () => {
      const event: KernelEvent = {
        type: 'SOCIAL_DYNAMICS_UPDATE',
        timestamp: Date.now(),
        payload: { agentSpoke: true }
      };

      const { nextState } = kernelReducer(initialState, event);

      expect(nextState.socialDynamics.autonomyBudget).toBe(0.8); // 1 - 0.2
    });

    it('should escalate socialCost with consecutive speeches', () => {
      let state = initialState;

      // Agent speaks 3 times without user response
      for (let i = 0; i < 3; i++) {
        const event: KernelEvent = {
          type: 'SOCIAL_DYNAMICS_UPDATE',
          timestamp: Date.now(),
          payload: { agentSpoke: true }
        };
        const { nextState } = kernelReducer(state, event);
        state = nextState;
      }

      // Cost should escalate: 0.15*1 + 0.15*2 + 0.15*3 = 0.9
      expect(state.socialDynamics.socialCost).toBeCloseTo(0.9, 1);
      expect(state.socialDynamics.consecutiveWithoutResponse).toBe(3);
    });

    it('should clamp socialCost to max 1', () => {
      let state = initialState;

      // Agent speaks many times
      for (let i = 0; i < 10; i++) {
        const event: KernelEvent = {
          type: 'SOCIAL_DYNAMICS_UPDATE',
          timestamp: Date.now(),
          payload: { agentSpoke: true }
        };
        const { nextState } = kernelReducer(state, event);
        state = nextState;
      }

      expect(state.socialDynamics.socialCost).toBeLessThanOrEqual(1);
    });

    it('should clamp autonomyBudget to min 0', () => {
      let state = initialState;

      // Agent speaks many times
      for (let i = 0; i < 10; i++) {
        const event: KernelEvent = {
          type: 'SOCIAL_DYNAMICS_UPDATE',
          timestamp: Date.now(),
          payload: { agentSpoke: true }
        };
        const { nextState } = kernelReducer(state, event);
        state = nextState;
      }

      expect(state.socialDynamics.autonomyBudget).toBeGreaterThanOrEqual(0);
    });
  });

  describe('User Responded', () => {
    it('should reset consecutiveWithoutResponse when user responds', () => {
      // First, agent speaks 3 times
      let state = initialState;
      for (let i = 0; i < 3; i++) {
        const event: KernelEvent = {
          type: 'SOCIAL_DYNAMICS_UPDATE',
          timestamp: Date.now(),
          payload: { agentSpoke: true }
        };
        const { nextState } = kernelReducer(state, event);
        state = nextState;
      }

      expect(state.socialDynamics.consecutiveWithoutResponse).toBe(3);

      // User responds
      const userEvent: KernelEvent = {
        type: 'SOCIAL_DYNAMICS_UPDATE',
        timestamp: Date.now(),
        payload: { userResponded: true }
      };
      const { nextState } = kernelReducer(state, userEvent);

      expect(nextState.socialDynamics.consecutiveWithoutResponse).toBe(0);
    });

    it('should halve socialCost when user responds (ulga)', () => {
      // Agent speaks to build up cost
      let state = initialState;
      const agentEvent: KernelEvent = {
        type: 'SOCIAL_DYNAMICS_UPDATE',
        timestamp: Date.now(),
        payload: { agentSpoke: true }
      };
      const { nextState: stateAfterSpeak } = kernelReducer(state, agentEvent);
      const costBeforeResponse = stateAfterSpeak.socialDynamics.socialCost;

      // User responds
      const userEvent: KernelEvent = {
        type: 'SOCIAL_DYNAMICS_UPDATE',
        timestamp: Date.now(),
        payload: { userResponded: true }
      };
      const { nextState } = kernelReducer(stateAfterSpeak, userEvent);

      expect(nextState.socialDynamics.socialCost).toBeCloseTo(costBeforeResponse * 0.5, 2);
    });

    it('should restore userPresenceScore to 1 when user responds', () => {
      // Simulate silence decay
      let state = { 
        ...initialState, 
        socialDynamics: { 
          ...initialState.socialDynamics, 
          userPresenceScore: 0.3 
        } 
      };

      const userEvent: KernelEvent = {
        type: 'SOCIAL_DYNAMICS_UPDATE',
        timestamp: Date.now(),
        payload: { userResponded: true }
      };
      const { nextState } = kernelReducer(state, userEvent);

      expect(nextState.socialDynamics.userPresenceScore).toBe(1);
    });

    it('should boost autonomyBudget when user responds', () => {
      // Deplete budget first
      let state = { 
        ...initialState, 
        socialDynamics: { 
          ...initialState.socialDynamics, 
          autonomyBudget: 0.5 
        } 
      };

      const userEvent: KernelEvent = {
        type: 'SOCIAL_DYNAMICS_UPDATE',
        timestamp: Date.now(),
        payload: { userResponded: true }
      };
      const { nextState } = kernelReducer(state, userEvent);

      expect(nextState.socialDynamics.autonomyBudget).toBe(0.8); // 0.5 + 0.3
    });
  });

  describe('Time-based Decay (TICK)', () => {
    it('should decay socialCost over time towards baseline', () => {
      const now = Date.now();
      const state = {
        ...initialState,
        autonomousMode: true,
        lastUserInteractionAt: now,
        socialDynamics: {
          ...initialState.socialDynamics,
          socialCost: 0.5,
          userPresenceScore: 1.0
        }
      };

      const tick: KernelEvent = {
        type: 'TICK',
        timestamp: now + 1000,
        payload: {}
      };
      const { nextState } = kernelReducer(state, tick);

      expect(nextState.socialDynamics.socialCost).toBeLessThan(0.5);
      expect(nextState.socialDynamics.socialCost).toBeGreaterThanOrEqual(0.05);
    });

    it('should decay userPresenceScore based on lastUserInteractionAt', () => {
      const now = Date.now();
      const fiveMinutesMs = 5 * 60 * 1000;
      const state = {
        ...initialState,
        autonomousMode: true,
        lastUserInteractionAt: now,
      };

      const tick: KernelEvent = {
        type: 'TICK',
        timestamp: now + fiveMinutesMs,
        payload: {}
      };
      const { nextState } = kernelReducer(state, tick);

      // 5 min silence → ~0.5 presence (10 min to reach 0)
      expect(nextState.socialDynamics.userPresenceScore).toBeCloseTo(0.5, 1);
    });
  });

  describe('Integration: Full Conversation Cycle', () => {
    it('should model realistic conversation dynamics', () => {
      let state = initialState;

      // 1. Agent speaks (initial)
      const speak1: KernelEvent = {
        type: 'SOCIAL_DYNAMICS_UPDATE',
        timestamp: Date.now(),
        payload: { agentSpoke: true }
      };
      state = kernelReducer(state, speak1).nextState;
      // Baseline is 0.05, so first speech adds +0.15 => 0.20
      expect(state.socialDynamics.socialCost).toBeCloseTo(0.20, 2);

      // 2. Agent speaks again (cost escalates)
      const speak2: KernelEvent = {
        type: 'SOCIAL_DYNAMICS_UPDATE',
        timestamp: Date.now(),
        payload: { agentSpoke: true }
      };
      state = kernelReducer(state, speak2).nextState;
      // Previous 0.20 + (0.15 * 2) => 0.50
      expect(state.socialDynamics.socialCost).toBeCloseTo(0.50, 2);

      // 3. User responds (relief!)
      const userResponse: KernelEvent = {
        type: 'SOCIAL_DYNAMICS_UPDATE',
        timestamp: Date.now(),
        payload: { userResponded: true }
      };
      state = kernelReducer(state, userResponse).nextState;
      // Halved
      expect(state.socialDynamics.socialCost).toBeCloseTo(0.25, 2);
      expect(state.socialDynamics.consecutiveWithoutResponse).toBe(0);

      // 4. Time passes (decay)
      const costBeforeDecay = state.socialDynamics.socialCost;
      const tickDecay: KernelEvent = {
        type: 'TICK',
        timestamp: Date.now() + 60000,
        payload: {}
      };
      state = kernelReducer({ ...state, autonomousMode: true }, tickDecay).nextState;
      expect(state.socialDynamics.socialCost).toBeLessThan(costBeforeDecay);
    });
  });
});
