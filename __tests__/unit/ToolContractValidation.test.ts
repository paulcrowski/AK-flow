import { describe, expect, it, vi } from 'vitest';
import { validateToolResult } from '@core/tools/validateToolResult';
import { emitToolResult } from '@core/telemetry/toolContract';

describe('Tool contract validation', () => {
  it('throws for missing required fields', () => {
    expect(() => validateToolResult('LIST_LIBRARY_CHUNKS', { chunkCount: 10 }))
      .toThrow('LIST_LIBRARY_CHUNKS: requires docId');

    expect(() => validateToolResult('LIST_LIBRARY_CHUNKS', { docId: 'abc' }))
      .toThrow('LIST_LIBRARY_CHUNKS: requires chunkCount');

    expect(() => validateToolResult('READ_LIBRARY_CHUNK', { docId: 'abc' }))
      .toThrow('READ_LIBRARY_CHUNK: requires chunkId');
  });

  it('passes for valid contracts', () => {
    expect(() => validateToolResult('LIST_LIBRARY_CHUNKS', { docId: 'abc', chunkCount: 10 }))
      .not.toThrow();

    expect(() => validateToolResult('READ_LIBRARY_CHUNK', { chunkId: 'chunk-1' }))
      .not.toThrow();
  });

  it('warns for unknown tool (forward compatibility)', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    validateToolResult('UNKNOWN_FUTURE_TOOL', { foo: 'bar' });
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('UNKNOWN_TOOL_CONTRACT')
    );
    warnSpy.mockRestore();
  });
});

describe('Tool contract safety net', () => {
  it('emitToolResult logs contract violation when payload is invalid', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const publish = vi.fn();

    expect(() => emitToolResult(
      'LIST_LIBRARY_CHUNKS',
      'i1',
      { chunkCount: 10 },
      { publish, makeId: () => 'id', debugMode: false }
    )).not.toThrow();

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('CONTRACT VIOLATION')
    );

    consoleSpy.mockRestore();
  });
});
