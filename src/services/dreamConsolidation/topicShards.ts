import type { LimbicState } from '../../types';

const TOPIC_SHARD_MAX_INPUT_MEMORIES = 60;
const TOPIC_SHARD_MAX_TOPICS = 3;
const TOPIC_SHARD_COOLDOWN_MS = 12 * 60 * 60 * 1000;
const TOPIC_STRENGTH_FLOOR = 14;
const TOPIC_STRENGTH_CEILING = 24;

const TOPIC_STOPWORDS = new Set([
  'i','a','o','u','w','z','na','do','od','po','za','ze','że','to','ten','ta','te','jak','co','czy','się','sie',
  'jest','był','byla','bylo','były','byly','byc','być','mam','mamy','masz','macie','jestem','są','sa',
  'dla','tobie','ciebie','mnie','mi','ty','ja','my','wy','on','ona','ono','oni','one',
  'już','juz','dzis','dziś','dzisiaj','wczoraj','jutro','teraz','tam','tu','tutaj','taki','taka','takie',
  'bardzo','super','fajnie','no','hmm'
]);

function normalizeTopicToken(token: string): string {
  const t = token.toLowerCase();
  if (t === 'fizykja') return 'fizyka';
  if (t === 'fizyczna' || t === 'fizycznej' || t === 'fizykę' || t === 'fizyke') return 'fizyka';
  return t;
}

function extractTopTopicsFromTexts(texts: string[]): Array<{ topic: string; count: number }> {
  const counts = new Map<string, number>();

  for (const raw of texts) {
    const text = String(raw || '')
      .toLowerCase()
      .replace(/\[[^\]]+\]/g, ' ')
      .replace(/[^a-z0-9ąćęłńóśźż]+/gi, ' ');

    const tokens = text.split(/\s+/).map((t) => t.trim()).filter(Boolean);
    for (const tok0 of tokens) {
      const tok = normalizeTopicToken(tok0);
      if (tok.length < 4) continue;
      if (TOPIC_STOPWORDS.has(tok)) continue;
      counts.set(tok, (counts.get(tok) || 0) + 1);
    }
  }

  const scored = [...counts.entries()]
    .map(([topic, count]) => ({ topic, count }))
    .filter((x) => x.count >= 3)
    .sort((a, b) => b.count - a.count);

  return scored.slice(0, TOPIC_SHARD_MAX_TOPICS);
}

function getTopicCooldownKey(agentId: string, topic: string): string {
  return `ak-flow:dreamTopicShard:last:${agentId}:${topic}`;
}

export async function storeTopicShardsFromRecent(deps: {
  agentId: string;
  limbic: LimbicState;
  memoryService: {
    recallRecent: (limit: number) => Promise<any[]>;
    storeMemory: (payload: any) => Promise<{ memoryId: string | null; skipped: boolean }>;
  };
  eventBus: { publish: (packet: any) => void };
  generateUUID: () => string;
  agentTypeMemoryEpisodic: any;
  packetTypeSystemAlert: any;
}): Promise<void> {
  const { agentId, limbic, memoryService, eventBus, generateUUID, agentTypeMemoryEpisodic, packetTypeSystemAlert } = deps;

  try {
    const recent = await memoryService.recallRecent(TOPIC_SHARD_MAX_INPUT_MEMORIES);
    const texts = (recent || []).map((m: any) => String(m?.content || '')).filter(Boolean);

    const topics = extractTopTopicsFromTexts(texts);
    if (topics.length === 0) return;

    let stored = 0;
    const now = Date.now();

    for (const t of topics) {
      try {
        if (typeof localStorage !== 'undefined') {
          const k = getTopicCooldownKey(agentId, t.topic);
          const last = Number(localStorage.getItem(k) || '0');
          if (Number.isFinite(last) && last > 0 && now - last < TOPIC_SHARD_COOLDOWN_MS) {
            continue;
          }
          localStorage.setItem(k, String(now));
        }
      } catch {
        // ignore localStorage issues
      }

      const strengthRaw = TOPIC_STRENGTH_FLOOR + Math.min(10, Math.max(0, t.count - 3));
      const neuralStrength = Math.max(TOPIC_STRENGTH_FLOOR, Math.min(TOPIC_STRENGTH_CEILING, strengthRaw));

      const storeResult = await memoryService.storeMemory({
        id: generateUUID(),
        content: `TOPIC_SHARD: ${t.topic}\nCOUNT_24H: ${t.count}`,
        emotionalContext: limbic,
        timestamp: new Date().toISOString(),
        neuralStrength,
        isCoreMemory: false,
        metadata: {
          origin: 'dream',
          kind: 'TOPIC_SHARD',
          topic: t.topic,
          count_24h: t.count
        }
      } as any);

      const ok = Boolean(storeResult.memoryId) || storeResult.skipped;
      if (ok) {
        stored++;
        eventBus.publish({
          id: generateUUID(),
          timestamp: Date.now(),
          source: agentTypeMemoryEpisodic,
          type: packetTypeSystemAlert,
          payload: { event: 'DREAM_TOPIC_SHARD_STORED', topic: t.topic, count: t.count, neuralStrength },
          priority: 0.2
        });
      }
    }

    if (stored > 0) {
      eventBus.publish({
        id: generateUUID(),
        timestamp: Date.now(),
        source: agentTypeMemoryEpisodic,
        type: packetTypeSystemAlert,
        payload: { event: 'DREAM_TOPIC_SHARDS_STORED', stored, maxTopics: TOPIC_SHARD_MAX_TOPICS },
        priority: 0.2
      });
    }
  } catch (err) {
    eventBus.publish({
      id: generateUUID(),
      timestamp: Date.now(),
      source: agentTypeMemoryEpisodic,
      type: packetTypeSystemAlert,
      payload: { event: 'DREAM_TOPIC_SHARDS_FAIL', error: String((err as any)?.message ?? err) },
      priority: 0.2
    });
  }
}
