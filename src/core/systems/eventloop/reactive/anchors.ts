import { getCognitiveState } from '../../../../stores/cognitiveStore';

export const updateLibraryAnchor = (
  ctx: any,
  documentId: string,
  documentName?: string | null,
  chunkCount?: number | null
) => {
  const previousDocId = ctx.lastLibraryDocId ?? null;
  const shouldResetChunkCount =
    Boolean(previousDocId) && previousDocId !== documentId && typeof chunkCount !== 'number';

  ctx.lastLibraryDocId = documentId;
  ctx.activeDomain = 'LIBRARY';
  if (documentName !== undefined) {
    ctx.lastLibraryDocName = documentName;
  }
  if (typeof chunkCount === 'number') {
    ctx.lastLibraryDocChunkCount = chunkCount;
  } else if (shouldResetChunkCount) {
    ctx.lastLibraryDocChunkCount = null;
  }
  try {
    const state = getCognitiveState();
    if (state?.hydrate) {
      const patch: Record<string, unknown> = {
        lastLibraryDocId: documentId,
        activeDomain: 'LIBRARY'
      };
      if (documentName !== undefined) {
        patch.lastLibraryDocName = documentName;
      }
      if (typeof chunkCount === 'number') {
        patch.lastLibraryDocChunkCount = chunkCount;
      } else if (shouldResetChunkCount) {
        patch.lastLibraryDocChunkCount = null;
      }
      state.hydrate(patch);
    }
  } catch {
    // ignore state sync issues
  }
};

export const updateWorldAnchor = (ctx: any, path: string) => {
  ctx.lastWorldPath = path;
  ctx.activeDomain = 'WORLD';
  try {
    const state = getCognitiveState();
    if (state?.hydrate) state.hydrate({ lastWorldPath: path, activeDomain: 'WORLD' });
  } catch {
    // ignore state sync issues
  }
};

export const updateArtifactAnchor = (ctx: any, artifactId: string, artifactName?: string | null) => {
  ctx.lastArtifactId = artifactId;
  ctx.activeDomain = 'ARTIFACT';
  if (artifactName !== undefined) {
    ctx.lastArtifactName = artifactName;
  }
  try {
    const state = getCognitiveState();
    if (state?.hydrate) {
      state.hydrate({
        lastArtifactId: artifactId,
        activeDomain: 'ARTIFACT',
        ...(artifactName !== undefined ? { lastArtifactName: artifactName } : {})
      });
    }
  } catch {
    // ignore state sync issues
  }
};

export const ensureCursor = (ctx: any) => {
  if (!ctx.cursor) ctx.cursor = {};
  return ctx.cursor;
};

export const setLibraryFocus = (
  ctx: any,
  documentId: string,
  documentName?: string | null,
  chunkCount?: number | null
) => {
  ctx.focus = { domain: 'LIBRARY', id: documentId, label: documentName ?? null };
  if (typeof chunkCount === 'number' && chunkCount > 0) {
    ctx.cursor = { chunkCount, chunkIndex: 0 };
  } else {
    ctx.cursor = {};
  }
};

export const updateCursorForChunkList = (ctx: any, documentId: string, chunkCount?: number | null) => {
  if (ctx.focus?.domain !== 'LIBRARY' || ctx.focus.id !== documentId) return;
  const cursor = ensureCursor(ctx);
  if (typeof chunkCount === 'number') {
    cursor.chunkCount = chunkCount;
    if (cursor.chunkIndex === undefined && chunkCount > 0) {
      cursor.chunkIndex = 0;
    }
  }
  cursor.chunksKnownForDocId = documentId;
  ctx.cursor = cursor;
};

export const updateCursorForChunk = (
  ctx: any,
  documentId: string,
  chunkId?: string | null,
  chunkIndex?: number
) => {
  if (ctx.focus?.domain !== 'LIBRARY') return;
  if (documentId && ctx.focus.id !== documentId) return;
  const cursor = ensureCursor(ctx);
  if (chunkId) cursor.lastChunkId = chunkId;
  if (typeof chunkIndex === 'number') cursor.chunkIndex = chunkIndex;
  ctx.cursor = cursor;
};

const shouldClearAnchorForError = (error: unknown) => {
  const message = String(error || '').toUpperCase();
  return (
    message.includes('NOT_FOUND') ||
    message.includes('NO_DOC') ||
    message.includes('NO_CHUNKS') ||
    message.includes('MISSING_DOC') ||
    message.includes('CHUNK_NOT_FOUND') ||
    message.includes('CHUNKS_MISSING')
  );
};

export const clearLibraryAnchorIfMatches = (ctx: any, documentId: string, error: unknown) => {
  if (!shouldClearAnchorForError(error)) return;
  if (!documentId || ctx.lastLibraryDocId !== documentId) return;
  ctx.lastLibraryDocId = null;
  ctx.lastLibraryDocName = null;
  ctx.lastLibraryDocChunkCount = null;
  if (ctx.activeDomain === 'LIBRARY') {
    ctx.activeDomain = null;
  }
  if (ctx.focus?.domain === 'LIBRARY' && ctx.focus.id === documentId) {
    ctx.focus = { domain: null, id: null, label: null };
    ctx.cursor = {};
  }
  try {
    const state = getCognitiveState();
    if (state?.hydrate) {
      const patch: Record<string, unknown> = {
        lastLibraryDocId: null,
        lastLibraryDocName: null,
        lastLibraryDocChunkCount: null
      };
      if (state.activeDomain === 'LIBRARY') {
        patch.activeDomain = null;
      }
      if (state.focus?.domain === 'LIBRARY' && state.focus.id === documentId) {
        patch.focus = { domain: null, id: null, label: null };
        patch.cursor = {};
      }
      state.hydrate(patch);
    }
  } catch {
    // ignore state sync issues
  }
};
