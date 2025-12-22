import { describe, it, expect } from 'vitest';
import { createRng } from '@core/utils/rng';

describe('RNG', () => {
  it('same seed = same sequence', () => {
    const rng1 = createRng('test-seed');
    const rng2 = createRng('test-seed');
    
    expect(rng1()).toBe(rng2());
    expect(rng1()).toBe(rng2());
    expect(rng1()).toBe(rng2());
  });
  
  it('different seeds = different sequences', () => {
    const rng1 = createRng('seed-a');
    const rng2 = createRng('seed-b');
    
    expect(rng1()).not.toBe(rng2());
  });
  
  it('null seed uses Math.random', () => {
    const rng = createRng(null);
    expect(rng).toBe(Math.random);
  });

  it('undefined seed uses Math.random', () => {
    const rng = createRng();
    expect(rng).toBe(Math.random);
  });

  it('produces values between 0 and 1', () => {
    const rng = createRng('bounds-test');
    
    for (let i = 0; i < 100; i++) {
      const value = rng();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  });

  it('is deterministic across multiple calls', () => {
    const rng = createRng('determinism-test');
    const sequence: number[] = [];
    
    for (let i = 0; i < 10; i++) {
      sequence.push(rng());
    }
    
    // Create new RNG with same seed
    const rng2 = createRng('determinism-test');
    
    for (let i = 0; i < 10; i++) {
      expect(rng2()).toBe(sequence[i]);
    }
  });
});
