import { describe, expect, it } from 'vitest';
import { UnifiedContextBuilder, type BasePersona, type ContextBuilderInput } from '@core/context';
import { UnifiedContextPromptBuilder } from '@llm/gemini/UnifiedContextPromptBuilder';

describe('UnifiedContextPromptBuilder', () => {
  const basePersona: BasePersona = {
    name: 'TestAgent',
    persona: 'A helpful test agent',
    coreValues: ['testing', 'reliability'],
    voiceStyle: 'balanced',
    language: 'English'
  };

  const baseInput: ContextBuilderInput = {
    agentName: 'TestAgent',
    basePersona,
    traitVector: {
      arousal: 0.5,
      verbosity: 0.5,
      conscientiousness: 0.7,
      socialAwareness: 0.6,
      curiosity: 0.7
    },
    limbic: {
      fear: 0.1,
      curiosity: 0.7,
      frustration: 0.1,
      satisfaction: 0.5
    },
    soma: {
      energy: 80,
      cognitiveLoad: 30,
      isSleeping: false
    },
    neuro: {
      dopamine: 60,
      serotonin: 50,
      norepinephrine: 40
    },
    conversation: [
      { role: 'user', text: 'Hello there!' },
      { role: 'assistant', text: 'Hi! How can I help?' },
      { role: 'user', text: 'Tell me about testing' }
    ],
    silenceStart: Date.now() - 5000,
    lastUserInteractionAt: Date.now() - 10000
  };

  it('builds a prompt with core sections (reactive)', () => {
    const ctx = UnifiedContextBuilder.build(baseInput);
    const prompt = UnifiedContextPromptBuilder.build(ctx, 'reactive');

    expect(prompt).toContain('HARD FACTS');
    expect(prompt).toContain('IDENTITY');
    expect(prompt).toContain('STYLE CONSTRAINTS');
    expect(prompt).toContain('WORKING MEMORY');
    expect(prompt).toContain('CURRENT STATE');
    expect(prompt).toContain('SESSION HISTORY');
    expect(prompt).toContain('CONTEXT');
    expect(prompt).toContain('RECENT CONVERSATION');
    expect(prompt).toContain('TASK: Respond to the user');
  });

  it('includes goal section and goal task (goal_driven)', () => {
    const ctx = UnifiedContextBuilder.build({
      ...baseInput,
      activeGoal: {
        description: 'Help user with testing',
        source: 'curiosity',
        priority: 0.8
      }
    });

    const prompt = UnifiedContextPromptBuilder.build(ctx, 'goal_driven');

    expect(prompt).toContain('ACTIVE GOAL');
    expect(prompt).toContain('execute ONE action');
    expect(prompt).toContain('OUTPUT JSON');
  });

  it('clamps large context when budgets are small', () => {
    const ctx = UnifiedContextBuilder.build({
      ...baseInput,
      episodes: [
        'x'.repeat(20000)
      ]
    });

    const prompt = UnifiedContextPromptBuilder.build(ctx, 'autonomous', {
      contextMaxChars: 220,
      recentChatMaxChars: 220,
      sessionMemoryMaxChars: 220,
      taskMaxChars: 220
    });

    expect(prompt).toContain('[TRUNCATED]');
  });
});
