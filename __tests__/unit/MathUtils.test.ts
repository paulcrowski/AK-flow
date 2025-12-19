import { describe, it, expect } from 'vitest';
import { clampInt, normalize01, sigmoid } from '../../utils/math';

describe('utils/math', () => {
  describe('clampInt', () => {
    it('should clamp and truncate to int', () => {
      expect(clampInt(10.9, 0, 10)).toBe(10);
      expect(clampInt(-1.2, 0, 10)).toBe(0);
      expect(clampInt(5.9, 0, 10)).toBe(5);
    });

    it('should return min for non-finite values', () => {
      expect(clampInt(Number.NaN, 1, 10)).toBe(1);
      expect(clampInt(Number.POSITIVE_INFINITY, 1, 10)).toBe(1);
    });
  });

  describe('normalize01', () => {
    it('should map range into 0..1 and clamp', () => {
      expect(normalize01(0, 0, 10)).toBe(0);
      expect(normalize01(5, 0, 10)).toBe(0.5);
      expect(normalize01(10, 0, 10)).toBe(1);
      expect(normalize01(-1, 0, 10)).toBe(0);
      expect(normalize01(999, 0, 10)).toBe(1);
    });

    it('should return 0 for invalid ranges', () => {
      expect(normalize01(5, 1, 1)).toBe(0);
      expect(normalize01(Number.NaN, 0, 10)).toBe(0);
    });
  });

  describe('sigmoid', () => {
    it('should map 0 to ~0.5 and be monotonic', () => {
      expect(sigmoid(0)).toBeCloseTo(0.5, 6);
      expect(sigmoid(1)).toBeGreaterThan(sigmoid(0));
      expect(sigmoid(-1)).toBeLessThan(sigmoid(0));
    });

    it('should saturate for large magnitudes', () => {
      expect(sigmoid(1e6)).toBeCloseTo(1, 6);
      expect(sigmoid(-1e6)).toBeCloseTo(0, 6);
    });

    it('should return 0.5 for non-finite values', () => {
      expect(sigmoid(Number.NaN)).toBe(0.5);
      expect(sigmoid(Number.POSITIVE_INFINITY)).toBe(0.5);
    });
  });
});
