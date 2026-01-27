import { downloadLibraryDocumentText, findLibraryDocumentByName, getLibraryChunkByIndex, listLibraryChunks, searchLibraryChunks } from '../../../services/LibraryService';
import { getCurrentAgentId } from '../../../services/supabase';
import { normalizeRoutingInput } from '../../../tools/toolRouting';
import { evidenceLedger } from '../EvidenceLedger';
import { emitToolIntent } from '../../telemetry/toolContract';
import { looksLikeLibraryAnchor, needsLibraryChunks, resolveImplicitReference } from './reactiveStep.helpers';
import type { ReactiveCallbacksLike, TraceLike } from './ReactiveStep';

type PublishReactiveSpeech = (params: {
  ctx: any;
  trace: TraceLike;
  callbacks: ReactiveCallbacksLike;
  speechText: string;
  internalThought: string;
  meta?: { knowledgeSource?: any; evidenceSource?: any; evidenceDetail?: any; generator?: any };
  agentMemoryId?: string | null;
}) => void;

type LibraryDeps = {
  ctx: any;
  callbacks: ReactiveCallbacksLike;
  trace: TraceLike;
  userInput: string;
  isDev: boolean;
  emitSystemAlert: (event: string, payload: Record<string, unknown>, priority?: number) => void;
  emitToolResult: (
    tool: string,
    intentId: string,
    payload?: Record<string, unknown>,
    options?: { priority: number }
  ) => void;
  emitToolError: (
    tool: string,
    intentId: string,
    payload: Record<string, unknown>,
    message: string,
    options?: { priority: number }
  ) => void;
  toolResultOptions: { priority: number };
  toolErrorOptions: { priority: number };
  updateLibraryAnchor: (documentId: string, documentName?: string | null, chunkCount?: number | null) => void;
  setLibraryFocus: (documentId: string, documentName?: string | null, chunkCount?: number | null) => void;
  updateCursorForChunkList: (documentId: string, chunkCount?: number | null) => void;
  updateCursorForChunk: (documentId: string, chunkId?: string | null, chunkIndex?: number) => void;
  clearLibraryAnchorIfMatches: (documentId: string, error: unknown) => void;
  publishReactiveSpeech: PublishReactiveSpeech;
  updateContextAfterAction: (ctx: any) => void;
};

export function createLibraryHandlers(deps: LibraryDeps) {
  const {
    ctx,
    trace,
    callbacks,
    userInput,
    isDev,
    emitSystemAlert,
    emitToolResult,
    emitToolError,
    toolResultOptions,
    toolErrorOptions,
    updateLibraryAnchor,
    setLibraryFocus,
    updateCursorForChunkList,
    updateCursorForChunk,
    clearLibraryAnchorIfMatches,
    publishReactiveSpeech,
    updateContextAfterAction
  } = deps;

  const wantsChunks = (inputText: string) => {
    const normalized = normalizeRoutingInput(inputText);
    return normalized.includes('chunk') || normalized.includes('chunki');
  };

  const isUuidLike = (value: string) =>
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(value);

  const normalizeLibraryQuery = (rawTarget: string) => {
    const raw = String(rawTarget || '').replace(/["'`]/g, '').trim();
    if (!raw) return '';
    const parts = raw.split(/\s+/);
    if (parts.length > 1) {
      const first = normalizeRoutingInput(parts[0]);
      if (
        first.startsWith('ksiazk') ||
        first.startsWith('dokument') ||
        first.startsWith('raport') ||
        first.startsWith('pdf') ||
        first.startsWith('book') ||
        first.startsWith('document') ||
        first.startsWith('report') ||
        first.startsWith('bibliotek') ||
        first.startsWith('library')
      ) {
        parts.shift();
      }
    }
    const cleaned = parts.join(' ').replace(/[\s,;:.!?]+$/g, '').trim();
    return cleaned.slice(0, 160);
  };

  const publishClarification = (question: string, options?: string[]) => {
    const optionText = options && options.length > 0
      ? ` ${options.map((opt, idx) => `${idx + 1}) ${opt}`).join(' ')}`
      : '';
    emitSystemAlert('USER_CLARIFICATION_QUESTION', {
      input: userInput,
      question,
      options: options ?? []
    });
    publishReactiveSpeech({
      ctx,
      trace,
      callbacks,
      speechText: `${question}${optionText}`,
      internalThought: 'USER_CLARIFICATION_QUESTION'
    });
    updateContextAfterAction(ctx);
  };

  const publishIngestMissing = (doc: { id?: string; original_name?: string } | null, reason: string) => {
    emitSystemAlert('LIBRARY_INGEST_MISSING', {
      docId: doc?.id ?? null,
      name: doc?.original_name ?? null,
      reason
    });
    publishReactiveSpeech({
      ctx,
      trace,
      callbacks,
      speechText: 'Ten dokument nie jest jeszcze zindeksowany (brak chunkow).',
      internalThought: 'LIBRARY_INGEST_MISSING'
    });
    updateContextAfterAction(ctx);
  };

  const readLibraryDoc = async (documentId: string, docHint?: { original_name?: string; ingested_at?: string | null }) => {
    const intentId = emitToolIntent('READ_LIBRARY_DOC', documentId);
    try {
      const res: any = await downloadLibraryDocumentText({ documentId });
      if (res.ok === false) {
        throw new Error(res.error || 'READ_LIBRARY_DOC_FAILED');
      }

      const doc = res.doc || docHint || {};
      const originalName = String(doc?.original_name || '').trim() || 'unknown';
      if (!doc?.ingested_at) {
        emitSystemAlert('LIBRARY_INGEST_MISSING', {
          docId: documentId,
          name: originalName,
          reason: 'ingested_at_missing'
        });
      }

      const raw = String(res.text || '');
      const excerpt = raw.slice(0, 8000);
      evidenceLedger.record('READ_FILE', originalName || documentId);
      emitToolResult(
        'READ_LIBRARY_DOC',
        intentId,
        { docId: documentId, name: originalName, length: raw.length },
        toolResultOptions
      );
      updateLibraryAnchor(documentId, originalName);
      setLibraryFocus(documentId, originalName);

      if (needsLibraryChunks({ focus: ctx.focus, cursor: ctx.cursor, docId: documentId })) {
        await listLibraryChunkSummaries(documentId);
      }

      publishReactiveSpeech({
        ctx,
        trace,
        callbacks,
        speechText: `READ_LIBRARY_DOC ${documentId} (${originalName}):\n${excerpt || '(empty)'}`,
        internalThought: ''
      });
      updateContextAfterAction(ctx);
    } catch (error: any) {
      emitToolError(
        'READ_LIBRARY_DOC',
        intentId,
        { arg: documentId },
        error?.message || 'READ_LIBRARY_DOC_FAILED',
        toolErrorOptions
      );
      clearLibraryAnchorIfMatches(documentId, error?.message || error);
    }
  };

  const readLibraryChunk = async (documentId: string, chunkIndex: number, docHint?: { original_name?: string; ingested_at?: string | null }) => {
    const intentId = emitToolIntent('READ_LIBRARY_CHUNK', `${documentId}#${chunkIndex}`);
    try {
      const res: any = await getLibraryChunkByIndex({ documentId, chunkIndex });
      if (res.ok === false) {
        throw new Error(res.error || 'READ_LIBRARY_CHUNK_FAILED');
      }
      if (!res.chunk) {
        const listRes: any = await listLibraryChunks({ documentId, limit: 1 });
        if (listRes.ok && listRes.chunks.length === 0) {
          publishIngestMissing({ id: documentId, original_name: docHint?.original_name }, 'chunks_missing');
          throw new Error('CHUNKS_MISSING');
        }
        throw new Error('CHUNK_NOT_FOUND');
      }

      const chunkId = String(res.chunk?.id || '').trim();
      if (!chunkId) {
        throw new Error('CHUNK_ID_MISSING');
      }
      const chunkText = String(res.chunk.content || '').trim();
      evidenceLedger.record('READ_FILE', `${documentId}#${chunkIndex}`);
      emitToolResult(
        'READ_LIBRARY_CHUNK',
        intentId,
        { docId: documentId, chunkId, chunkIndex, length: chunkText.length },
        toolResultOptions
      );
      updateLibraryAnchor(documentId, docHint?.original_name);
      updateCursorForChunk(documentId, chunkId, chunkIndex);
      publishReactiveSpeech({
        ctx,
        trace,
        callbacks,
        speechText: `READ_LIBRARY_CHUNK ${documentId}#${chunkIndex}:\n${chunkText || '(empty)'}`,
        internalThought: ''
      });
      updateContextAfterAction(ctx);
    } catch (error: any) {
      emitToolError(
        'READ_LIBRARY_CHUNK',
        intentId,
        { arg: `${documentId}#${chunkIndex}` },
        error?.message || 'READ_LIBRARY_CHUNK_FAILED',
        toolErrorOptions
      );
      clearLibraryAnchorIfMatches(documentId, error?.message || error);
    }
  };

  const listLibraryChunkSummaries = async (documentId: string, limit = 20) => {
    const intentId = emitToolIntent('LIST_LIBRARY_CHUNKS', documentId);
    try {
      const res: any = await listLibraryChunks({ documentId, limit: limit + 1 });
      if (res.ok === false) {
        throw new Error(res.error || 'LIST_LIBRARY_CHUNKS_FAILED');
      }

      const chunks = Array.isArray(res.chunks) ? res.chunks : [];
      const chunkCount = typeof res.chunkCount === 'number' ? res.chunkCount : chunks.length;
      if (chunks.length === 0) {
        emitToolResult(
          'LIST_LIBRARY_CHUNKS',
          intentId,
          { docId: documentId, chunkCount, shown: 0, hasMore: false },
          toolResultOptions
        );
        updateLibraryAnchor(documentId, undefined, chunkCount);
        updateCursorForChunkList(documentId, chunkCount);
        return { text: 'Brak chunkow dla tego dokumentu.', shownCount: 0, hasMore: false };
      }

      const hasMore = chunks.length > limit;
      const visible = chunks.slice(0, limit);
      const summaries = visible.map((chunk: any) => {
        const preview = String(chunk.content || '').replace(/\s+/g, ' ').slice(0, 100);
        return `#${chunk.chunk_index}: ${preview}...`;
      });

      emitToolResult(
        'LIST_LIBRARY_CHUNKS',
        intentId,
        {
          docId: documentId,
          chunkCount,
          shown: visible.length,
          hasMore
        },
        toolResultOptions
      );
      updateLibraryAnchor(documentId, undefined, chunkCount);
      updateCursorForChunkList(documentId, chunkCount);

      const countInfo = hasMore
        ? `Pokazuje pierwsze ${limit} chunkow (jest wiecej):`
        : `Dokument ma ${visible.length} chunkow:`;

      return {
        text: `${countInfo}\n${summaries.join('\n')}\n\nKtory chunk? [READ_LIBRARY_CHUNK: ${documentId}#N]`,
        shownCount: visible.length,
        hasMore
      };
    } catch (error: any) {
      emitToolError(
        'LIST_LIBRARY_CHUNKS',
        intentId,
        { documentId },
        error?.message || 'LIST_LIBRARY_CHUNKS_FAILED',
        toolErrorOptions
      );
      clearLibraryAnchorIfMatches(documentId, error?.message || error);
      return { text: 'Nie moge pobrac chunkow.', shownCount: 0, hasMore: false };
    }
  };

  const handleLibraryRead = async (rawTarget?: string, anchorOnly?: boolean) => {
    const chunkRequest = wantsChunks(rawTarget || userInput);
    const resolved = resolveImplicitReference(userInput, {
      focus: ctx.focus,
      lastLibraryDocId: ctx.lastLibraryDocId,
      lastWorldPath: ctx.lastWorldPath,
      lastArtifactId: ctx.lastArtifactId
    });

    if (resolved.type === 'library_doc' && resolved.id && resolved.confidence > 0.7) {
      if (isDev) {
        console.log(`[ANCHOR_RESOLVER] Using library anchor: ${resolved.id} (confidence: ${resolved.confidence})`);
      }
      if (chunkRequest) {
        const { text } = await listLibraryChunkSummaries(resolved.id);
        publishReactiveSpeech({
          ctx,
          trace,
          callbacks,
          speechText: text,
          internalThought: ''
        });
        updateContextAfterAction(ctx);
        return;
      }
      await readLibraryDoc(resolved.id);
      return;
    }

    const anchorRequested = Boolean(anchorOnly) || looksLikeLibraryAnchor(rawTarget || '');
    if (anchorRequested) {
      const anchorId = ctx.lastLibraryDocId || null;
      if (!anchorId) {
        emitSystemAlert('MISSING_LIBRARY_ANCHOR', {
          input: userInput,
          reason: 'no_last_library_doc'
        });
        publishClarification('Nie mam aktywnej ksiazki. Podaj tytul dokumentu.');
        return;
      }
      if (chunkRequest) {
        const { text } = await listLibraryChunkSummaries(anchorId);
        publishReactiveSpeech({
          ctx,
          trace,
          callbacks,
          speechText: text,
          internalThought: ''
        });
        updateContextAfterAction(ctx);
        return;
      }
      await readLibraryDoc(anchorId);
      return;
    }

    const raw = String(rawTarget || '').trim();
    if (raw && isUuidLike(raw)) {
      if (chunkRequest) {
        const { text } = await listLibraryChunkSummaries(raw);
        publishReactiveSpeech({
          ctx,
          trace,
          callbacks,
          speechText: text,
          internalThought: ''
        });
        updateContextAfterAction(ctx);
        return;
      }
      await readLibraryDoc(raw);
      return;
    }

    const query = normalizeLibraryQuery(rawTarget || '');
    if (!query) {
      publishClarification('Podaj tytul lub fragment nazwy dokumentu.');
      return;
    }

    if (isUuidLike(query)) {
      if (chunkRequest) {
        const { text } = await listLibraryChunkSummaries(query);
        publishReactiveSpeech({
          ctx,
          trace,
          callbacks,
          speechText: text,
          internalThought: ''
        });
        updateContextAfterAction(ctx);
        return;
      }
      await readLibraryDoc(query);
      return;
    }

    const agentId = trace.agentId || getCurrentAgentId() || null;
    const found: any = await findLibraryDocumentByName({ name: query, agentId });
    if (found.ok === false) {
      publishClarification('Nie moge sprawdzic biblioteki. Podaj tytul jeszcze raz.');
      return;
    }
    if (found.document) {
      const doc = found.document as any;
      if (chunkRequest && !doc?.ingested_at) {
        publishIngestMissing(doc, 'ingested_at_missing');
        return;
      }
      if (chunkRequest) {
        const { text } = await listLibraryChunkSummaries(String(doc.id));
        publishReactiveSpeech({
          ctx,
          trace,
          callbacks,
          speechText: text,
          internalThought: ''
        });
        updateContextAfterAction(ctx);
        return;
      }
      await readLibraryDoc(String(doc.id), doc);
      return;
    }

    const searchIntentId = emitToolIntent('SEARCH_LIBRARY', query);
    let searchRes: any;
    try {
      searchRes = await searchLibraryChunks({ query, limit: 6 });
      if (searchRes.ok === false) {
        throw new Error(searchRes.error || 'SEARCH_LIBRARY_FAILED');
      }
    } catch (error: any) {
      emitToolError(
        'SEARCH_LIBRARY',
        searchIntentId,
        { arg: query },
        error?.message || 'SEARCH_LIBRARY_FAILED',
        toolErrorOptions
      );
      return;
    }
      const hits = Array.isArray(searchRes.hits) ? searchRes.hits : [];
      if (hits.length > 0) {
        evidenceLedger.record('SEARCH_HIT', query);
      }
      const matches = hits.slice(0, 8).map((hit: any) => ({
        docId: String(hit.document_id),
        chunkIndex: Number(hit.chunk_index ?? 0),
        snippet: String(hit.snippet ?? '')
          .replace(/\s+/g, ' ')
          .slice(0, 280)
      }));

      emitToolResult(
        'SEARCH_LIBRARY',
        searchIntentId,
        { arg: query, hitsCount: hits.length, matches },
        toolResultOptions
      );

    if (searchRes.hits.length === 1) {
      const hit = searchRes.hits[0];
      if (chunkRequest) {
        const { text } = await listLibraryChunkSummaries(String(hit.document_id));
        publishReactiveSpeech({
          ctx,
          trace,
          callbacks,
          speechText: text,
          internalThought: ''
        });
        updateContextAfterAction(ctx);
        return;
      }
      await readLibraryDoc(String(hit.document_id));
      return;
    }

    if (searchRes.hits.length > 1) {
      const seen = new Set<string>();
      const options: string[] = [];
      for (const hit of searchRes.hits) {
        const docId = String(hit.document_id);
        if (seen.has(docId)) continue;
        seen.add(docId);
        const snippet = String(hit.snippet || '').replace(/\s+/g, ' ').slice(0, 80);
        options.push(`${docId} :: ${snippet || '...'}`);
        if (options.length >= 3) break;
      }
      publishClarification('Znalazlem kilka pasujacych dokumentow. Ktory mam otworzyc?', options);
      return;
    }

    publishClarification('Nie znalazlem dokumentu. Podaj dokladny tytul.');
  };

  return { handleLibraryRead };
}
