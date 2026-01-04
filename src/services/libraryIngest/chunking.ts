import type { Chunk, ChunkingConfig } from './types';

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

export function chunkHybrid(input: {
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

export function chooseChunkingConfig(fullTextLen: number): ChunkingConfig {
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

export function oneChunk(fullText: string): Chunk[] {
  const trimmed = String(fullText || '').trim();
  if (!trimmed) return [];
  const start = Math.max(0, fullText.indexOf(trimmed));
  const end = start + trimmed.length;
  return [{ chunk_index: 0, start_offset: start, end_offset: end, content: trimmed }];
}
