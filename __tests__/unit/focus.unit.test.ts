import { describe, expect, test } from 'vitest';
import type { KernelEvent, KernelOutput } from '@core/kernel';
import { createInitialKernelState } from '@core/kernel';
import { handleToolResult } from '@core/kernel/reducer/handlers/toolResult';
import { handleToolError } from '@core/kernel/reducer/handlers/toolError';

describe('Focus reducer - unit', () => {
  test('READ_LIBRARY_DOC sets focus and resets cursor', () => {
    const state = createInitialKernelState();
    const outputs: KernelOutput[] = [];
    const event: KernelEvent = {
      type: 'TOOL_RESULT',
      timestamp: Date.now(),
      payload: {
        success: true,
        tool: 'READ_LIBRARY_DOC',
        result: { docId: 'doc-1', docName: 'Book A', chunkCount: 12 }
      }
    };

    const { nextState } = handleToolResult(state, event, outputs);

    expect(nextState.focus).toEqual({ domain: 'LIBRARY', id: 'doc-1', label: 'Book A' });
    expect(nextState.cursor.chunkCount).toBe(12);
    expect(nextState.cursor.chunkIndex).toBe(0);
    expect(nextState.cursor.lastChunkId).toBeUndefined();
  });

  test('READ_LIBRARY_DOC sets chunkIndex only when chunkCount > 0', () => {
    const state = createInitialKernelState();
    const outputs: KernelOutput[] = [];
    const event: KernelEvent = {
      type: 'TOOL_RESULT',
      timestamp: Date.now(),
      payload: {
        success: true,
        tool: 'READ_LIBRARY_DOC',
        result: { docId: 'doc-1', docName: 'Book A', chunkCount: 0 }
      }
    };

    const { nextState } = handleToolResult(state, event, outputs);

    expect(nextState.cursor.chunkIndex).toBeUndefined();
    expect(nextState.cursor.chunkCount).toBeUndefined();
  });

  test('READ_LIBRARY_DOC does not set chunksKnownForDocId', () => {
    const state = createInitialKernelState();
    const outputs: KernelOutput[] = [];
    const event: KernelEvent = {
      type: 'TOOL_RESULT',
      timestamp: Date.now(),
      payload: {
        success: true,
        tool: 'READ_LIBRARY_DOC',
        result: { docId: 'doc-1', docName: 'Book A', chunkCount: 12 }
      }
    };

    const { nextState } = handleToolResult(state, event, outputs);

    expect(nextState.cursor.chunksKnownForDocId).toBeUndefined();
  });

  test('READ_LIBRARY_DOC focus change with chunkCount resets cursor fields', () => {
    const state = createInitialKernelState({
      focus: { domain: 'LIBRARY', id: 'abc', label: 'Book A' },
      cursor: {
        chunkCount: 10,
        chunkIndex: 5,
        lastChunkId: 'chunk-5',
        chunksKnownForDocId: 'abc'
      }
    });
    const outputs: KernelOutput[] = [];
    const event: KernelEvent = {
      type: 'TOOL_RESULT',
      timestamp: Date.now(),
      payload: {
        success: true,
        tool: 'READ_LIBRARY_DOC',
        result: { docId: 'def', docName: 'Book B', chunkCount: 20 }
      }
    };

    const { nextState } = handleToolResult(state, event, outputs);

    expect(nextState.focus.id).toBe('def');
    expect(nextState.cursor.chunkCount).toBe(20);
    expect(nextState.cursor.chunkIndex).toBe(0);
    expect(nextState.cursor.lastChunkId).toBeUndefined();
    expect(nextState.cursor.chunksKnownForDocId).toBeUndefined();
  });

  test('READ_LIBRARY_DOC focus change without chunkCount resets cursor completely', () => {
    const state = createInitialKernelState({
      focus: { domain: 'LIBRARY', id: 'abc', label: 'Book A' },
      cursor: {
        chunkCount: 10,
        chunkIndex: 5,
        lastChunkId: 'chunk-5',
        chunksKnownForDocId: 'abc'
      }
    });
    const outputs: KernelOutput[] = [];
    const event: KernelEvent = {
      type: 'TOOL_RESULT',
      timestamp: Date.now(),
      payload: {
        success: true,
        tool: 'READ_LIBRARY_DOC',
        result: { docId: 'def', docName: 'Book B' }
      }
    };

    const { nextState } = handleToolResult(state, event, outputs);

    expect(nextState.focus.id).toBe('def');
    expect(nextState.cursor).toEqual({});

    const needsChunks =
      nextState.focus.domain === 'LIBRARY' &&
      nextState.focus.id === 'def' &&
      nextState.cursor.chunkCount === undefined &&
      nextState.cursor.chunksKnownForDocId !== 'def';
    expect(needsChunks).toBe(true);
  });

  test('LIST_LIBRARY_CHUNKS sets chunksKnownForDocId only on match', () => {
    const state = createInitialKernelState({
      focus: { domain: 'LIBRARY', id: 'doc-1', label: 'Book A' },
      cursor: {}
    });
    const outputs: KernelOutput[] = [];

    const mismatch: KernelEvent = {
      type: 'TOOL_RESULT',
      timestamp: Date.now(),
      payload: {
        success: true,
        tool: 'LIST_LIBRARY_CHUNKS',
        result: { docId: 'doc-2', chunkCount: 5 }
      }
    };

    const { nextState: afterMismatch } = handleToolResult(state, mismatch, outputs);
    expect(afterMismatch.cursor.chunksKnownForDocId).toBeUndefined();

    const match: KernelEvent = {
      type: 'TOOL_RESULT',
      timestamp: Date.now(),
      payload: {
        success: true,
        tool: 'LIST_LIBRARY_CHUNKS',
        result: { docId: 'doc-1', chunkCount: 5 }
      }
    };

    const { nextState } = handleToolResult(afterMismatch, match, outputs);
    expect(nextState.cursor.chunkCount).toBe(5);
    expect(nextState.cursor.chunkIndex).toBe(0);
    expect(nextState.cursor.chunksKnownForDocId).toBe('doc-1');
  });

  test('READ_LIBRARY_CHUNK updates cursor only on match', () => {
    const state = createInitialKernelState({
      focus: { domain: 'LIBRARY', id: 'doc-1', label: 'Book A' },
      cursor: { chunkIndex: 2, lastChunkId: 'chunk-2' }
    });
    const outputs: KernelOutput[] = [];

    const mismatch: KernelEvent = {
      type: 'TOOL_RESULT',
      timestamp: Date.now(),
      payload: {
        success: true,
        tool: 'READ_LIBRARY_CHUNK',
        result: { docId: 'doc-2', chunkId: 'chunk-3', chunkIndex: 3 }
      }
    };

    const { nextState: afterMismatch } = handleToolResult(state, mismatch, outputs);
    expect(afterMismatch.cursor.lastChunkId).toBe('chunk-2');
    expect(afterMismatch.cursor.chunkIndex).toBe(2);

    const match: KernelEvent = {
      type: 'TOOL_RESULT',
      timestamp: Date.now(),
      payload: {
        success: true,
        tool: 'READ_LIBRARY_CHUNK',
        result: { docId: 'doc-1', chunkId: 'chunk-3', chunkIndex: 3 }
      }
    };

    const { nextState } = handleToolResult(afterMismatch, match, outputs);
    expect(nextState.cursor.lastChunkId).toBe('chunk-3');
    expect(nextState.cursor.chunkIndex).toBe(3);
  });

  test('READ_LIBRARY_CHUNK updates when docId is missing', () => {
    const state = createInitialKernelState({
      focus: { domain: 'LIBRARY', id: 'doc-1', label: 'Book A' },
      cursor: {}
    });
    const outputs: KernelOutput[] = [];
    const event: KernelEvent = {
      type: 'TOOL_RESULT',
      timestamp: Date.now(),
      payload: {
        success: true,
        tool: 'READ_LIBRARY_CHUNK',
        result: { chunkId: 'chunk-3' }
      }
    };

    const { nextState } = handleToolResult(state, event, outputs);

    expect(nextState.cursor.lastChunkId).toBe('chunk-3');
  });

  test('READ_LIBRARY_CHUNK does not overwrite chunkIndex with undefined', () => {
    const state = createInitialKernelState({
      focus: { domain: 'LIBRARY', id: 'doc-1', label: 'Book A' },
      cursor: { chunkIndex: 2 }
    });
    const outputs: KernelOutput[] = [];
    const event: KernelEvent = {
      type: 'TOOL_RESULT',
      timestamp: Date.now(),
      payload: {
        success: true,
        tool: 'READ_LIBRARY_CHUNK',
        result: { docId: 'doc-1', chunkId: 'chunk-3' }
      }
    };

    const { nextState } = handleToolResult(state, event, outputs);

    expect(nextState.cursor.chunkIndex).toBe(2);
  });

  test('TOOL_ERROR clears library focus on NOT_FOUND', () => {
    const state = createInitialKernelState({
      focus: { domain: 'LIBRARY', id: 'doc-1', label: 'Book A' },
      cursor: { chunkCount: 4, chunkIndex: 1, lastChunkId: 'chunk-1', chunksKnownForDocId: 'doc-1' },
      lastLibraryDocId: 'doc-1',
      lastLibraryDocName: 'Book A',
      lastLibraryDocChunkCount: 4,
      activeDomain: 'LIBRARY'
    });
    const outputs: KernelOutput[] = [];
    const event: KernelEvent = {
      type: 'TOOL_ERROR',
      timestamp: Date.now(),
      payload: {
        tool: 'READ_LIBRARY_DOC',
        error: 'NOT_FOUND',
        payload: { arg: 'doc-1' }
      }
    };

    const { nextState } = handleToolError(state, event, outputs);

    expect(nextState.focus).toEqual({ domain: null, id: null, label: null });
    expect(nextState.cursor).toEqual({});
    expect(nextState.lastLibraryDocId).toBeNull();
    expect(nextState.lastLibraryDocName).toBeNull();
    expect(nextState.lastLibraryDocChunkCount).toBeNull();
    expect(nextState.activeDomain).toBeNull();
  });
});
