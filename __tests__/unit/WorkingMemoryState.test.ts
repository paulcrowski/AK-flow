import { describe, it, expect, beforeEach } from 'vitest';
import { buildMinimalCortexState, clearIdentityCache } from '@core/builders/MinimalCortexStateBuilder';
import { META_STATES_BASELINE } from '@core/types/MetaStates';

describe('Working memory in minimal cortex state', () => {
  beforeEach(() => {
    clearIdentityCache();
  });

  it('injects working_memory when provided', () => {
    const state = buildMinimalCortexState({
      agentId: 'agent-test',
      metaStates: META_STATES_BASELINE,
      userInput: 'test',
      workingMemory: {
        last_library_doc_id: 'doc-123',
        last_library_doc_name: 'Test Doc',
        last_world_path: '/code',
        last_artifact_id: 'art-456',
        last_artifact_name: 'notes.md'
      }
    });

    expect(state.working_memory).toEqual({
      last_library_doc_id: 'doc-123',
      last_library_doc_name: 'Test Doc',
      last_world_path: '/code',
      last_artifact_id: 'art-456',
      last_artifact_name: 'notes.md'
    });
  });
});
