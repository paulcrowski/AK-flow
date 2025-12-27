import { describe, it, expect } from 'vitest';
import { computeNeuralStrength } from '@utils/memoryStrength';

describe('computeNeuralStrength', () => {
  it('applies a floor when intensity is low', () => {
    const strength = computeNeuralStrength({
      fear: 0,
      curiosity: 0.02,
      frustration: 0,
      satisfaction: 0
    });
    expect(strength).toBe(5);
  });

  it('scales intensity to 1-100 range', () => {
    const strength = computeNeuralStrength({
      fear: 0.12,
      curiosity: 0.42,
      frustration: 0.2,
      satisfaction: 0.1
    });
    expect(strength).toBe(42);
  });

  it('caps at 100', () => {
    const strength = computeNeuralStrength({
      fear: 2,
      curiosity: 0,
      frustration: 0,
      satisfaction: 0
    });
    expect(strength).toBe(100);
  });
});
