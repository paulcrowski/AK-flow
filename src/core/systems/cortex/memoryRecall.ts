import type { MemoryTrace } from '../../../types';
import { MemoryService, getCurrentAgentId } from '../../../services/supabase';
import type { MemorySpace } from '../MemorySpace';
import { isMemorySubEnabled } from '../../config/featureFlags';
import { eventBus } from '../../EventBus';
import { AgentType, PacketType } from '../../../types';
import { generateUUID } from '../../../utils/uuid';
import { getCurrentTraceId } from '../../trace/TraceContext';
import { detectIntent, getRetrievalLimit, type IntentType } from '../IntentDetector';
import { SessionChunkService } from '../../../services/SessionChunkService';
import { fetchIdentityShards } from '../../services/IdentityDataService';

type TimeoutResult<T> = { ok: true; value: T } | { ok: false; reason: 'timeout' | 'error' };

async function withTimeout<T>(p: Promise<T>, timeoutMs: number): Promise<TimeoutResult<T>> {
  try {
    const timeoutSymbol = Symbol('timeout');
    const raced = await Promise.race([
      p,
      new Promise<typeof timeoutSymbol>((resolve) =>
        setTimeout(() => resolve(timeoutSymbol), Math.max(0, timeoutMs))
      )
    ]);

    if (raced === timeoutSymbol) return { ok: false, reason: 'timeout' };
    return { ok: true, value: raced as unknown as T };
  } catch {
    return { ok: false, reason: 'error' };
  }
}

function normalizeMemoryText(input: unknown): string {
  const s = String(input ?? '').trim();
  if (!s) return '';
  return s.length > 900 ? `${s.slice(0, 900)}…` : s;
}

export async function recallMemories(input: {
  queryText: string;
  memorySpace?: MemorySpace;
  prefetchedMemories?: MemoryTrace[];
}): Promise<MemoryTrace[]> {
  const { queryText, memorySpace, prefetchedMemories } = input;

  const intent = detectIntent(queryText);
  const semanticLimit = getRetrievalLimit(intent);
  const structuredRecall = isStructuredRecall(intent);

  const semanticPromise: Promise<MemoryTrace[]> = prefetchedMemories
    ? Promise.resolve(prefetchedMemories)
    : memorySpace
      ? memorySpace.hot.semanticSearch(queryText, { limit: semanticLimit })
      : MemoryService.semanticSearch(queryText, { limit: semanticLimit });

  const agentIdForCache = memorySpace?.agentId ?? getCurrentAgentId();
  const wantGlobalBaseline = !structuredRecall && isMemorySubEnabled('globalRecallDefault');
  const globalRecentLimit = 12;
  const globalRecentCacheTtlMs = 60_000;
  const globalRecallTimeoutMs = 700;
  const sessionChunkLimit = structuredRecall ? getSessionChunkLimit(intent) : 0;
  const identityShardLimit = structuredRecall ? getIdentityShardLimit(intent) : 0;
  const semanticPromptLimit = structuredRecall ? getSemanticPromptLimit(intent) : 12;

  const globalRecentPromise: Promise<MemoryTrace[]> = wantGlobalBaseline && agentIdForCache
    ? (async () => {
        const cache = memorySpace?.cold?.cache;
        const key = `global_recent:${agentIdForCache}:${globalRecentLimit}`;

        const load = async (): Promise<MemoryTrace[]> => {
          const recent = await MemoryService.recallRecent(globalRecentLimit);
          return recent as any as MemoryTrace[];
        };

        const typedCache = cache as unknown as
          | { getOrLoad: (k: string, ttl: number, loader: () => Promise<MemoryTrace[]>) => Promise<MemoryTrace[]> }
          | undefined;

        const p: Promise<MemoryTrace[]> = typedCache
          ? typedCache.getOrLoad(key, globalRecentCacheTtlMs, load)
          : load();

        const startedAt = Date.now();
        const res = await withTimeout(p, globalRecallTimeoutMs);
        if (!res.ok) {
          eventBus.publish({
            id: generateUUID(),
            traceId: getCurrentTraceId() ?? undefined,
            timestamp: Date.now(),
            source: AgentType.CORTEX_FLOW,
            type: PacketType.SYSTEM_ALERT,
            payload: {
              event: 'GLOBAL_RECALL_TIMEOUT',
              reason: res.reason,
              tookMs: Date.now() - startedAt
            },
            priority: 0.2
          });
          return [];
        }
        return Array.isArray(res.value) ? res.value : [];
      })()
    : Promise.resolve([]);

  const sessionChunksPromise = structuredRecall && agentIdForCache && sessionChunkLimit > 0
    ? SessionChunkService.fetchRecentSessionChunks(agentIdForCache, sessionChunkLimit)
    : Promise.resolve([]);

  const identityShardsPromise = structuredRecall && agentIdForCache && identityShardLimit > 0
    ? fetchIdentityShards(agentIdForCache, identityShardLimit)
    : Promise.resolve([]);

  const [baseMemories, globalRecent, sessionChunks, identityShards] = await Promise.all([
    semanticPromise,
    globalRecentPromise,
    sessionChunksPromise,
    identityShardsPromise
  ]);

  let memories: MemoryTrace[] = baseMemories;
  let dbFallbackCount = globalRecent.length;
  let chunkCount = sessionChunks.length;
  let shardCount = identityShards.length;

  if (structuredRecall) {
    const chunkMemories = sessionChunks.map((chunk) => {
      const summary = String(chunk.summary_text || '').trim() || 'session summary';
      const topics = Array.isArray(chunk.topics) && chunk.topics.length > 0
        ? `Topics: ${chunk.topics.slice(0, 8).join(', ')}`
        : '';
      const body = [summary, topics].filter(Boolean).join(' | ');
      const label = chunk.sessionId ? `SESSION_CHUNK (${chunk.sessionId})` : 'SESSION_CHUNK';
      return buildSyntheticMemory(`${label}: ${body}`, chunk.id, chunk.endTime || chunk.startTime);
    });

    const shardMemories = identityShards.map((shard) => {
      const kind = String((shard as any).kind || 'shard');
      const strength = typeof (shard as any).strength === 'number' ? (shard as any).strength : undefined;
      const strengthLabel = strength !== undefined ? `strength ${strength}` : '';
      const isCore = (shard as any).is_core ? 'core' : 'non-core';
      const label = ['IDENTITY_SHARD', kind, isCore, strengthLabel].filter(Boolean).join(' ');
      const content = String((shard as any).content || '').trim();
      return buildSyntheticMemory(`${label}: ${content}`, (shard as any).id, (shard as any).created_at);
    });

    chunkCount = chunkMemories.length;
    shardCount = shardMemories.length;

    const semanticLimited = baseMemories.slice(0, semanticPromptLimit);
    const maxTotal = chunkMemories.length + shardMemories.length + semanticPromptLimit;
    memories = dedupeMemories([...chunkMemories, ...shardMemories, ...semanticLimited], maxTotal);
    dbFallbackCount = 0;
  } else if (wantGlobalBaseline && globalRecent.length > 0) {
    const merged = [...globalRecent, ...baseMemories];
    memories = dedupeMemories(merged, 12);

    eventBus.publish({
      id: generateUUID(),
      traceId: getCurrentTraceId() ?? undefined,
      timestamp: Date.now(),
      source: AgentType.CORTEX_FLOW,
      type: PacketType.SYSTEM_ALERT,
      payload: {
        event: 'GLOBAL_RECALL_USED',
        globalRecentCount: globalRecent.length,
        semanticCount: baseMemories.length,
        mergedCount: memories.length
      },
      priority: 0.2
    });
  }

  if (!structuredRecall && isMemorySubEnabled('recallRecentFallback')) {
    const q = String(queryText || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
    const looksLikeRecallQuestion =
      q.includes('pamietasz') ||
      q.includes('wczoraj') ||
      q.includes('dzis') ||
      q.includes('dzisiaj') ||
      q.includes('rozmow') ||
      q.includes('rozmaw');

    if (looksLikeRecallQuestion) {
      try {
        const recent = await MemoryService.recallRecent(8);
        dbFallbackCount += recent.length;
        const merged = [...recent, ...memories];
        memories = dedupeMemories(merged as MemoryTrace[], 12);
      } catch {
        // silent fallback
      }
    }
  }

  console.log('[MEMORY_RECALL]', {
    query: queryText?.slice(0, 100),
    intent,
    structuredRecall,
    semanticLimit,
    semanticPromptLimit: structuredRecall ? semanticPromptLimit : undefined,
    chunkCount,
    shardCount,
    semanticCount: baseMemories.length,
    dbFallbackCount,
    mergedCount: memories.length,
    semanticSamples: baseMemories.slice(0, 2).map((m: any) => m?.content?.slice(0, 80)),
    recentSamples: globalRecent.slice(0, 2).map((m: any) => m?.content?.slice(0, 80))
  });

  eventBus.publish({
    id: generateUUID(),
    traceId: getCurrentTraceId() ?? undefined,
    timestamp: Date.now(),
    source: AgentType.CORTEX_FLOW,
    type: PacketType.SYSTEM_ALERT,
    payload: {
      event: 'MEMORY_RECALL_COUNTS',
      intent,
      structuredRecall,
      semanticLimit,
      chunkCount,
      shardCount,
      dbFallbackCount,
      semanticCount: baseMemories.length,
      mergedCount: memories.length
    },
    priority: 0.2
  });

  return memories;
}

function buildSyntheticMemory(content: string, id?: string, timestamp?: string): MemoryTrace {
  return {
    id,
    content: normalizeMemoryText(content),
    timestamp: timestamp || new Date().toISOString(),
    emotionalContext: { fear: 0, curiosity: 0, frustration: 0, satisfaction: 0 }
  };
}

function isStructuredRecall(intent: IntentType): boolean {
  return intent === 'RECALL' || intent === 'HISTORY' || intent === 'WORK';
}

function getSessionChunkLimit(intent: IntentType): number {
  switch (intent) {
    case 'RECALL':
      return 8;
    case 'HISTORY':
      return 6;
    case 'WORK':
      return 4;
    default:
      return 0;
  }
}

function getIdentityShardLimit(intent: IntentType): number {
  switch (intent) {
    case 'RECALL':
      return 20;
    case 'HISTORY':
      return 15;
    case 'WORK':
      return 12;
    default:
      return 0;
  }
}

function getSemanticPromptLimit(intent: IntentType): number {
  switch (intent) {
    case 'RECALL':
      return 20;
    case 'HISTORY':
      return 15;
    case 'WORK':
      return 12;
    case 'OPINION':
      return 12;
    default:
      return 12;
  }
}

function dedupeMemories(items: MemoryTrace[], limit: number): MemoryTrace[] {
  const deduped: MemoryTrace[] = [];
  const seen = new Set<string>();
  for (const m of items) {
    const key = String((m as any)?.id || (m as any)?.content || '');
    if (!key || seen.has(key)) continue;
    seen.add(key);
    deduped.push({
      ...(m as any),
      content: normalizeMemoryText((m as any)?.content)
    });
    if (deduped.length >= limit) break;
  }
  return deduped;
}

