import { describe, expect, test } from 'vitest';
import type { Focus, Cursor } from '@core/kernel/types';
import { needsLibraryChunks } from '@core/systems/eventloop/reactiveStep.helpers';

describe('needsLibraryChunks', () => {
  test('returns true when chunkCount is undefined and chunksKnown mismatches', () => {
    const focus: Focus = { domain: 'LIBRARY', id: 'doc-1', label: 'Book' };
    const cursor: Cursor = {};

    const needs = needsLibraryChunks({ focus, cursor, docId: 'doc-1' });
    expect(needs).toBe(true);
  });

  test('returns false when chunkCount is known', () => {
    const focus: Focus = { domain: 'LIBRARY', id: 'doc-1', label: 'Book' };
    const cursor: Cursor = { chunkCount: 10 };

    const needs = needsLibraryChunks({ focus, cursor, docId: 'doc-1' });
    expect(needs).toBe(false);
  });

  test('returns false when chunksKnownForDocId matches', () => {
    const focus: Focus = { domain: 'LIBRARY', id: 'doc-1', label: 'Book' };
    const cursor: Cursor = { chunkCount: undefined, chunksKnownForDocId: 'doc-1' };

    const needs = needsLibraryChunks({ focus, cursor, docId: 'doc-1' });
    expect(needs).toBe(false);
  });

  test('returns false when focus does not match docId', () => {
    const focus: Focus = { domain: 'WORLD', id: '/code', label: 'code' };
    const cursor: Cursor = { chunkCount: undefined };

    const needs = needsLibraryChunks({ focus, cursor, docId: 'doc-1' });
    expect(needs).toBe(false);
  });
});
