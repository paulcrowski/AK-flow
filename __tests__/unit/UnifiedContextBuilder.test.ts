/**
 * UnifiedContextBuilder.test.ts
 * 
 * Tests for TYDZIEŒ 2: Unified context building for reactive and autonomous paths.
 * 
 * Key behaviors:
 * 1. Same context structure for both paths
 * 2. StylePrefs > TraitVector > BasePersona hierarchy
 * 3. DialogueAnchor contains recent turns and topic summary
 */

import { describe, it, expect } from 'vitest';
import { 
  UnifiedContextBuilder, 
  type ContextBuilderInput,
  type StylePrefs,
  type BasePersona
} from '@core/context';

describe('UnifiedContextBuilder', () => {
  
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
  
  const baseInput: ContextBuilderInput = {
    agentName: 'TestAgent',
    basePersona,
    traitVector: baseTraitVector,
    limbic: baseLimbic,
    soma: baseSoma,
    neuro: baseNeuro,
    conversation: [],
    silenceStart: Date.now() - 5000,
    lastUserInteractionAt: Date.now() - 10000
  };
  
  describe('build()', () => {
    
    it('should build context with all required fields', () => {
      const ctx = UnifiedContextBuilder.build(baseInput);
      
      expect(ctx.hardFacts).toBeDefined();
      expect(ctx.hardFacts.agentName).toBe('TestAgent');
      expect(ctx.hardFacts.energy).toBe(80);
      expect(ctx.hardFacts.isSleeping).toBe(false);
      
      expect(ctx.basePersona).toBeDefined();
      expect(ctx.basePersona.name).toBe('TestAgent');
      
      expect(ctx.traitVector).toBeDefined();
      expect(ctx.limbic).toBeDefined();
      expect(ctx.dialogueAnchor).toBeDefined();
      expect(ctx.memoryAnchor).toBeDefined();
      expect(ctx.socialFrame).toBeDefined();
    });

    it('should not crash when conversation turns have missing text/role', () => {
      const inputWithBadTurn: ContextBuilderInput = {
        ...baseInput,
        conversation: [
          { role: 'user', text: 'Hello there!' },
          // Simulate malformed stored turn
          { role: undefined as any, text: undefined as any },
          { role: 'assistant', text: 'Hi!' }
        ]
      };

      const ctx = UnifiedContextBuilder.build(inputWithBadTurn);

      expect(ctx.dialogueAnchor).toBeDefined();
      expect(ctx.dialogueAnchor.topicSummary).toBeTruthy();

      const prompt = UnifiedContextBuilder.formatAsPrompt(ctx, 'reactive');
      expect(prompt).toContain('RECENT CONVERSATION');
    });
    
    it('should include recent conversation turns in dialogueAnchor', () => {
      const inputWithConversation: ContextBuilderInput = {
        ...baseInput,
        conversation: [
          { role: 'user', text: 'Hello there!' },
          { role: 'assistant', text: 'Hi! How can I help?' },
          { role: 'user', text: 'Tell me about testing' }
        ]
      };
      
      const ctx = UnifiedContextBuilder.build(inputWithConversation);
      
      expect(ctx.dialogueAnchor.recentTurns).toHaveLength(3);
      expect(ctx.dialogueAnchor.lastUserMessage).toBe('Tell me about testing');
      expect(ctx.dialogueAnchor.topicSummary).toContain('Tell me about');
    });
    
    it('should limit recent turns to MAX_RECENT_TURNS', () => {
      const manyTurns = Array.from({ length: 10 }, (_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        text: `Message ${i}`
      }));
      
      const inputWithManyTurns: ContextBuilderInput = {
        ...baseInput,
        conversation: manyTurns
      };
      
      const ctx = UnifiedContextBuilder.build(inputWithManyTurns);
      
      // Should be limited to 5 (MAX_RECENT_TURNS)
      expect(ctx.dialogueAnchor.recentTurns.length).toBeLessThanOrEqual(5);
    });
    
    it('should include active goal when present', () => {
      const inputWithGoal: ContextBuilderInput = {
        ...baseInput,
        activeGoal: {
          description: 'Help user with testing',
          source: 'curiosity',
          priority: 0.8
        }
      };
      
      const ctx = UnifiedContextBuilder.build(inputWithGoal);
      
      expect(ctx.activeGoal).toBeDefined();
      expect(ctx.activeGoal?.description).toBe('Help user with testing');
      expect(ctx.activeGoal?.priority).toBe(0.8);
    });
    
    it('should calculate social frame from dynamics', () => {
      const inputWithSocial: ContextBuilderInput = {
        ...baseInput,
        socialDynamics: {
          socialCost: 0.3,
          autonomyBudget: 0.7,
          userPresenceScore: 0.9,
          consecutiveWithoutResponse: 2
        }
      };
      
      const ctx = UnifiedContextBuilder.build(inputWithSocial);
      
      expect(ctx.socialFrame.userPresenceScore).toBe(0.9);
      expect(ctx.socialFrame.consecutiveWithoutResponse).toBe(2);
    });
  });
  
  describe('StylePrefs hierarchy', () => {
    
    it('should apply stylePrefs when provided', () => {
      const stylePrefs: StylePrefs = {
        noEmoji: true,
        noExclamation: true,
        language: 'Polish'
      };
      
      const inputWithStyle: ContextBuilderInput = {
        ...baseInput,
        stylePrefs
      };
      
      const ctx = UnifiedContextBuilder.build(inputWithStyle);
      
      expect(ctx.stylePrefs.noEmoji).toBe(true);
      expect(ctx.stylePrefs.noExclamation).toBe(true);
      expect(ctx.stylePrefs.language).toBe('Polish');
    });
    
    it('should use persona language as fallback when stylePrefs.language not set', () => {
      const ctx = UnifiedContextBuilder.build(baseInput);
      
      // Should fall back to basePersona.language
      expect(ctx.stylePrefs.language).toBe('English');
    });
    
    it('should default stylePrefs to false when not provided', () => {
      const ctx = UnifiedContextBuilder.build(baseInput);
      
      expect(ctx.stylePrefs.noEmoji).toBe(false);
      expect(ctx.stylePrefs.noExclamation).toBe(false);
      expect(ctx.stylePrefs.formalTone).toBe(false);
    });
  });
  
  describe('formatAsPrompt()', () => {
    
    it('should format context as prompt string for reactive mode', () => {
      const ctx = UnifiedContextBuilder.build(baseInput);
      const prompt = UnifiedContextBuilder.formatAsPrompt(ctx, 'reactive');
      
      expect(prompt).toContain('HARD FACTS');
      expect(prompt).toContain('TestAgent');
      expect(prompt).toContain('IDENTITY');
      expect(prompt).toContain('STYLE CONSTRAINTS');
      expect(prompt).toContain('TASK');
      expect(prompt).toContain('Respond to the user');
    });

    it('should include session chunks and identity shards in context', () => {
      const ctx = UnifiedContextBuilder.build({
        ...baseInput,
        sessionChunks: ['Chunk summary'],
        identityShards: ['belief: I value clarity'],
        semanticMatches: ['Memory detail']
      });
      const prompt = UnifiedContextBuilder.formatAsPrompt(ctx, 'reactive');

      expect(prompt).toContain('[SESSION_CHUNK]: Chunk summary');
      expect(prompt).toContain('[IDENTITY_SHARD]: belief: I value clarity');
      expect(prompt).toContain('[MEMORY]: Memory detail');
    });
    
    it('should format context as prompt string for autonomous mode', () => {
      const ctx = UnifiedContextBuilder.build(baseInput);
      const prompt = UnifiedContextBuilder.formatAsPrompt(ctx, 'autonomous');
      
      expect(prompt).toContain('HARD FACTS');
      expect(prompt).toContain('TASK');
      expect(prompt).toContain('decide if you want to speak');
      expect(prompt).toContain('voice_pressure');
    });
    
    it('should format context as prompt string for goal_driven mode', () => {
      const inputWithGoal: ContextBuilderInput = {
        ...baseInput,
        activeGoal: {
          description: 'Test goal',
          source: 'curiosity',
          priority: 0.8
        }
      };
      
      const ctx = UnifiedContextBuilder.build(inputWithGoal);
      const prompt = UnifiedContextBuilder.formatAsPrompt(ctx, 'goal_driven');
      
      expect(prompt).toContain('ACTIVE GOAL');
      expect(prompt).toContain('Test goal');
      expect(prompt).toContain('execute ONE action');
    });
    
    it('should include style constraints in prompt when stylePrefs set', () => {
      const inputWithStyle: ContextBuilderInput = {
        ...baseInput,
        stylePrefs: {
          noEmoji: true,
          formalTone: true,
          maxLength: 200
        }
      };
      
      const ctx = UnifiedContextBuilder.build(inputWithStyle);
      const prompt = UnifiedContextBuilder.formatAsPrompt(ctx, 'reactive');
      
      expect(prompt).toContain('NO emojis');
      expect(prompt).toContain('formal');
      expect(prompt).toContain('200 characters');
    });
  });
  
  describe('formatTraitVector()', () => {
    
    it('should describe high curiosity', () => {
      const highCuriosity = { ...baseTraitVector, curiosity: 0.9 };
      const desc = UnifiedContextBuilder.formatTraitVector(highCuriosity);
      
      expect(desc).toContain('highly curious');
    });
    
    it('should describe low verbosity as concise', () => {
      const lowVerbosity = { ...baseTraitVector, verbosity: 0.3 };
      const desc = UnifiedContextBuilder.formatTraitVector(lowVerbosity);
      
      expect(desc).toContain('concise');
    });
    
    it('should describe high social awareness as empathetic', () => {
      const highSocial = { ...baseTraitVector, socialAwareness: 0.9 };
      const desc = UnifiedContextBuilder.formatTraitVector(highSocial);
      
      expect(desc).toContain('empathetic');
    });
  });
  
  describe('extractTopicSummary()', () => {
    
    it('should return "No prior conversation" for empty turns', () => {
      const summary = UnifiedContextBuilder.extractTopicSummary([]);
      expect(summary).toBe('No prior conversation');
    });
    
    it('should extract topic from last user message', () => {
      const turns = [
        { role: 'user', text: 'Tell me about quantum computing and its applications' },
        { role: 'assistant', text: 'Quantum computing is...' }
      ];
      
      const summary = UnifiedContextBuilder.extractTopicSummary(turns);
      
      expect(summary).toContain('Tell me about quantum');
    });
    
    it('should truncate long messages', () => {
      const longMessage = 'This is a very long message that should be truncated because it exceeds the word limit for topic summary extraction';
      const turns = [{ role: 'user', text: longMessage }];
      
      const summary = UnifiedContextBuilder.extractTopicSummary(turns);
      
      expect(summary).toContain('...');
      expect(summary.length).toBeLessThan(longMessage.length);
    });
  });
});
