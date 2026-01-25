import type { KernelEvent, KernelOutput, KernelReducerResult, KernelState, ToolResultPayload } from '../../types';
import { handleWorkingSetAdvance } from './workingSet';

function getToolDomain(tool: string): 'WORLD' | 'LIBRARY' | 'ARTIFACT' | null {
  const t = (tool || '').toUpperCase();
  if (t.startsWith('READ_FILE') || t.startsWith('WRITE_FILE') || t.startsWith('LIST_DIR')) return 'WORLD';
  if (t.startsWith('READ_LIBRARY') || t.startsWith('SEARCH')) return 'LIBRARY';
  if (t.startsWith('READ_ARTIFACT') || t.startsWith('WRITE_ARTIFACT') || t.startsWith('EDIT_ARTIFACT')) return 'ARTIFACT';
  return null;
}

function isArtifactTool(tool: string): boolean {
  const t = (tool || '').toUpperCase();
  return t === 'CREATE' || t === 'APPEND' || t === 'REPLACE' || t.startsWith('READ_ARTIFACT') || t.startsWith('WRITE_ARTIFACT');
}

const asString = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : undefined;

const asNumber = (value: unknown): number | undefined =>
  typeof value === 'number' && !Number.isNaN(value) ? value : undefined;

export function handleToolResult(state: KernelState, event: KernelEvent, outputs: KernelOutput[]): KernelReducerResult {
  const payload = event.payload as ToolResultPayload | undefined;

  const toolName = payload?.tool || 'UNKNOWN';
  const ok = payload?.success ?? false;
  const domainActual = payload?.domainActual ?? getToolDomain(toolName);
  const domainExpected = payload?.domainExpected ?? state.activeDomain;

  let nextState: KernelState = {
    ...state,
    ticksSinceLastReward: 0,
    lastTool: {
      tool: toolName,
      ok,
      at: event.timestamp,
      domainExpected,
      domainActual,
      domainMatch: Boolean(domainExpected && domainActual && domainExpected === domainActual)
    }
  };

  const result = (payload?.result ?? {}) as Record<string, unknown>;
  const docId = asString(result.docId);
  const docName = asString(result.docName) ?? asString(result.name);
  const chunkCount = asNumber(result.chunkCount);
  const chunkId = asString(result.chunkId);
  const chunkIndex = asNumber(result.chunkIndex);
  const path = asString(result.path);
  const artifactId = asString(result.artifactId) ?? asString(result.id);
  const artifactName = asString(result.artifactName) ?? asString(result.name);

  if (ok && nextState.workingSet) {
    const r = handleWorkingSetAdvance(
      nextState,
      { type: 'WORKING_SET_ADVANCE', timestamp: event.timestamp } as KernelEvent,
      []
    );
    // Ensure lastTool is preserved if handleWorkingSetAdvance doesn't carry it (it should as it spreads state)
    nextState = { ...r.nextState };
    outputs.push({ type: 'LOG', payload: { message: 'WORKING_SET_AUTO_ADVANCE' } });
  }

  if (ok && toolName === 'READ_LIBRARY_DOC' && docId) {
    const previousDocId = nextState.lastLibraryDocId ?? null;
    nextState.focus = { domain: 'LIBRARY', id: docId, label: docName ?? null };
    if (typeof chunkCount === 'number' && chunkCount > 0) {
      nextState.cursor = { chunkCount, chunkIndex: 0 };
    } else {
      nextState.cursor = {};
    }
    nextState.lastLibraryDocId = docId;
    nextState.activeDomain = 'LIBRARY';
    if (docName !== undefined) {
      nextState.lastLibraryDocName = docName;
    }
    if (typeof chunkCount === 'number') {
      nextState.lastLibraryDocChunkCount = chunkCount;
    } else if (previousDocId && previousDocId !== docId) {
      nextState.lastLibraryDocChunkCount = null;
    }
  }

  if (ok && toolName === 'LIST_LIBRARY_CHUNKS' && docId) {
    if (nextState.focus.domain === 'LIBRARY' && nextState.focus.id === docId) {
      if (typeof chunkCount === 'number') {
        nextState.cursor.chunkCount = chunkCount;
        if (nextState.cursor.chunkIndex === undefined && chunkCount > 0) {
          nextState.cursor.chunkIndex = 0;
        }
        nextState.lastLibraryDocChunkCount = chunkCount;
      }
      nextState.cursor.chunksKnownForDocId = docId;
    }
    nextState.lastLibraryDocId = docId;
    nextState.activeDomain = 'LIBRARY';
  }

  if (ok && toolName === 'READ_LIBRARY_CHUNK') {
    if (nextState.focus.domain === 'LIBRARY' && (!docId || nextState.focus.id === docId)) {
      if (chunkId) nextState.cursor.lastChunkId = chunkId;
      if (typeof chunkIndex === 'number') nextState.cursor.chunkIndex = chunkIndex;
    }
    if (docId) {
      nextState.lastLibraryDocId = docId;
      nextState.activeDomain = 'LIBRARY';
    }
  }

  if (ok && (toolName === 'LIST_DIR' || toolName === 'READ_FILE') && path) {
    const label = path.split(/[\\/]/).pop() ?? null;
    nextState.focus = { domain: 'WORLD', id: path, label };
    nextState.lastWorldPath = path;
    nextState.activeDomain = 'WORLD';
  }

  if (ok && isArtifactTool(toolName) && artifactId) {
    nextState.focus = { domain: 'ARTIFACT', id: artifactId, label: artifactName ?? null };
    nextState.lastArtifactId = artifactId;
    if (artifactName !== undefined) {
      nextState.lastArtifactName = artifactName;
    }
    nextState.activeDomain = 'ARTIFACT';
  }

  outputs.push({
    type: 'LOG',
    payload: { message: 'TOOL_REWARD: Tool result received, resetting ticksSinceLastReward' }
  });

  return { nextState, outputs };
}
