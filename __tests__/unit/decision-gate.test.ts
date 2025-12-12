/**
 * Decision Gate Tests - Architektura 3-warstwowa
 * 
 * Testuje separację: Myśl → Decyzja → Akcja
 * Zgodne z: Kora przedczołowa → Jądra podstawy → Kora ruchowa
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  processDecisionGate,
  resetTurnState,
  resetFullState,
  DEFAULT_POLICY
} from '../../core/systems/DecisionGate';
import type { CortexOutput } from '../../core/types/CortexOutput';
import type { SomaState } from '../../types';

// Mock SomaState
const createSomaState = (energy: number = 80): SomaState => ({
  energy,
  cognitiveLoad: 20,
  isSleeping: false
});

// Mock CortexOutput
const createOutput = (overrides: Partial<CortexOutput> = {}): CortexOutput => ({
  internal_thought: 'I am thinking about the user question.',
  speech_content: 'Here is my response.',
  mood_shift: { energy_delta: 0, confidence_delta: 0, stress_delta: 0 },
  ...overrides
});

describe('Decision Gate - 3-Layer Architecture', () => {
  beforeEach(() => {
    resetFullState();  // Pełny reset włącznie z cooldownami
  });

  describe('Cognitive Violation Detection', () => {
    it('should detect SEARCH tag in internal_thought', () => {
      const output = createOutput({
        internal_thought: 'I need data. [SEARCH: quantum physics]'
      });

      const result = processDecisionGate(output, createSomaState());

      expect(result.telemetry.violation).toBeDefined();
      expect(result.telemetry.violation).toContain('SEARCH');
      expect(result.modifiedOutput.internal_thought).toContain('[INTENT_REMOVED]');
    });

    it('should detect VISUALIZE tag in internal_thought', () => {
      const output = createOutput({
        internal_thought: 'Let me imagine this. [VISUALIZE: sunset]'
      });

      const result = processDecisionGate(output, createSomaState());

      expect(result.telemetry.violation).toBeDefined();
      expect(result.telemetry.violation).toContain('VISUALIZE');
    });

    it('should NOT flag clean thoughts', () => {
      const output = createOutput({
        internal_thought: 'I should search for more data about this topic.'
      });

      const result = processDecisionGate(output, createSomaState());

      expect(result.telemetry.violation).toBeUndefined();
      expect(result.approved).toBe(true);
    });
  });

  describe('Tool Intent Processing', () => {
    it('should detect and execute tool_intent', () => {
      const output = createOutput({
        internal_thought: 'I need more information about quantum physics.',
        tool_intent: {
          tool: 'SEARCH',
          query: 'quantum physics basics',
          reason: 'User asked about quantum mechanics'
        },
        speech_content: 'Let me check that for you.'
      });

      const result = processDecisionGate(output, createSomaState());

      expect(result.telemetry.intentDetected).toBe(true);
      expect(result.telemetry.intentExecuted).toBe(true);
      expect(result.modifiedOutput.speech_content).toContain('[SEARCH:');
    });

    it('should redirect intent to speech if tag missing', () => {
      const output = createOutput({
        internal_thought: 'I want to visualize this concept.',
        tool_intent: {
          tool: 'VISUALIZE',
          query: 'neural network diagram',
          reason: 'Visual explanation would help'
        },
        speech_content: 'I can show you this.'
      });

      const result = processDecisionGate(output, createSomaState());

      expect(result.modifiedOutput.speech_content).toContain('[VISUALIZE:');
      expect(result.modifiedOutput.speech_content).toContain('neural network diagram');
    });

    it('should NOT duplicate tag if already in speech', () => {
      const output = createOutput({
        internal_thought: 'Searching for data.',
        tool_intent: {
          tool: 'SEARCH',
          query: 'AI history',
          reason: 'Need facts'
        },
        speech_content: 'Let me search. [SEARCH: AI history]'
      });

      const result = processDecisionGate(output, createSomaState());

      // Count occurrences of [SEARCH:
      const matches = result.modifiedOutput.speech_content.match(/\[SEARCH:/g);
      expect(matches?.length).toBe(1);
    });
  });

  describe('Policy Enforcement', () => {
    it('should block SEARCH when energy too low', () => {
      const output = createOutput({
        tool_intent: {
          tool: 'SEARCH',
          query: 'test',
          reason: 'test'
        }
      });

      const lowEnergySoma = createSomaState(5); // Below minEnergyForSearch
      const result = processDecisionGate(output, lowEnergySoma);

      expect(result.telemetry.intentDetected).toBe(true);
      expect(result.telemetry.intentExecuted).toBe(false);
    });

    it('should block VISUALIZE when energy too low', () => {
      const output = createOutput({
        tool_intent: {
          tool: 'VISUALIZE',
          query: 'test image',
          reason: 'test'
        }
      });

      const lowEnergySoma = createSomaState(20); // Below minEnergyForVisualize (25)
      const result = processDecisionGate(output, lowEnergySoma);

      expect(result.telemetry.intentDetected).toBe(true);
      expect(result.telemetry.intentExecuted).toBe(false);
    });

    it('should respect max tools per turn', () => {
      // Używamy różnych narzędzi żeby uniknąć cooldownu
      const output1 = createOutput({
        tool_intent: { tool: 'SEARCH', query: 'first', reason: 'test' }
      });
      const output2 = createOutput({
        tool_intent: { tool: 'VISUALIZE', query: 'second', reason: 'test' }
      });

      const soma = createSomaState(80);

      // First should succeed
      const result1 = processDecisionGate(output1, soma);
      expect(result1.telemetry.intentExecuted).toBe(true);

      // Second should be blocked (max 1 per turn by default)
      const result2 = processDecisionGate(output2, soma);
      expect(result2.telemetry.intentExecuted).toBe(false);
    });
  });

  describe('INTENT_NOT_EXECUTED Telemetry', () => {
    it('should detect implicit intent without tool_intent', () => {
      // This test verifies the telemetry is published via eventBus
      // We can't easily test eventBus here, but we verify the logic path
      const output = createOutput({
        internal_thought: 'I should search for more information about this.',
        speech_content: 'I think the answer is...'
        // No tool_intent, no tool tag in speech
      });

      const result = processDecisionGate(output, createSomaState());

      // The function should complete without error
      expect(result.approved).toBe(true);
      expect(result.telemetry.intentDetected).toBe(false); // No explicit tool_intent
    });
  });

  describe('Clean Architecture Flow', () => {
    it('should maintain separation: thought plans, speech acts', () => {
      const output = createOutput({
        internal_thought: 'User needs factual data. I should use SEARCH to find accurate information.',
        tool_intent: {
          tool: 'SEARCH',
          query: 'accurate data',
          reason: 'User needs facts'
        },
        speech_content: 'Let me find that information for you.'
      });

      const result = processDecisionGate(output, createSomaState());

      // Thought should remain unchanged (no violation)
      expect(result.modifiedOutput.internal_thought).toBe(output.internal_thought);

      // Speech should have the tool tag added
      expect(result.modifiedOutput.speech_content).toContain('[SEARCH:');

      // No cognitive violation
      expect(result.telemetry.violation).toBeUndefined();
    });

    it('should handle null tool in tool_intent', () => {
      const output = createOutput({
        tool_intent: {
          tool: null,
          query: '',
          reason: 'No tool needed'
        }
      });

      const result = processDecisionGate(output, createSomaState());

      expect(result.telemetry.intentDetected).toBe(false);
      expect(result.approved).toBe(true);
    });
  });
});

describe('CortexOutput Validation', () => {
  it('should validate tool_intent structure', async () => {
    const { isValidCortexOutput, isValidToolIntent } = await import('../../core/types/CortexOutput');

    const validIntent = {
      tool: 'SEARCH',
      query: 'test query',
      reason: 'testing'
    };

    expect(isValidToolIntent(validIntent)).toBe(true);
    expect(isValidToolIntent({ tool: 'INVALID' })).toBe(false);
    expect(isValidToolIntent(null)).toBe(false);
  });

  it('should validate CortexOutput with tool_intent', async () => {
    const { isValidCortexOutput } = await import('../../core/types/CortexOutput');

    const validOutput = {
      internal_thought: 'thinking',
      speech_content: 'speaking',
      mood_shift: { energy_delta: 0, confidence_delta: 0, stress_delta: 0 },
      tool_intent: {
        tool: 'VISUALIZE',
        query: 'sunset',
        reason: 'user wants image'
      }
    };

    expect(isValidCortexOutput(validOutput)).toBe(true);
  });
});
