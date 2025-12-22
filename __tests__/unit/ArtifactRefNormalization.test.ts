import { describe, it, expect } from 'vitest';
import { createProcessOutputForTools } from '../../utils/toolParser';
import { useArtifactStore } from '../../stores/artifactStore';

function createDeps() {
  return {
    setCurrentThought: () => {},
    addMessage: () => {},
    setSomaState: () => {},
    setLimbicState: () => {},
    lastVisualTimestampRef: { current: 0 },
    visualBingeCountRef: { current: 0 },
    stateRef: { current: { limbicState: { fear: 0, curiosity: 0.5, frustration: 0, satisfaction: 0.5 } } }
  } as any;
}

describe('P0.1.1 ArtifactRef normalization', () => {
  it('APPEND note.md should resolve by name and succeed', async () => {
    const store = useArtifactStore.getState();
    store.resetForTesting();
    store.create('note.md', 'hello');

    const process = createProcessOutputForTools(createDeps());
    await process('[APPEND: note.md] world');

    const updated = store.getByName('note.md')[0];
    expect(updated.content).toContain('world');
  });

  it('APPEND missing.md should emit controlled TOOL_ERROR (no throw ARTIFACT_ID_INVALID)', async () => {
    const store = useArtifactStore.getState();
    store.resetForTesting();

    const msgs: any[] = [];
    const deps = createDeps();
    deps.addMessage = (...args: any[]) => msgs.push(args);

    const process = createProcessOutputForTools(deps);
    await process('[APPEND: missing.md] x');

    const toolErrors = msgs.filter((m) => m?.[0] === 'assistant' && String(m?.[1] || '').includes('TOOL_ERROR'));
    expect(toolErrors.length).toBeGreaterThan(0);
    expect(String(toolErrors[toolErrors.length - 1][1])).toContain('Nie znalazłem artefaktu');
    expect(String(toolErrors[toolErrors.length - 1][1])).not.toContain('ARTIFACT_ID_INVALID');
  });
});
