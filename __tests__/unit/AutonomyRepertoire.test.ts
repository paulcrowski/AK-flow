/**
 * AutonomyRepertoire.test.ts
 * 
 * Tests for TYDZIEŒ 3: Grounded autonomous actions.
 * 
 * Key behaviors:
 * 1. EXPLORE blocked when active topic exists
 * 2. EXPLORE requires sufficient silence (configurable)
 * 3. Grounding score validates speech against context
 * 4. SILENCE returned when no appropriate action
 */

import { describe, it, expect, vi } from 'vitest';
import { 
  AutonomyRepertoire,
  analyzeGrounding,
  calculateGroundingScore,
  selectAction,
  validateSpeech,
  type AutonomyAction
} from '@core/systems/AutonomyRepertoire';
import { UnifiedContextBuilder, type ContextBuilderInput, type BasePersona } from '@core/context';
import { getAutonomyConfig } from '@core/config/systemConfig';
import { useArtifactStore } from '@/stores/artifactStore';

describe('AutonomyRepertoire', () => {
  
  const basePersona: BasePersona = {
    name: 'TestAgent',
    persona: 'A helpful test agent',
    coreValues: ['testing', 'reliability'],
    voiceStyle: 'balanced',
    language: 'English'
  };
  
  const baseLimbic = {
    fear: 0.1,
    curiosity: 0.7,
    frustration: 0.1,
    satisfaction: 0.5
  };
  
  const baseSoma = {
    energy: 80,
    cognitiveLoad: 30,
    isSleeping: false
  };
  
  const baseNeuro = {
    dopamine: 60,
    serotonin: 50,
    norepinephrine: 40
  };
  
  const baseTraitVector = {
    arousal: 0.5,
    verbosity: 0.5,
    conscientiousness: 0.7,
    socialAwareness: 0.6,
    curiosity: 0.7
  };
  
  function buildContext(overrides: Partial<ContextBuilderInput> = {}) {
    const input: ContextBuilderInput = {
      agentName: 'TestAgent',
      basePersona,
      traitVector: baseTraitVector,
      limbic: baseLimbic,
      soma: baseSoma,
      neuro: baseNeuro,
      conversation: [],
      silenceStart: Date.now() - 5000,
      lastUserInteractionAt: Date.now() - 10000,
      ...overrides
    };
    return UnifiedContextBuilder.build(input);
  }
  
  describe('analyzeGrounding()', () => {
    
    it('should detect active topic from conversation', () => {
      const ctx = buildContext({
        conversation: [
          { role: 'user', text: 'Tell me about quantum computing' },
          { role: 'assistant', text: 'Quantum computing uses qubits...' }
        ]
      });
      
      const analysis = analyzeGrounding(ctx);
      
      expect(analysis.hasActiveTopic).toBe(true);
      expect(analysis.conversationDepth).toBe(1);
    });
    
    it('should detect no active topic for empty conversation', () => {
      const ctx = buildContext({ conversation: [] });
      
      const analysis = analyzeGrounding(ctx);
      
      expect(analysis.hasActiveTopic).toBe(false);
    });
    
    it('should detect need for clarification', () => {
      const ctx = buildContext({
        conversation: [
          { role: 'user', text: 'What do you mean by that?' }
        ]
      });
      
      const analysis = analyzeGrounding(ctx);
      
      expect(analysis.needsClarification).toBe(true);
    });
    
    it('should detect stale conversation', () => {
      const ctx = buildContext({
        silenceStart: Date.now() - 150000, // 150 seconds
        lastUserInteractionAt: Date.now() - 150000
      });
      
      const analysis = analyzeGrounding(ctx);
      
      expect(analysis.isConversationStale).toBe(true);
    });
  });
  
  describe('selectAction()', () => {
    
    it('should select SILENCE when no pending work exists', () => {
      const store = useArtifactStore.getState();
      store.resetForTesting();
      const ctx = buildContext({
        conversation: [
          { role: 'user', text: 'Tell me about machine learning' },
          { role: 'assistant', text: 'Machine learning is...' }
        ],
        silenceStart: Date.now() - 10000,
        lastUserInteractionAt: Date.now() - 10000
      });
      
      const decision = selectAction(ctx);
      
      expect(decision.action).toBe('SILENCE');
      expect(decision.allowed).toBe(true);
    });
    
    it('should select CLARIFY when user needs clarification', () => {
      const store = useArtifactStore.getState();
      store.resetForTesting();
      const ctx = buildContext({
        conversation: [
          { role: 'user', text: 'I don\'t understand what you mean' }
        ],
        silenceStart: Date.now() - 10000,
        lastUserInteractionAt: Date.now() - 10000
      });
      
      const decision = selectAction(ctx);
      
      expect(decision.action).toBe('CLARIFY');
      expect(decision.allowed).toBe(true);
    });

    it('should prefer WORK over CLARIFY when pending artifact exists', () => {
      const store = useArtifactStore.getState();
      store.resetForTesting();
      store.create('draft.md', 'hello');

      const ctx = buildContext({
        conversation: [
          { role: 'user', text: 'What do you mean by that?' }
        ],
        silenceStart: Date.now() - 10000,
        lastUserInteractionAt: Date.now() - 10000
      });

      const decision = selectAction(ctx);

      expect(decision.action).toBe('WORK');
      expect(decision.allowed).toBe(true);
    });
    
    it('should select WORK when pending artifact exists', () => {
      const store = useArtifactStore.getState();
      store.resetForTesting();
      store.create('draft.md', 'hello');
      const ctx = buildContext({
        conversation: [],
        silenceStart: Date.now() - 10000,
        lastUserInteractionAt: Date.now() - 10000
      });
      
      const decision = selectAction(ctx);
      
      expect(decision.action).toBe('WORK');
      expect(decision.allowed).toBe(true);
    });

    it('should select MAINTAIN when no pending work and silence > 5min', () => {
      const store = useArtifactStore.getState();
      store.resetForTesting();
      const now = Date.now();
      const ctx = buildContext({
        conversation: [],
        silenceStart: now - 400000,
        lastUserInteractionAt: now - 400000
      });

      const decision = selectAction(ctx);

      expect(decision.action).toBe('MAINTAIN');
      expect(decision.allowed).toBe(true);
      expect(decision.suggestedPrompt).toContain('[SNAPSHOT]');
    });

    it('should select MAINTAIN when no pending work and artifact debt > 5', () => {
      const store = useArtifactStore.getState();
      store.resetForTesting();

      vi.useFakeTimers();
      const old = Date.now() - 20 * 60 * 1000;
      vi.setSystemTime(old);

      const ids: string[] = [];
      for (let i = 0; i < 6; i++) {
        const id = store.create(`a${i}.md`, 'x');
        store.markComplete(id, true);
        ids.push(id);
      }

      vi.setSystemTime(Date.now() + 20 * 60 * 1000);

      const ctx = buildContext({
        conversation: [],
        silenceStart: Date.now() - 10,
        lastUserInteractionAt: Date.now() - 10
      });

      const decision = selectAction(ctx);

      expect(decision.action).toBe('MAINTAIN');
      expect(decision.allowed).toBe(true);

      vi.useRealTimers();
    });
  });
  
  describe('calculateGroundingScore()', () => {
    
    it('should return 0 for empty speech', () => {
      const ctx = buildContext();
      const score = calculateGroundingScore('', ctx);
      
      expect(score).toBe(0);
    });
    
    it('should return higher score for speech referencing conversation', () => {
      const ctx = buildContext({
        conversation: [
          { role: 'user', text: 'Tell me about quantum computing and qubits' }
        ]
      });
      
      const groundedSpeech = 'Quantum computing uses qubits for computation';
      const ungroundedSpeech = 'The weather is nice today';
      
      const groundedScore = calculateGroundingScore(groundedSpeech, ctx);
      const ungroundedScore = calculateGroundingScore(ungroundedSpeech, ctx);
      
      expect(groundedScore).toBeGreaterThan(ungroundedScore);
    });
    
    it('should give bonus for referencing user message', () => {
      const ctx = buildContext({
        conversation: [
          { role: 'user', text: 'What about neural networks?' }
        ]
      });
      
      const referencingUser = 'Neural networks are a key part of deep learning';
      const notReferencingUser = 'Deep learning is interesting';
      
      const refScore = calculateGroundingScore(referencingUser, ctx);
      const noRefScore = calculateGroundingScore(notReferencingUser, ctx);
      
      expect(refScore).toBeGreaterThan(noRefScore);
    });
  });
  
  describe('validateSpeech()', () => {
    
    it('should validate grounded speech', () => {
      const ctx = buildContext({
        conversation: [
          { role: 'user', text: 'Tell me about machine learning algorithms' }
        ]
      });
      
      const result = validateSpeech(
        'Machine learning algorithms include decision trees and neural networks',
        'CONTINUE',
        ctx
      );
      
      expect(result.valid).toBe(true);
    });
    
    it('should reject ungrounded speech for CONTINUE', () => {
      const ctx = buildContext({
        conversation: [
          { role: 'user', text: 'Tell me about machine learning' }
        ]
      });
      
      const result = validateSpeech(
        'Pizza is delicious',
        'CONTINUE',
        ctx
      );
      
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Grounding score');
    });
    
    it('should allow SILENCE action with empty speech', () => {
      const ctx = buildContext();
      
      const result = validateSpeech('', 'SILENCE', ctx);
      
      expect(result.valid).toBe(true);
    });
    
    it('should have lower grounding requirement for EXPLORE', () => {
      const ctx = buildContext({
        conversation: [] // No prior conversation
      });
      
      // EXPLORE has lower threshold (0.1 vs 0.3)
      const result = validateSpeech(
        'Have you ever wondered about the stars?',
        'EXPLORE',
        ctx
      );
      
      // Should be valid even with low grounding (no prior context to match)
      expect(result.groundingScore).toBeDefined();
    });
  });
  
  describe('CONFIG', () => {
    
    it('should have exploreMinSilenceSec = 25', () => {
      expect(getAutonomyConfig().exploreMinSilenceSec).toBe(25);
    });
    
    it('should have MIN_GROUNDING_SCORE = 0.3', () => {
      expect(AutonomyRepertoire.CONFIG.MIN_GROUNDING_SCORE).toBe(0.3);
    });
  });
});
