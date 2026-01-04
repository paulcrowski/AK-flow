import { supabase, MemoryService } from './supabase';
import { CortexService } from '../llm/gemini';
import type { LibraryDocument } from './LibraryService';
import { WorkspaceHomeostasisService } from './WorkspaceHomeostasisService';
import { isMemorySubEnabled } from '../core/config/featureFlags';
import { clampInt } from '../utils/math';
import {
  ACTIVE_LEARNING_TOP_K,
  FAST_INGEST_ACTIVE_LEARNING_LIMIT,
  FAST_INGEST_CHAR_THRESHOLD,
  FAST_INGEST_CHUNK_THRESHOLD,
  MAX_ACTIVE_STRENGTH,
  MAX_CHUNKS_PER_TICK,
  MIN_IMPORTANCE,
  SUMMARY_MAX_OUTPUT_TOKENS
} from './libraryIngest/constants';
import {
  assessChunkImportance,
  calculateActiveLearningBoost,
  calculateNeuralStrength,
  enhanceWithActiveLearning,
  extractDocumentTopics
} from './libraryIngest/analysis';
import { chooseChunkingConfig, chunkHybrid, oneChunk } from './libraryIngest/chunking';
import { downloadDocumentText, isMarkdownDoc } from './libraryIngest/docText';
import { stableUuidLike } from './libraryIngest/hash';
import type { ActiveLearningMetrics } from './libraryIngest/types';

export async function ingestLibraryDocument(params: {
  document: LibraryDocument;
  targetChars?: number;
  maxChars?: number;
  overlapChars?: number;
  onProgress?: (progress: { documentId: string; processedChunks: number; totalChunks: number }) => void;
}): Promise<{ ok: true; chunkCount: number } | { ok: false; error: string }> {
  const doc = params.document;

  try {
    const fullText = await downloadDocumentText(doc);
    if (!fullText.trim()) {
      return { ok: false, error: 'EMPTY_DOCUMENT' };
    }

    const defaults = chooseChunkingConfig(fullText.length);
    const targetChars = params.targetChars ?? defaults.targetChars;
    const maxChars = params.maxChars ?? defaults.maxChars;
    const overlapChars = params.overlapChars ?? defaults.overlapChars;
    const maxChunks = defaults.maxChunks;

    let chunks = defaults.singleChunkBelowChars > 0 && fullText.length <= defaults.singleChunkBelowChars
      ? oneChunk(fullText)
      : chunkHybrid({
          fullText,
          isMarkdown: isMarkdownDoc(doc),
          targetChars,
          maxChars,
          overlapChars
        });

    if (chunks.length > maxChunks && params.targetChars == null && params.maxChars == null) {
      for (let attempt = 0; attempt < 3 && chunks.length > maxChunks; attempt++) {
        const scale = Math.min(6, Math.max(2, Math.ceil(chunks.length / maxChunks)));
        const bumpedTarget = Math.min(20_000, Math.round(targetChars * scale));
        const bumpedMax = Math.min(28_000, Math.round(maxChars * scale));
        const bumpedOverlap = Math.min(2000, Math.round(overlapChars * Math.min(2, scale / 2)));
        chunks = chunkHybrid({
          fullText,
          isMarkdown: isMarkdownDoc(doc),
          targetChars: bumpedTarget,
          maxChars: bumpedMax,
          overlapChars: bumpedOverlap
        });
      }
    }

    if (chunks.length === 0) {
      return { ok: false, error: 'NO_CHUNKS' };
    }

    const totalChunks = chunks.length;
    const isFastIngest = fullText.length >= FAST_INGEST_CHAR_THRESHOLD || totalChunks >= FAST_INGEST_CHUNK_THRESHOLD;
    const cachedSummaryByIndex = new Map<number, { content: string; summary: string }>();
    try {
      const existing = await supabase
        .from('library_chunks')
        .select('chunk_index,content,summary')
        .eq('document_id', doc.id);
      if (!existing.error && Array.isArray(existing.data)) {
        existing.data.forEach((row: any) => {
          const idx = Number(row?.chunk_index);
          if (!Number.isFinite(idx)) return;
          cachedSummaryByIndex.set(idx, {
            content: String(row?.content || ''),
            summary: String(row?.summary || '')
          });
        });
      }
    } catch {
      // ignore cache lookup failures
    }

    const toInsert: any[] = [];
    const summariesForDoc: { summary: string; content: string }[] = [];
    let processedChunks = 0;
    const emitProgress = (processed: number) => {
      params.onProgress?.({
        documentId: doc.id,
        processedChunks: processed,
        totalChunks
      });
    };
    emitProgress(0);

    for (const ch of chunks) {
      let summary = '';
      const cached = cachedSummaryByIndex.get(ch.chunk_index);
      const cachedSummary = String(cached?.summary || '').trim();
      const reuseSummary = cachedSummary && cached?.content === ch.content;
      try {
        if (reuseSummary) {
          summary = cachedSummary;
        } else {
          summary = await CortexService.generateText(
            'summarize_chunk',
            [
              'ROLE: AK-FLOW document ingestor.',
              'TASK: Summarize this chunk of a user document.',
              'CONSTRAINTS:',
              '- Output pure text.',
              '- 2-4 sentences.',
              '- Aim for ~120-200 tokens.',
              '- No markdown, no bullets, no emojis.',
              '- Preserve key nouns and proper names.',
              '',
              'CHUNK:',
              ch.content.slice(0, 8000)
            ].join('\n'),
            { temperature: 0.25, maxOutputTokens: SUMMARY_MAX_OUTPUT_TOKENS }
          );
        }
      } catch {
        summary = '';
      }

      summariesForDoc.push({ summary, content: ch.content });

      toInsert.push({
        document_id: doc.id,
        chunk_index: ch.chunk_index,
        start_offset: ch.start_offset,
        end_offset: ch.end_offset,
        content: ch.content,
        summary,
        chunk_summary: summary,
        token_count: null
      });

      processedChunks += 1;
      emitProgress(processedChunks);
      if (processedChunks % MAX_CHUNKS_PER_TICK === 0) {
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }

    const del = await supabase.from('library_chunks').delete().eq('document_id', doc.id);
    if (del.error) return { ok: false, error: del.error.message };

    const ins = await supabase.from('library_chunks').insert(toInsert);
    if (ins.error) return { ok: false, error: ins.error.message };

    let globalSummary = '';
    try {
      globalSummary = await CortexService.generateText(
        'summarize_doc',
        [
          'ROLE: AK-FLOW document ingestor.',
          'TASK: Produce a compact global summary of the full document based on chunk summaries.',
          'CONSTRAINTS:',
          '- Output pure text.',
          '- 4-7 sentences.',
          '- No markdown, no bullets, no emojis.',
          '',
          'CHUNK SUMMARIES:',
          summariesForDoc
            .map((c, i) => {
              const s = String(c.summary || '').trim();
              const f = String(c.content || '').slice(0, 400).trim();
              const line = s || f;
              return line ? `#${i + 1} ${line}` : '';
            })
            .filter(Boolean)
            .slice(0, 40)
            .join('\n')
        ].join('\n'),
        { temperature: 0.25, maxOutputTokens: 768 }
      );
    } catch {
      globalSummary = '';
    }

    const upd = await supabase
      .from('library_documents')
      .update({
        status: 'ingested',
        ingested_at: new Date().toISOString(),
        global_summary: globalSummary
      })
      .eq('id', doc.id);

    if (upd.error) return { ok: false, error: upd.error.message };

    try {
      const K = 20;
      const neutralEmotion = { fear: 0, curiosity: 0, frustration: 0, satisfaction: 0 };

      const docSummaryText = String(globalSummary || '').trim();
      const summarySeeds = summariesForDoc
        .map((c) => {
          const s = String(c.summary || '').trim();
          if (s) return s;
          return String(c.content || '').slice(0, 180).trim();
        })
        .filter(Boolean)
        .slice(0, 12);
      const fallbackSummary = summarySeeds.join(' ').trim();
      const docSummaryShort = (docSummaryText || fallbackSummary).slice(0, 1200).trim();
      const topics = extractDocumentTopics([doc.original_name, docSummaryShort, ...summarySeeds]);

      if (docSummaryShort) {
        const ingestedContent = [
          'DOCUMENT_INGESTED',
          `doc_id=${doc.id}`,
          `title=${doc.original_name}`,
          `topics=${topics.join(', ')}`,
          '',
          docSummaryShort
        ].join('\n');

        await MemoryService.storeMemory({
          id: stableUuidLike(`workspace:doc_ingested:${doc.id}:${docSummaryShort}`),
          content: ingestedContent,
          emotionalContext: neutralEmotion,
          timestamp: new Date().toISOString(),
          neuralStrength: 4,
          isCoreMemory: false,
          metadata: {
            kind: 'DOCUMENT_INGESTED',
            document_id: doc.id,
            original_name: doc.original_name,
            topics,
            global_summary: docSummaryShort,
            ingested_at: new Date().toISOString(),
            chunk_count: totalChunks
          }
        });
      }

      if (docSummaryText) {
        const content = [
          'WORKSPACE_DOC_SUMMARY',
          `doc_id=${doc.id}`,
          `name=${doc.original_name}`,
          '',
          docSummaryText
        ].join('\n');

        await MemoryService.storeMemory({
          id: stableUuidLike(`workspace:doc:${doc.id}:${docSummaryText}`),
          content,
          emotionalContext: neutralEmotion,
          timestamp: new Date().toISOString(),
          neuralStrength: 3,
          isCoreMemory: false,
          metadata: {
            kind: 'WORKSPACE_DOC_SUMMARY',
            document_id: doc.id,
            original_name: doc.original_name,
            storage_bucket: doc.storage_bucket,
            storage_path: doc.storage_path,
            doc_type: doc.doc_type,
            ingested_at: new Date().toISOString()
          }
        });
      }

      const candidates = chunks
        .map((ch, i) => ({
          chunk_index: ch.chunk_index,
          start_offset: ch.start_offset,
          end_offset: ch.end_offset,
          summary: String(summariesForDoc[i]?.summary || '').trim(),
          content: String(summariesForDoc[i]?.content || ch.content || '').trim()
        }))
        .filter((c) => Boolean(c.summary));

      candidates.sort((a, b) => {
        const dl = b.summary.length - a.summary.length;
        if (dl !== 0) return dl;
        return a.chunk_index - b.chunk_index;
      });

      const selected = candidates.slice(0, K).map((c) => {
        const heur = assessChunkImportance(c.content, c.chunk_index, totalChunks, doc.original_name);
        const baseStrength = calculateNeuralStrength(heur);
        return { ...c, heur, baseStrength };
      });

      const activeLearningLimit = isFastIngest
        ? Math.max(0, Math.min(FAST_INGEST_ACTIVE_LEARNING_LIMIT, ACTIVE_LEARNING_TOP_K))
        : ACTIVE_LEARNING_TOP_K;
      const alEligible = selected
        .filter((c) => c.heur.score >= MIN_IMPORTANCE)
        .sort((a, b) => {
          const ds = b.heur.score - a.heur.score;
          if (ds !== 0) return ds;
          const dl = b.summary.length - a.summary.length;
          if (dl !== 0) return dl;
          return a.chunk_index - b.chunk_index;
        })
        .slice(0, activeLearningLimit);

      const alEligibleIndex = new Set(alEligible.map((c) => c.chunk_index));

      for (const c of selected) {
        let finalStrength = c.baseStrength;
        let alMetrics: ActiveLearningMetrics | undefined;

        if (alEligibleIndex.has(c.chunk_index)) {
          const al = await enhanceWithActiveLearning({
            content: c.content,
            summary: c.summary,
            docName: doc.original_name,
            chunkIndex: c.chunk_index
          });
          if (al.ok && al.metrics) {
            alMetrics = al.metrics;
            const boost = calculateActiveLearningBoost(al.metrics);
            finalStrength = clampInt(c.baseStrength + boost, 3, MAX_ACTIVE_STRENGTH);
          }
        }

        console.log('[LibraryIngest] Chunk', c.chunk_index, 'importance', c.heur.score, 'strength', finalStrength);

        const content = [
          'WORKSPACE_CHUNK_SUMMARY',
          `doc_id=${doc.id}`,
          `chunk_index=${c.chunk_index}`,
          '',
          c.summary
        ].join('\n');

        await MemoryService.storeMemory({
          id: stableUuidLike(`workspace:chunk:${doc.id}:${c.chunk_index}:${c.summary}`),
          content,
          emotionalContext: neutralEmotion,
          timestamp: new Date().toISOString(),
          neuralStrength: finalStrength,
          isCoreMemory: false,
          metadata: {
            kind: 'WORKSPACE_CHUNK_SUMMARY',
            document_id: doc.id,
            original_name: doc.original_name,
            storage_bucket: doc.storage_bucket,
            storage_path: doc.storage_path,
            doc_type: doc.doc_type,
            chunk_index: c.chunk_index,
            start_offset: c.start_offset,
            end_offset: c.end_offset,
            importance_score: c.heur.score,
            is_structural: c.heur.isStructural,
            has_emphasis: c.heur.hasEmphasis,
            active_learning: Boolean(alMetrics),
            al_importance: alMetrics?.importance,
            al_surprise: alMetrics?.surprise,
            al_actionable: alMetrics?.actionable,
            al_concepts: alMetrics?.concepts
          }
        });
      }

      if (isMemorySubEnabled('workspaceHomeostasis')) {
        try {
          await WorkspaceHomeostasisService.applyForCurrentAgent({ maxWorkspaceMemories: 400 });
        } catch {
          // swallow workspace homeostasis errors
        }
      }
    } catch {
      // swallow workspace->memory errors
    }

    return { ok: true, chunkCount: chunks.length };
  } catch (err: any) {
    return { ok: false, error: String(err?.message ?? err) };
  }
}

