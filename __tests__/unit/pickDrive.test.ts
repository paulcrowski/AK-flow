import { describe, it, expect } from 'vitest';
import { pickDrive } from '@core/systems/AutonomyRepertoire';
import { UnifiedContextBuilder, type BasePersona, type ContextBuilderInput } from '@core/context';

const basePersona: BasePersona = {
  name: 'TestAgent',
  persona: 'A helpful test agent',
  coreValues: ['testing', 'reliability'],
  voiceStyle: 'balanced',
  language: 'English'
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
    limbic: { curiosity: 0.3, satisfaction: 0.3, frustration: 0.2, fear: 0.1 },
    soma: { energy: 50, cognitiveLoad: 30, isSleeping: false },
    neuro: { dopamine: 50, serotonin: 50, norepinephrine: 50 },
    conversation: [],
    silenceStart: Date.now() - 5000,
    lastUserInteractionAt: Date.now() - 10000,
    ...overrides
  };
  return UnifiedContextBuilder.build(input);
}

describe('pickDrive', () => {
  it('high explore desire selects EXPLORE_WORLD when hasWorld', () => {
    const ctx = buildContext({
      soma: { energy: 80, cognitiveLoad: 20, isSleeping: false },
      limbic: { curiosity: 0.9, satisfaction: 0.1, frustration: 0.1, fear: 0.1 },
      neuro: { dopamine: 30, serotonin: 50, norepinephrine: 50 },
      worldAccess: { hasSelection: true }
    });
    const result = pickDrive(ctx);
    expect(result.action).toBe('EXPLORE_WORLD');
  });

  it('high rest desire selects REST', () => {
    const ctx = buildContext({
      soma: { energy: 15, cognitiveLoad: 80, isSleeping: false },
      limbic: { curiosity: 0.3, satisfaction: 0.3, frustration: 0.2, fear: 0.1 },
      neuro: { dopamine: 50, serotonin: 50, norepinephrine: 50 },
      worldAccess: { hasSelection: true }
    });
    const result = pickDrive(ctx);
    expect(result.action).toBe('REST');
  });

  it('no world access penalizes EXPLORE_WORLD', () => {
    const ctx = buildContext({
      soma: { energy: 80, cognitiveLoad: 20, isSleeping: false },
      limbic: { curiosity: 0.9, satisfaction: 0.1, frustration: 0.1, fear: 0.1 },
      neuro: { dopamine: 30, serotonin: 50, norepinephrine: 50 },
      worldAccess: { hasSelection: false }
    });
    const result = pickDrive(ctx);
    expect(result.action).not.toBe('EXPLORE_WORLD');
  });

  it('high resolve selects REFLECT', () => {
    const ctx = buildContext({
      soma: { energy: 90, cognitiveLoad: 20, isSleeping: false },
      limbic: { curiosity: 0.1, satisfaction: 0.6, frustration: 0.9, fear: 0.2 },
      neuro: { dopamine: 50, serotonin: 50, norepinephrine: 50 },
      worldAccess: { hasSelection: true }
    });
    const result = pickDrive(ctx);
    expect(result.action).toBe('REFLECT');
  });
});
