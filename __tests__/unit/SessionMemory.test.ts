/**
 * SessionMemory.test.ts
 * 
 * Tests for TYDZIEŒ 4: Session memory and formatSessionMemory.
 */

import { describe, it, expect } from 'vitest';
import { UnifiedContextBuilder, type SessionMemory } from '@core/context';

describe('SessionMemory', () => {
  
  describe('formatSessionMemory()', () => {
    
    it('should return "No session data available" when session is undefined', () => {
      const result = UnifiedContextBuilder.formatSessionMemory(undefined);
      expect(result).toBe('- No session data available');
    });
    
    it('should show "first conversation today" when sessionsToday is 0', () => {
      const session: SessionMemory = {
        sessionsToday: 0,
        sessionsThisWeek: 0,
        messagesToday: 0,
        lastInteractionAt: null,
        recentTopics: []
      };
      
      const result = UnifiedContextBuilder.formatSessionMemory(session);
      
      expect(result).toContain('first conversation today');
    });
    
    it('should show sessions and messages count when > 0', () => {
      const session: SessionMemory = {
        sessionsToday: 3,
        sessionsThisWeek: 5,
        messagesToday: 25,
        lastInteractionAt: null,
        recentTopics: []
      };
      
      const result = UnifiedContextBuilder.formatSessionMemory(session);
      
      expect(result).toContain('Sessions today: 3');
      expect(result).toContain('Messages today: 25');
      expect(result).toContain('Sessions this week: 5');
    });
    
    it('should show last interaction time in minutes', () => {
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      
      const session: SessionMemory = {
        sessionsToday: 1,
        sessionsThisWeek: 1,
        messagesToday: 5,
        lastInteractionAt: tenMinutesAgo,
        recentTopics: []
      };
      
      const result = UnifiedContextBuilder.formatSessionMemory(session);
      
      expect(result).toContain('Last interaction:');
      expect(result).toContain('minutes ago');
    });
    
    it('should show last interaction time in hours', () => {
      const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
      
      const session: SessionMemory = {
        sessionsToday: 1,
        sessionsThisWeek: 1,
        messagesToday: 5,
        lastInteractionAt: threeHoursAgo,
        recentTopics: []
      };
      
      const result = UnifiedContextBuilder.formatSessionMemory(session);
      
      expect(result).toContain('Last interaction:');
      expect(result).toContain('hours ago');
    });
    
    it('should show recent topics', () => {
      const session: SessionMemory = {
        sessionsToday: 2,
        sessionsThisWeek: 2,
        messagesToday: 10,
        lastInteractionAt: null,
        recentTopics: ['machine learning', 'neural networks', 'deep learning']
      };
      
      const result = UnifiedContextBuilder.formatSessionMemory(session);
      
      expect(result).toContain('Recent topics:');
      expect(result).toContain('machine learning');
      expect(result).toContain('neural networks');
    });
    
    it('should limit recent topics to 3', () => {
      const session: SessionMemory = {
        sessionsToday: 1,
        sessionsThisWeek: 1,
        messagesToday: 5,
        lastInteractionAt: null,
        recentTopics: ['topic1', 'topic2', 'topic3', 'topic4', 'topic5']
      };
      
      const result = UnifiedContextBuilder.formatSessionMemory(session);
      
      // Should only show first 3
      expect(result).toContain('topic1');
      expect(result).toContain('topic2');
      expect(result).toContain('topic3');
      expect(result).not.toContain('topic4');
    });
    
    it('should not show week sessions if same as today', () => {
      const session: SessionMemory = {
        sessionsToday: 3,
        sessionsThisWeek: 3, // Same as today
        messagesToday: 15,
        lastInteractionAt: null,
        recentTopics: []
      };
      
      const result = UnifiedContextBuilder.formatSessionMemory(session);
      
      expect(result).toContain('Sessions today: 3');
      expect(result).not.toContain('Sessions this week');
    });
  });
  
  describe('UnifiedContext with sessionMemory', () => {
    
    it('should include SESSION HISTORY in formatted prompt', () => {
      const basePersona = {
        name: 'TestAgent',
        persona: 'A test agent',
        coreValues: ['testing'],
        voiceStyle: 'balanced' as const,
        language: 'English'
      };
      
      const ctx = UnifiedContextBuilder.build({
        agentName: 'TestAgent',
        basePersona,
        traitVector: { arousal: 0.5, verbosity: 0.5, conscientiousness: 0.7, socialAwareness: 0.6, curiosity: 0.7 },
        limbic: { fear: 0.1, curiosity: 0.7, frustration: 0.1, satisfaction: 0.5 },
        soma: { energy: 80, cognitiveLoad: 30, isSleeping: false },
        neuro: { dopamine: 60, serotonin: 50, norepinephrine: 40 },
        conversation: [],
        silenceStart: Date.now(),
        lastUserInteractionAt: Date.now(),
        sessionMemory: {
          sessionsToday: 2,
          sessionsThisWeek: 5,
          messagesToday: 20,
          lastInteractionAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
          recentTopics: ['AI development']
        }
      });
      
      const prompt = UnifiedContextBuilder.formatAsPrompt(ctx, 'reactive');
      
      expect(prompt).toContain('SESSION HISTORY');
      expect(prompt).toContain('Sessions today: 2');
      expect(prompt).toContain('AI development');
    });
  });
});
