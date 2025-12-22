import type { MemoryTrace } from '../../../types';
import { MemoryService, getCurrentAgentId } from '../../../services/supabase';
import type { MemorySpace } from '../MemorySpace';
import { isMemorySubEnabled } from '../../config/featureFlags';
import { eventBus } from '../../EventBus';
import { AgentType, PacketType } from '../../../types';
import { generateUUID } from '../../../utils/uuid';
import { getCurrentTraceId } from '../../trace/TraceContext';

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

  const semanticPromise: Promise<MemoryTrace[]> = prefetchedMemories
    ? Promise.resolve(prefetchedMemories)
    : memorySpace
      ? memorySpace.hot.semanticSearch(queryText)
      : MemoryService.semanticSearch(queryText);

  const wantGlobalBaseline = isMemorySubEnabled('globalRecallDefault');
  const agentIdForCache = memorySpace?.agentId ?? getCurrentAgentId();
  const globalRecentLimit = 12;
  const globalRecentCacheTtlMs = 60_000;
  const globalRecallTimeoutMs = 700;

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

  const [baseMemories, globalRecent] = await Promise.all([semanticPromise, globalRecentPromise]);

  console.log('[MEMORY_RECALL]', {
    query: queryText?.slice(0, 100),
    semanticCount: baseMemories.length,
    globalRecentCount: globalRecent.length,
    semanticSamples: baseMemories.slice(0, 2).map((m: any) => m?.content?.slice(0, 80)),
    recentSamples: globalRecent.slice(0, 2).map((m: any) => m?.content?.slice(0, 80))
  });

  let memories: MemoryTrace[] = baseMemories;

  if (wantGlobalBaseline && globalRecent.length > 0) {
    const merged = [...globalRecent, ...baseMemories];
    const deduped: MemoryTrace[] = [];
    const seen = new Set<string>();
    for (const m of merged) {
      const key = String((m as any)?.id || (m as any)?.content || '');
      if (!key || seen.has(key)) continue;
      seen.add(key);
      deduped.push({
        ...(m as any),
        content: normalizeMemoryText((m as any)?.content)
      });
      if (deduped.length >= 12) break;
    }
    memories = deduped;

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

  if (isMemorySubEnabled('recallRecentFallback')) {
    const q = String(queryText || '').toLowerCase();
    const looksLikeRecallQuestion =
      q.includes('pamiętasz') ||
      q.includes('pamietasz') ||
      q.includes('wczoraj') ||
      q.includes('dzis') ||
      q.includes('dzisiaj') ||
      q.includes('dziś') ||
      q.includes('rozmow') ||
      q.includes('rozmaw');

    if (looksLikeRecallQuestion) {
      try {
        const recent = await MemoryService.recallRecent(8);
        const merged = [...recent, ...memories];
        const deduped: typeof merged = [];
        const seen = new Set<string>();
        for (const m of merged) {
          const key = String((m as any)?.id || (m as any)?.content || '');
          if (!key || seen.has(key)) continue;
          seen.add(key);
          deduped.push(m);
          if (deduped.length >= 12) break;
        }
        memories = deduped as any;
      } catch {
        // silent fallback
      }
    }
  }

  return memories;
}
