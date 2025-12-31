import { describe, it, expect } from 'vitest';
import { levenshtein, classifyIntentFuzzy } from '@core/utils/fuzzyMatch';

describe('fuzzyMatch', () => {
  describe('levenshtein', () => {
    it('identical = 0', () => expect(levenshtein('test', 'test')).toBe(0));
    it('substitution = 1', () => expect(levenshtein('test', 'tast')).toBe(1));
    it('insertion = 1', () => expect(levenshtein('test', 'testt')).toBe(1));
    it('deletion = 1', () => expect(levenshtein('test', 'tes')).toBe(1));
    it('transposition = 2', () => expect(levenshtein('test', 'tset')).toBe(2));
  });

  describe('classifyIntentFuzzy', () => {
    it('exact match', () => {
      expect(classifyIntentFuzzy('utworz plik test.md')).toBe('CREATE');
      expect(classifyIntentFuzzy('dodaj do pliku')).toBe('APPEND');
    });

    it('typo with distance 1', () => {
      expect(classifyIntentFuzzy('utw\u00f3rz plik')).toBe('CREATE');
      expect(classifyIntentFuzzy('stworz plik')).toBe('CREATE');
      expect(classifyIntentFuzzy('doddaj do pliku')).toBe('APPEND');
    });

    it('distance 2 = null', () => {
      expect(classifyIntentFuzzy('utwwwrz plik')).toBeNull();
    });

    it('no verb = null', () => {
      expect(classifyIntentFuzzy('co tam slychac')).toBeNull();
    });
  });
});
