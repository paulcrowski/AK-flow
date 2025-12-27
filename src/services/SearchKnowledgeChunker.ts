import { eventBus } from '../core/EventBus';
import { isMemorySubEnabled } from '../core/config/featureFlags';
import { AgentType, PacketType } from '../types';
import { MemoryService } from './supabase';
import { generateUUID } from '../utils/uuid';

type SourceRef = { title?: string; uri?: string };

export function extractFactsFromSynthesis(synthesis: string, maxFacts: number = 10): string[] {
  const text = String(synthesis || '').trim();
  if (!text) return [];

  const rawParts = text
    .replace(/\r/g, '')
    .split(/\n+|(?<=[.!?])\s+(?=[A-ZĄĆĘŁŃÓŚŹŻ0-9])/g)
    .map((p) => p.trim())
    .filter(Boolean);

  const candidates = rawParts
    .map((p) => p.replace(/^[-*•]+\s*/, '').trim())
    .filter((p) => p.length >= 25 && p.length <= 220);

  const unitRe = /(\bkm\b|\bm\b|\bmln\b|\bmld\b|\b%\b|\bUSD\b|\bEUR\b|\bPLN\b|°C|\bCelsjusza\b|\bppm\b|\bkg\b|\bcm\b|\bmm\b|\bha\b)/i;
  const yearRe = /\b(19\d{2}|20\d{2})\b/;
  const properNounPhraseRe = /\b[A-ZĄĆĘŁŃÓŚŹŻ][a-ząćęłńóśźż]{2,}\s+[A-ZĄĆĘŁŃÓŚŹŻ][a-ząćęłńóśźż]{2,}/;

  const scored = candidates.map((fact) => {
    let score = 0;
    if (/\d/.test(fact)) score += 3;
    if (yearRe.test(fact)) score += 2;
    if (unitRe.test(fact)) score += 2;
    if (properNounPhraseRe.test(fact)) score += 2;
    return { fact, score };
  });

  const minScore = 2;

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.fact.length - b.fact.length;
  });

  const seen = new Set<string>();
  const out: string[] = [];

  for (const item of scored) {
    if (item.score < minScore) continue;
    const norm = item.fact
      .toLowerCase()
      .replace(/[^a-z0-9ąćęłńóśźż]+/gi, ' ')
      .trim()
      .slice(0, 120);

    if (!norm) continue;
    if (seen.has(norm)) continue;
    seen.add(norm);

    out.push(item.fact);
    if (out.length >= Math.max(0, maxFacts)) break;
  }

  return out;
}

export function buildSearchKnowledgeChunkContent(input: {
  query: string;
  synthesis: string;
  sources?: SourceRef[];
  timestampIso?: string;
  maxFacts?: number;
}): string {
  const query = String(input.query || '').trim();
  const synthesis = String(input.synthesis || '').trim();
  const sources = Array.isArray(input.sources) ? input.sources : [];
  const ts = input.timestampIso || new Date().toISOString();
  const facts = extractFactsFromSynthesis(synthesis, input.maxFacts ?? 10);

  const lines = synthesis
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const summary = lines.slice(0, 10).join('\n');

  const sourcesText = sources
    .filter(Boolean)
    .slice(0, 12)
    .map((s) => {
      const title = String(s?.title || '').trim();
      const uri = String(s?.uri || '').trim();
      if (title && uri) return `- ${title} — ${uri}`;
      if (uri) return `- ${uri}`;
      if (title) return `- ${title}`;
      return null;
    })
    .filter(Boolean)
    .join('\n');

  const maxSynthesisChars = 2600;
  const synthesisTrimmed = synthesis.length > maxSynthesisChars ? `${synthesis.slice(0, maxSynthesisChars)}…` : synthesis;

  const factsText = facts.length ? facts.map((f) => `- ${f}`).join('\n') : '';

  return [
    'KNOWLEDGE_CHUNK (SEARCH)',
    `TOPIC: ${query}`,
    `TS: ${ts}`,
    '',
    'SUMMARY:',
    summary || synthesisTrimmed,
    '',
    factsText ? 'FACTS:' : null,
    factsText || null,
    factsText ? '' : null,
    'DETAIL:',
    synthesisTrimmed,
    '',
    sourcesText ? 'SOURCES:' : null,
    sourcesText || null
  ]
    .filter((p) => p !== null)
    .join('\n');
}

export async function persistSearchKnowledgeChunk(input: {
  query: string;
  synthesis: string;
  sources?: SourceRef[];
  traceId?: string;
  sessionId?: string;
  toolIntentId?: string;
}): Promise<void> {
  if (!isMemorySubEnabled('searchKnowledgeChunks')) return;

  const query = String(input.query || '').trim();
  const synthesis = String(input.synthesis || '').trim();
  const sources = Array.isArray(input.sources) ? input.sources : [];
  const traceId = input.traceId ? String(input.traceId).trim() : undefined;
  const sessionId = input.sessionId ? String(input.sessionId).trim() : undefined;
  const toolIntentId = input.toolIntentId ? String(input.toolIntentId).trim() : undefined;

  if (!query || !synthesis) return;

  // Homeostasis: prevent chunk spam per query (cooldown) + keep weight clamped
  if (isMemorySubEnabled('chunkHomeostasis')) {
    try {
      if (typeof localStorage !== 'undefined') {
        const key = `ak-flow:searchChunk:last:${query.toLowerCase()}`;
        const last = Number(localStorage.getItem(key) || '0');
        const now = Date.now();
        const cooldownMs = 10 * 60_000;
        if (Number.isFinite(last) && last > 0 && now - last < cooldownMs) {
          eventBus.publish({
            id: generateUUID(),
            timestamp: Date.now(),
            source: AgentType.CORTEX_FLOW,
            type: PacketType.SYSTEM_ALERT,
            payload: {
              event: 'SEARCH_KNOWLEDGE_CHUNK_SKIPPED_COOLDOWN',
              query,
              cooldownMs
            },
            priority: 0.1
          });
          return;
        }
        localStorage.setItem(key, String(now));
      }
    } catch {
      // ignore
    }
  }

  const content = buildSearchKnowledgeChunkContent({
    query,
    synthesis,
    sources,
    timestampIso: new Date().toISOString(),
    maxFacts: 10
  });

  const strengthFloor = 18;
  const strengthCeiling = 28;
  const neuralStrength = isMemorySubEnabled('chunkHomeostasis')
    ? Math.max(strengthFloor, Math.min(strengthCeiling, 22))
    : 35;

  const sourcesForMetadata = sources
    .filter(Boolean)
    .slice(0, 12)
    .map((s) => ({
      title: s?.title ? String(s.title).trim() : undefined,
      uri: s?.uri ? String(s.uri).trim() : undefined
    }));

    try {
      const storeResult = await MemoryService.storeMemory({
        id: generateUUID(),
        content,
        emotionalContext: { fear: 0, curiosity: 0, frustration: 0, satisfaction: 0 },
        timestamp: new Date().toISOString(),
        neuralStrength,
        isCoreMemory: false,
      metadata: {
        origin: 'search',
        kind: 'KNOWLEDGE_CHUNK',
        chunk_version: '1.3',
        query,
        sources: sourcesForMetadata,
        ...(traceId ? { traceId } : {}),
        ...(sessionId ? { session_id: sessionId } : {}),
        ...(toolIntentId ? { tool_intent_id: toolIntentId } : {})
      }
    });

      const ok = Boolean(storeResult.memoryId) || storeResult.skipped;
      eventBus.publish({
        id: generateUUID(),
        timestamp: Date.now(),
        source: AgentType.CORTEX_FLOW,
        type: PacketType.SYSTEM_ALERT,
      payload: ok
        ? { event: 'SEARCH_KNOWLEDGE_CHUNK_STORED', query, sourcesCount: sources.length }
        : { event: 'SEARCH_KNOWLEDGE_CHUNK_FAIL', query, error: 'STORE_MEMORY_FALSE' },
      priority: 0.2
    });
  } catch (err) {
    eventBus.publish({
      id: generateUUID(),
      timestamp: Date.now(),
      source: AgentType.CORTEX_FLOW,
      type: PacketType.SYSTEM_ALERT,
      payload: { event: 'SEARCH_KNOWLEDGE_CHUNK_FAIL', query, error: String((err as any)?.message ?? err) },
      priority: 0.2
    });
  }
}
