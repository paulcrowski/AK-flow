import { CortexService } from '../../llm/gemini';
import { parseJSONStrict } from '../../llm/gemini/json';
import { clampInt } from '../../utils/math';
import {
  DOCUMENT_TOPIC_MIN_COUNT,
  DOCUMENT_TOPIC_MAX,
  DOCUMENT_TOPIC_STOPWORDS,
  IMPORTANCE_KEYWORDS
} from './constants';
import type { ActiveLearningMetrics, ChunkImportance } from './types';

export function extractDocumentTopics(texts: string[]): string[] {
  const counts = new Map<string, number>();

  for (const raw of texts) {
    const normalized = String(raw || '')
      .toLowerCase()
      .replace(/\[[^\]]+\]/g, ' ')
      .replace(/[^\p{L}0-9]+/gu, ' ');

    const tokens = normalized.split(/\s+/).map((t) => t.trim()).filter(Boolean);
    for (const tok of tokens) {
      if (tok.length < 4) continue;
      if (DOCUMENT_TOPIC_STOPWORDS.has(tok)) continue;
      counts.set(tok, (counts.get(tok) || 0) + 1);
    }
  }

  return [...counts.entries()]
    .filter(([, count]) => count >= DOCUMENT_TOPIC_MIN_COUNT)
    .sort((a, b) => b[1] - a[1])
    .map(([topic]) => topic)
    .slice(0, DOCUMENT_TOPIC_MAX);
}

export function assessChunkImportance(
  content: string,
  chunkIndex: number,
  totalChunks: number,
  docName: string
): ChunkImportance {
  const merged = `${docName}\n${content}`.toLowerCase();
  const introBand = Math.max(1, Math.floor(totalChunks * 0.1));
  const isIntro = chunkIndex <= Math.max(0, introBand - 1);
  const isConclusion = totalChunks > 0 && chunkIndex >= Math.max(0, totalChunks - introBand);
  const isStructural = /(^|\n)\s*(#{1,6}\s+|[-*]\s+|\d+\.\s+)/.test(content);
  const hasEmphasis =
    /(IMPORTANT|CRITICAL|MUST|SHOULD|NOTE|WARNING|UWAGA|TL;DR)/i.test(content) ||
    /\*\*.+\*\*/.test(content) ||
    /!!+/.test(content);
  const keywordHits = IMPORTANCE_KEYWORDS.filter((kw) => merged.includes(kw));

  let score = 1;
  if (isIntro || isConclusion) score += 1;
  if (keywordHits.length > 0) score += 1;
  if (keywordHits.length >= 3) score += 1;
  if (isStructural) score += 1;
  if (hasEmphasis) score += 1;
  score = clampInt(score, 1, 5);

  return {
    score,
    isStructural,
    hasEmphasis,
    isIntro,
    isConclusion,
    keywordHits: Array.from(new Set(keywordHits))
  };
}

export function calculateNeuralStrength(heur: ChunkImportance): number {
  const base = 3 + (heur.score - 1) * 1.5;
  const structuralBoost = heur.isStructural ? 0.6 : 0;
  const emphasisBoost = heur.hasEmphasis ? 0.6 : 0;
  return clampInt(Math.round(base + structuralBoost + emphasisBoost), 3, 9);
}

export function calculateActiveLearningBoost(metrics: ActiveLearningMetrics): number {
  const importanceBoost = metrics.importance - 3;
  const surpriseBoost = metrics.surprise - 3;
  const actionableBoost = metrics.actionable - 3;
  const raw = importanceBoost + 0.5 * (surpriseBoost + actionableBoost);
  return Math.max(0, Math.round(raw));
}

export async function enhanceWithActiveLearning(input: {
  content: string;
  summary: string;
  docName: string;
  chunkIndex: number;
}): Promise<{ ok: boolean; metrics?: ActiveLearningMetrics; error?: string }> {
  try {
    const docName = String(input.docName || 'document').slice(0, 120);
    const summary = String(input.summary || '').slice(0, 1200);
    const content = String(input.content || '').slice(0, 2000);
    const prompt = [
      'ROLE: AK-FLOW chunk evaluator.',
      'TASK: Score this chunk for memory recall priority.',
      'RETURN JSON ONLY:',
      '{"importance":1-5,"surprise":1-5,"actionable":1-5,"concepts":["..."]}',
      'CONSTRAINTS:',
      '- concepts: up to 6 short phrases',
      '- no markdown, no extra keys',
      `DOC_NAME: ${docName}`,
      `CHUNK_INDEX: ${input.chunkIndex}`,
      'SUMMARY:',
      summary,
      'CONTENT:',
      content
    ].join('\n');

    const raw = await CortexService.generateText('chunk_active_learning', prompt, {
      temperature: 0.2,
      maxOutputTokens: 512
    });

    const parseResult = parseJSONStrict<ActiveLearningMetrics>(raw, (data) => {
      if (!data || typeof data !== 'object') return false;
      const typed = data as Record<string, unknown>;
      return (
        typeof typed.importance === 'number' &&
        typeof typed.surprise === 'number' &&
        typeof typed.actionable === 'number' &&
        Array.isArray(typed.concepts)
      );
    });

    if (!parseResult.success || !parseResult.data) {
      return { ok: false, error: parseResult.error || 'parse_failed' };
    }

    const metrics = parseResult.data;
    const concepts = Array.isArray(metrics.concepts)
      ? metrics.concepts
          .map((c) => String(c || '').trim())
          .filter(Boolean)
          .slice(0, 6)
      : [];

    return {
      ok: true,
      metrics: {
        importance: clampInt(metrics.importance, 1, 5),
        surprise: clampInt(metrics.surprise, 1, 5),
        actionable: clampInt(metrics.actionable, 1, 5),
        concepts
      }
    };
  } catch (err) {
    return { ok: false, error: String((err as Error)?.message || err) };
  }
}
