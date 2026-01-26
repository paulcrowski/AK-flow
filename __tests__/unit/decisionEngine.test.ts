import { describe, expect, test } from 'vitest';
import type { KernelState } from '@core/kernel/types';
import { inputContainsExplicitId, shouldAskUser } from '@core/systems/decisionEngine';

describe('decisionEngine', () => {
  test('shouldAskUser returns false when focus is set', () => {
    const state: Pick<KernelState, 'focus'> = {
      focus: { domain: 'LIBRARY', id: 'doc-1', label: 'Book' }
    };
    expect(shouldAskUser(state, 'pokaz dokument')).toBe(false);
  });

  test('inputContainsExplicitId detects explicit ids', () => {
    const samples = [
      'docId=abc-123',
      'id: xyz-987',
      '/home/user/file.txt',
      '8d9f4b2a-1234-5678-9abc-def012345678'
    ];

    for (const sample of samples) {
      expect(inputContainsExplicitId(sample)).toBe(true);
    }
  });

  test('shouldAskUser returns false when input contains explicit id', () => {
    const state: Pick<KernelState, 'focus'> = { focus: { domain: null, id: null, label: null } };
    expect(shouldAskUser(state, 'docId=abc-123')).toBe(false);
  });

  test('shouldAskUser returns true when no focus and no explicit id', () => {
    const state: Pick<KernelState, 'focus'> = { focus: { domain: null, id: null, label: null } };
    expect(shouldAskUser(state, 'pokaz dokument')).toBe(true);
  });
});
