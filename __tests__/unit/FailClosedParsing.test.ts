/**
 * FailClosedParsing.test.ts
 * 
 * Tests for TYDZIEŃ 1: Fail-closed JSON parsing and unified gate.
 * 
 * Key behaviors:
 * 1. When JSON parsing fails, autonomy returns voice_pressure=0, speech_content=""
 * 2. ExecutiveGate blocks empty speech_content
 * 3. SocialDynamics is checked as part of unified gate decision
 */

import { describe, it, expect } from 'vitest';
import { ExecutiveGate, GateContext, SpeechCandidate } from '../../core/systems/ExecutiveGate';

describe('FailClosedParsing', () => {
  
  describe('ExecutiveGate with empty speech', () => {
    const baseLimbic = {
      fear: 0.1,
      curiosity: 0.7,
      frustration: 0.1,
      satisfaction: 0.5
    };
    
    const baseContext: GateContext = {
      limbic: baseLimbic,
      time_since_user_input: 10000, // 10s - past silence window
      silence_window: 5000,
      voice_pressure_threshold: 0.6
    };
    
    it('should block candidate with empty speech_content', () => {
      const emptyCandidate: SpeechCandidate = {
        id: 'test-empty',
        type: 'autonomous',
        speech_content: '', // EMPTY - should be blocked
        internal_thought: 'I wanted to say something but parsing failed',
        timestamp: Date.now(),
        strength: 0.8,
        is_user_response: false
      };
      
      const decision = ExecutiveGate.decide([emptyCandidate], baseContext);
      
      expect(decision.should_speak).toBe(false);
      expect(decision.reason).toBe('EMPTY_SPEECH');
    });
    
    it('should block candidate with whitespace-only speech_content', () => {
      const whitespaceCandidate: SpeechCandidate = {
        id: 'test-whitespace',
        type: 'autonomous',
        speech_content: '   \n\t  ', // Whitespace only
        internal_thought: 'Parsing returned garbage',
        timestamp: Date.now(),
        strength: 0.8,
        is_user_response: false
      };
      
      const decision = ExecutiveGate.decide([whitespaceCandidate], baseContext);
      
      expect(decision.should_speak).toBe(false);
      expect(decision.reason).toBe('EMPTY_SPEECH');
    });
    
    it('should allow candidate with valid speech_content', () => {
      const validCandidate: SpeechCandidate = {
        id: 'test-valid',
        type: 'autonomous',
        speech_content: 'Hello, this is a valid message!',
        internal_thought: 'I have something meaningful to say',
        timestamp: Date.now(),
        strength: 0.8,
        is_user_response: false
      };
      
      const decision = ExecutiveGate.decide([validCandidate], baseContext);
      
      expect(decision.should_speak).toBe(true);
      expect(decision.reason).toBe('AUTONOMOUS_WON');
    });
  });
  
  describe('ExecutiveGate with SocialDynamics (unified)', () => {
    const baseLimbic = {
      fear: 0.1,
      curiosity: 0.7,
      frustration: 0.1,
      satisfaction: 0.5
    };
    
    it('should block when autonomy budget exhausted', () => {
      const contextWithExhaustedBudget: GateContext = {
        limbic: baseLimbic,
        time_since_user_input: 10000,
        silence_window: 5000,
        voice_pressure_threshold: 0.6,
        socialDynamics: {
          socialCost: 0.2,
          autonomyBudget: 0.05, // Below MIN_BUDGET_TO_SPEAK (0.1)
          userPresenceScore: 0.5,
          consecutiveWithoutResponse: 3
        }
      };
      
      const candidate: SpeechCandidate = {
        id: 'test-budget',
        type: 'autonomous',
        speech_content: 'I want to speak but budget is exhausted',
        internal_thought: 'Testing budget exhaustion',
        timestamp: Date.now(),
        strength: 0.8,
        is_user_response: false
      };
      
      const decision = ExecutiveGate.decide([candidate], contextWithExhaustedBudget);
      
      expect(decision.should_speak).toBe(false);
      expect(decision.reason).toBe('SOCIAL_BUDGET_EXHAUSTED');
    });
    
    it('should block when social cost makes effective pressure too low', () => {
      const contextWithHighSocialCost: GateContext = {
        limbic: baseLimbic,
        time_since_user_input: 10000,
        silence_window: 5000,
        voice_pressure_threshold: 0.6,
        socialDynamics: {
          socialCost: 0.8, // Very high cost
          autonomyBudget: 0.9,
          userPresenceScore: 0.3, // Low presence = higher threshold
          consecutiveWithoutResponse: 5
        }
      };
      
      const candidate: SpeechCandidate = {
        id: 'test-cost',
        type: 'autonomous',
        speech_content: 'I want to speak but cost is too high',
        internal_thought: 'Testing social cost',
        timestamp: Date.now(),
        strength: 0.8,
        is_user_response: false
      };
      
      const decision = ExecutiveGate.decide([candidate], contextWithHighSocialCost);
      
      expect(decision.should_speak).toBe(false);
      expect(decision.reason).toBe('SOCIAL_COST_TOO_HIGH');
      expect(decision.debug?.social_block_reason).toBe('SOCIAL_COST_TOO_HIGH');
    });
    
    it('should allow when social dynamics are favorable', () => {
      const contextWithGoodSocial: GateContext = {
        limbic: baseLimbic,
        time_since_user_input: 10000,
        silence_window: 5000,
        voice_pressure_threshold: 0.6,
        socialDynamics: {
          socialCost: 0.1, // Low cost
          autonomyBudget: 0.9, // High budget
          userPresenceScore: 0.9, // User engaged
          consecutiveWithoutResponse: 0
        }
      };
      
      const candidate: SpeechCandidate = {
        id: 'test-good',
        type: 'autonomous',
        speech_content: 'Social dynamics are favorable!',
        internal_thought: 'Testing good social state',
        timestamp: Date.now(),
        strength: 0.8,
        is_user_response: false
      };
      
      const decision = ExecutiveGate.decide([candidate], contextWithGoodSocial);
      
      expect(decision.should_speak).toBe(true);
      expect(decision.reason).toBe('AUTONOMOUS_WON');
    });
    
    it('should work without socialDynamics (backwards compatibility)', () => {
      const contextWithoutSocial: GateContext = {
        limbic: baseLimbic,
        time_since_user_input: 10000,
        silence_window: 5000,
        voice_pressure_threshold: 0.6
        // No socialDynamics
      };
      
      const candidate: SpeechCandidate = {
        id: 'test-compat',
        type: 'autonomous',
        speech_content: 'No social dynamics configured',
        internal_thought: 'Testing backwards compatibility',
        timestamp: Date.now(),
        strength: 0.8,
        is_user_response: false
      };
      
      const decision = ExecutiveGate.decide([candidate], contextWithoutSocial);
      
      expect(decision.should_speak).toBe(true);
      expect(decision.reason).toBe('AUTONOMOUS_WON');
    });
  });
  
  describe('Reactive always wins (unchanged behavior)', () => {
    const baseLimbic = {
      fear: 0.1,
      curiosity: 0.7,
      frustration: 0.1,
      satisfaction: 0.5
    };
    
    it('should let reactive candidate through even with exhausted social budget', () => {
      const contextWithExhaustedBudget: GateContext = {
        limbic: baseLimbic,
        time_since_user_input: 1000, // Within silence window
        silence_window: 5000,
        voice_pressure_threshold: 0.6,
        socialDynamics: {
          socialCost: 0.9,
          autonomyBudget: 0.01, // Exhausted
          userPresenceScore: 0.1,
          consecutiveWithoutResponse: 10
        }
      };
      
      const reactiveCandidate: SpeechCandidate = {
        id: 'test-reactive',
        type: 'reactive',
        speech_content: 'Responding to user!',
        internal_thought: 'User asked something',
        timestamp: Date.now(),
        strength: 1.0,
        is_user_response: true
      };
      
      const decision = ExecutiveGate.decide([reactiveCandidate], contextWithExhaustedBudget);
      
      expect(decision.should_speak).toBe(true);
      expect(decision.reason).toBe('REACTIVE_VETO');
    });
  });
});
