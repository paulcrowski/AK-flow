import { eventBus } from '../core/EventBus';
import { isFeatureEnabled } from '../core/config/featureFlags';
import { AgentType, PacketType } from '../types';
import { MemoryService } from './supabase';
import { generateUUID } from '../utils/uuid';

type SourceRef = { title?: string; uri?: string };

export async function persistSearchKnowledgeChunk(input: {
  query: string;
  synthesis: string;
  sources?: SourceRef[];
}): Promise<void> {
  if (!isFeatureEnabled('USE_SEARCH_KNOWLEDGE_CHUNKS')) return;

  const query = String(input.query || '').trim();
  const synthesis = String(input.synthesis || '').trim();
  const sources = Array.isArray(input.sources) ? input.sources : [];

  if (!query || !synthesis) return;

  // Homeostasis: prevent chunk spam per query (cooldown) + keep weight clamped
  if (isFeatureEnabled('USE_SEARCH_KNOWLEDGE_CHUNK_HOMEOSTASIS')) {
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

  const lines = synthesis
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const summary = lines.slice(0, 14).join('\n');

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

  const content = [
    'KNOWLEDGE_CHUNK (SEARCH)',
    `TOPIC: ${query}`,
    `TS: ${new Date().toISOString()}`,
    '',
    'SUMMARY:',
    summary || synthesisTrimmed,
    '',
    'DETAIL:',
    synthesisTrimmed,
    '',
    sourcesText ? 'SOURCES:' : null,
    sourcesText || null
  ]
    .filter((p) => p !== null)
    .join('\n');

  const strengthFloor = 18;
  const strengthCeiling = 28;
  const neuralStrength = isFeatureEnabled('USE_SEARCH_KNOWLEDGE_CHUNK_HOMEOSTASIS')
    ? Math.max(strengthFloor, Math.min(strengthCeiling, 22))
    : 35;

  try {
    const ok = await MemoryService.storeMemory({
      id: generateUUID(),
      content,
      emotionalContext: { fear: 0, curiosity: 0, frustration: 0, satisfaction: 0 },
      timestamp: new Date().toISOString(),
      neuralStrength,
      isCoreMemory: false
    });

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
