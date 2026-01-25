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

  test('LIST_LIBRARY_CHUNKS updates cursor only on doc match', () => {
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
        tool: 'LIST_LIBRARY_CHUNKS',
        result: { docId: 'doc-1', chunkCount: 5 }
      }
    };

    const { nextState } = handleToolResult(state, event, outputs);

    expect(nextState.cursor.chunkCount).toBe(5);
    expect(nextState.cursor.chunkIndex).toBe(0);
    expect(nextState.cursor.chunksKnownForDocId).toBe('doc-1');
  });

  test('READ_LIBRARY_CHUNK updates cursor on match', () => {
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
        result: { docId: 'doc-1', chunkId: 'chunk-3', chunkIndex: 3 }
      }
    };

    const { nextState } = handleToolResult(state, event, outputs);

    expect(nextState.cursor.lastChunkId).toBe('chunk-3');
    expect(nextState.cursor.chunkIndex).toBe(3);
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
