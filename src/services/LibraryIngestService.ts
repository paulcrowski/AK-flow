import { supabase, MemoryService } from './supabase';
import { CortexService } from '../llm/gemini';
import type { LibraryDocument } from './LibraryService';
import { WorkspaceHomeostasisService } from './WorkspaceHomeostasisService';
import { isMemorySubEnabled } from '../core/config/featureFlags';
import { clampInt } from '../utils/math';

type Chunk = {
  chunk_index: number;
  start_offset: number;
  end_offset: number;
  content: string;
};

type ChunkingConfig = {
  targetChars: number;
  maxChars: number;
  overlapChars: number;
  maxChunks: number;
  singleChunkBelowChars: number;
};

function stableHex32(input: string): string {
  const s = String(input || '');
  let h1 = 0x811c9dc5;
  let h2 = 0x811c9dc5;
  let h3 = 0x811c9dc5;
  let h4 = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 ^= c;
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= c;
    h2 = Math.imul(h2, 0x01000197);
    h3 ^= c;
    h3 = Math.imul(h3, 0x0100019b);
    h4 ^= c;
    h4 = Math.imul(h4, 0x010001a1);
  }
  const to8 = (n: number) => (n >>> 0).toString(16).padStart(8, '0');
  return `${to8(h1)}${to8(h2)}${to8(h3)}${to8(h4)}`;
}

function stableUuidLike(input: string): string {
  const hex = stableHex32(input);
  const a = hex.slice(0, 8);
  const b = hex.slice(8, 12);
  const c = `4${hex.slice(13, 16)}`;
  const d = `a${hex.slice(17, 20)}`;
  const e = hex.slice(20, 32);
  return `${a}-${b}-${c}-${d}-${e}`;
}

function normalizeNewlines(text: string): string {
  return String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function isMarkdownDoc(doc: LibraryDocument): boolean {
  const name = (doc.original_name || '').toLowerCase();
  const mime = (doc.mime_type || '').toLowerCase();
  return name.endsWith('.md') || mime.includes('markdown');
}

function isJsonDoc(doc: LibraryDocument): boolean {
  const name = (doc.original_name || '').toLowerCase();
  const mime = (doc.mime_type || '').toLowerCase();
  return name.endsWith('.json') || mime.includes('application/json') || mime.endsWith('+json');
}

function splitMarkdownIntoBlocks(text: string): { start: number; end: number; text: string }[] {
  const blocks: { start: number; end: number; text: string }[] = [];
  const lines = text.split('\n');

  let currentStart = 0;
  let current: string[] = [];

  const flush = (endOffsetExclusive: number) => {
    const content = current.join('\n').trim();
    if (content) {
      const start = currentStart;
      const end = endOffsetExclusive;
      blocks.push({ start, end, text: content });
    }
  };

  let offset = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isHeading = /^#{1,6}\s+/.test(line);

    if (isHeading && current.length > 0) {
      flush(offset);
      current = [];
      currentStart = offset;
    }

    current.push(line);
    offset += line.length + 1;
  }

  flush(Math.max(0, text.length));
  return blocks;
}

function splitTextIntoBlocks(text: string): { start: number; end: number; text: string }[] {
  const blocks: { start: number; end: number; text: string }[] = [];
  const re = /\n{2,}/g;

  let lastIndex = 0;
  for (;;) {
    const m = re.exec(text);
    if (!m) break;

    const piece = text.slice(lastIndex, m.index).trim();
    if (piece) {
      blocks.push({ start: lastIndex, end: m.index, text: piece });
    }

    lastIndex = m.index + m[0].length;
  }

  const tail = text.slice(lastIndex).trim();
  if (tail) {
    blocks.push({ start: lastIndex, end: text.length, text: tail });
  }

  return blocks;
}

function fixedSizeSplit(text: string, startOffset: number, maxChars: number, overlap: number): { start: number; end: number; text: string }[] {
  const out: { start: number; end: number; text: string }[] = [];
  const step = Math.max(1, maxChars - overlap);
  for (let i = 0; i < text.length; i += step) {
    const slice = text.slice(i, i + maxChars);
    const trimmed = slice.trim();
    if (!trimmed) continue;
    out.push({ start: startOffset + i, end: startOffset + Math.min(i + maxChars, text.length), text: trimmed });
    if (i + maxChars >= text.length) break;
  }
  return out;
}

function chunkHybrid(input: {
  fullText: string;
  isMarkdown: boolean;
  targetChars: number;
  maxChars: number;
  overlapChars: number;
}): Chunk[] {
  const { fullText, isMarkdown, targetChars, maxChars, overlapChars } = input;
  const blocks = isMarkdown ? splitMarkdownIntoBlocks(fullText) : splitTextIntoBlocks(fullText);

  const chunks: Chunk[] = [];
  let idx = 0;

  let bufText = '';
  let bufStart = -1;
  let bufEnd = -1;

  const flushBuf = () => {
    const content = bufText.trim();
    if (content) {
      chunks.push({ chunk_index: idx++, start_offset: Math.max(0, bufStart), end_offset: Math.max(0, bufEnd), content });
    }
    bufText = '';
    bufStart = -1;
    bufEnd = -1;
  };

  for (const b of blocks) {
    const bText = String(b.text || '').trim();
    if (!bText) continue;

    if (bText.length > maxChars) {
      flushBuf();
      const splits = fixedSizeSplit(bText, b.start, maxChars, overlapChars);
      for (const s of splits) {
        chunks.push({ chunk_index: idx++, start_offset: s.start, end_offset: s.end, content: s.text });
      }
      continue;
    }

    if (!bufText) {
      bufText = bText;
      bufStart = b.start;
      bufEnd = b.end;
      continue;
    }

    if (bufText.length + 2 + bText.length <= targetChars) {
      bufText = `${bufText}\n\n${bText}`;
      bufEnd = b.end;
      continue;
    }

    flushBuf();
    bufText = bText;
    bufStart = b.start;
    bufEnd = b.end;
  }

  flushBuf();
  return chunks;
}

function chooseChunkingConfig(fullTextLen: number): ChunkingConfig {
  if (fullTextLen <= 4000) {
    return {
      targetChars: 8000,
      maxChars: 12000,
      overlapChars: 0,
      maxChunks: 20,
      singleChunkBelowChars: 4000
    };
  }

  if (fullTextLen <= 40_000) {
    return {
      targetChars: 2600,
      maxChars: 4200,
      overlapChars: 240,
      maxChunks: 60,
      singleChunkBelowChars: 0
    };
  }

  if (fullTextLen <= 200_000) {
    return {
      targetChars: 5200,
      maxChars: 8200,
      overlapChars: 420,
      maxChunks: 80,
      singleChunkBelowChars: 0
    };
  }

  return {
    targetChars: 8200,
    maxChars: 12000,
    overlapChars: 600,
    maxChunks: 100,
    singleChunkBelowChars: 0
  };
}

function oneChunk(fullText: string): Chunk[] {
  const trimmed = String(fullText || '').trim();
  if (!trimmed) return [];
  const start = Math.max(0, fullText.indexOf(trimmed));
  const end = start + trimmed.length;
  return [{ chunk_index: 0, start_offset: start, end_offset: end, content: trimmed }];
}

async function downloadDocumentText(doc: LibraryDocument): Promise<string> {
  const dl = await supabase.storage.from(doc.storage_bucket).download(doc.storage_path);
  if (dl.error) throw new Error(dl.error.message);

  const raw = normalizeNewlines(await dl.data.text());
  if (isJsonDoc(doc)) {
    try {
      if (raw.length <= 2_000_000) {
        const parsed = JSON.parse(raw);
        return normalizeNewlines(JSON.stringify(parsed, null, 2));
      }
    } catch {
      return raw;
    }
  }
  return raw;
}

export async function ingestLibraryDocument(params: {
  document: LibraryDocument;
  targetChars?: number;
  maxChars?: number;
  overlapChars?: number;
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

    const toInsert: any[] = [];
    const summariesForDoc: { summary: string; content: string }[] = [];

    for (const ch of chunks) {
      let summary = '';
      try {
        summary = await CortexService.generateText(
          'summarize_chunk',
          [
            'ROLE: AK-FLOW document ingestor.',
            'TASK: Summarize this chunk of a user document.',
            'CONSTRAINTS:',
            '- Output pure text.',
            '- 2-4 sentences.',
            '- No markdown, no bullets, no emojis.',
            '- Preserve key nouns and proper names.',
            '',
            'CHUNK:',
            ch.content.slice(0, 8000)
          ].join('\n'),
          { temperature: 0.25, maxOutputTokens: 512 }
        );
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
          summary: String(summariesForDoc[i]?.summary || '').trim()
        }))
        .filter((c) => Boolean(c.summary));

      candidates.sort((a, b) => {
        const dl = b.summary.length - a.summary.length;
        if (dl !== 0) return dl;
        return a.chunk_index - b.chunk_index;
      });

      for (const c of candidates.slice(0, K)) {
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
          skipEmbedding: true,
          emotionalContext: neutralEmotion,
          timestamp: new Date().toISOString(),
          neuralStrength: clampInt(1 + Math.min(3, Math.floor(c.summary.length / 200)), 1, 4),
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
            end_offset: c.end_offset
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
