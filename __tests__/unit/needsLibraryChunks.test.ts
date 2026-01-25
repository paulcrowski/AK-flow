import { describe, expect, test } from 'vitest';
import { needsLibraryChunks } from '@core/systems/eventloop/reactiveStep.helpers';

describe('needsLibraryChunks', () => {
  test('returns true when chunkCount is undefined and chunksKnown mismatches', () => {
    const focus = { domain: 'LIBRARY', id: 'doc-1', label: 'Book' };
    const cursor = {};

    const needs = needsLibraryChunks({ focus, cursor, docId: 'doc-1' });
    expect(needs).toBe(true);
  });

  test('returns false when chunkCount is known', () => {
    const focus = { domain: 'LIBRARY', id: 'doc-1', label: 'Book' };
    const cursor = { chunkCount: 10 };

    const needs = needsLibraryChunks({ focus, cursor, docId: 'doc-1' });
    expect(needs).toBe(false);
  });

  test('returns false when chunksKnownForDocId matches', () => {
    const focus = { domain: 'LIBRARY', id: 'doc-1', label: 'Book' };
    const cursor = { chunkCount: undefined, chunksKnownForDocId: 'doc-1' };

    const needs = needsLibraryChunks({ focus, cursor, docId: 'doc-1' });
    expect(needs).toBe(false);
  });

  test('returns false when focus does not match docId', () => {
    const focus = { domain: 'WORLD', id: '/code', label: 'code' };
    const cursor = { chunkCount: undefined };

    const needs = needsLibraryChunks({ focus, cursor, docId: 'doc-1' });
    expect(needs).toBe(false);
  });
});
