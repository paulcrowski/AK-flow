/**
 * @vitest-environment jsdom
 */
/**
 * useCognitiveKernelLite Tests
 * 
 * Tests for the thin React wrapper over Zustand store.
 * 
 * @module __tests__/hooks/useCognitiveKernelLite.test.ts
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCognitiveKernelLite } from '@/hooks/useCognitiveKernelLite';
import { useCognitiveStore } from '@/stores/cognitiveStore';
import { KernelController } from '@core/runner/KernelController';

// Mock CortexSystem to avoid API calls
vi.mock('@core/systems/CortexSystem', () => ({
  CortexSystem: {
    processUserMessage: vi.fn().mockResolvedValue({
      responseText: 'Test response',
      internalThought: 'Test thought',
      moodShift: { fear_delta: 0.1, curiosity_delta: 0.2 }
    })
  }
}));

// Mock DreamConsolidationService
vi.mock('@services/DreamConsolidationService', () => ({
  DreamConsolidationService: {
    consolidate: vi.fn().mockResolvedValue({})
  }
}));

// Mock WakeService
vi.mock('@core/services/WakeService', () => ({
  executeWakeProcess: vi.fn().mockResolvedValue({})
}));

describe('useCognitiveKernelLite', () => {
  beforeEach(() => {
    // Reset store before each test
    useCognitiveStore.getState().reset();
    KernelController.reset();
    vi.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should return initial state', () => {
      const { result } = renderHook(() => useCognitiveKernelLite());

      expect(result.current.limbicState).toBeDefined();
      expect(result.current.somaState).toBeDefined();
      expect(result.current.neuroState).toBeDefined();
      expect(result.current.autonomousMode).toBe(false);
    });

    it('should use loaded identity if provided', () => {
      const identity = {
        id: 'test-agent',
        name: 'TestBot',
        trait_vector: { arousal: 0.5, verbosity: 0.5, conscientiousness: 0.5, socialAwareness: 0.5, curiosity: 0.5 },
        neurotransmitters: { dopamine: 50, serotonin: 50, norepinephrine: 50 },
        persona: 'A test agent'
      };

      const { result } = renderHook(() => useCognitiveKernelLite(identity));

      expect(result.current.agentName).toBe('TestBot');
    });
  });

  describe('Actions', () => {
    it('toggleAutonomy should toggle autonomous mode', () => {
      const { result } = renderHook(() => useCognitiveKernelLite());

      expect(result.current.autonomousMode).toBe(false);

      act(() => {
        result.current.toggleAutonomy();
      });

      expect(result.current.autonomousMode).toBe(true);
    });

    it('toggleSleep should toggle sleep state', () => {
      const { result } = renderHook(() => useCognitiveKernelLite());

      expect(result.current.somaState.isSleeping).toBe(false);

      act(() => {
        result.current.toggleSleep();
      });

      expect(result.current.somaState.isSleeping).toBe(true);
    });

    it('injectStateOverride should update state', () => {
      const { result } = renderHook(() => useCognitiveKernelLite());

      act(() => {
        result.current.injectStateOverride('limbic', 'fear', 0.8);
      });

      expect(result.current.limbicState.fear).toBe(0.8);
    });

    it('resetKernel should reset to initial state', () => {
      const { result } = renderHook(() => useCognitiveKernelLite());

      // Modify state
      act(() => {
        result.current.toggleAutonomy();
        result.current.injectStateOverride('limbic', 'fear', 0.9);
      });

      expect(result.current.autonomousMode).toBe(true);

      // Reset
      act(() => {
        result.current.resetKernel();
      });

      expect(result.current.autonomousMode).toBe(false);
      expect(result.current.conversation).toEqual([]);
    });
  });

  describe('UI State', () => {
    it('should have conversation state', () => {
      const { result } = renderHook(() => useCognitiveKernelLite());

      expect(result.current.conversation).toEqual([]);
      expect(result.current.isProcessing).toBe(false);
      expect(result.current.currentThought).toBeDefined();
    });

    it('should have error state', () => {
      const { result } = renderHook(() => useCognitiveKernelLite());

      expect(result.current.systemError).toBeNull();
    });
  });

  describe('API Compatibility', () => {
    it('should expose same API as legacy useCognitiveKernel', () => {
      const { result } = renderHook(() => useCognitiveKernelLite());

      // State
      expect(result.current).toHaveProperty('limbicState');
      expect(result.current).toHaveProperty('somaState');
      expect(result.current).toHaveProperty('resonanceField');
      expect(result.current).toHaveProperty('neuroState');
      expect(result.current).toHaveProperty('traitVector');
      expect(result.current).toHaveProperty('goalState');
      expect(result.current).toHaveProperty('autonomousMode');
      expect(result.current).toHaveProperty('chemistryEnabled');
      expect(result.current).toHaveProperty('agentName');
      expect(result.current).toHaveProperty('agentPersona');
      expect(result.current).toHaveProperty('conversation');
      expect(result.current).toHaveProperty('isProcessing');
      expect(result.current).toHaveProperty('currentThought');
      expect(result.current).toHaveProperty('systemError');

      // Actions
      expect(result.current).toHaveProperty('setAutonomousMode');
      expect(result.current).toHaveProperty('toggleAutonomy');
      expect(result.current).toHaveProperty('toggleSleep');
      expect(result.current).toHaveProperty('toggleChemistry');
      expect(result.current).toHaveProperty('injectStateOverride');
      expect(result.current).toHaveProperty('resetKernel');
      expect(result.current).toHaveProperty('retryLastAction');
      expect(result.current).toHaveProperty('handleInput');
    });
  });
});
