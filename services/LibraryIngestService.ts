import { supabase } from './supabase';
import { CortexService } from './gemini';
import type { LibraryDocument } from './LibraryService';

type Chunk = {
  chunk_index: number;
  start_offset: number;
  end_offset: number;
  content: string;
};

function normalizeNewlines(text: string): string {
  return String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function isMarkdownDoc(doc: LibraryDocument): boolean {
  const name = (doc.original_name || '').toLowerCase();
  const mime = (doc.mime_type || '').toLowerCase();
  return name.endsWith('.md') || mime.includes('markdown');
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

async function downloadDocumentText(doc: LibraryDocument): Promise<string> {
  const dl = await supabase.storage.from(doc.storage_bucket).download(doc.storage_path);
  if (dl.error) throw new Error(dl.error.message);
  return normalizeNewlines(await dl.data.text());
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

    const targetChars = params.targetChars ?? 1400;
    const maxChars = params.maxChars ?? 2400;
    const overlapChars = params.overlapChars ?? 200;

    const chunks = chunkHybrid({
      fullText,
      isMarkdown: isMarkdownDoc(doc),
      targetChars,
      maxChars,
      overlapChars
    });

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

    return { ok: true, chunkCount: chunks.length };
  } catch (err: any) {
    return { ok: false, error: String(err?.message ?? err) };
  }
}
