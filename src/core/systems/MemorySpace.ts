import type { MemoryTrace } from '../../types';
import { MemoryService } from '../../services/supabase';

export interface SemanticSearchProvider {
  semanticSearch: (query: string, opts?: { limit?: number }) => Promise<MemoryTrace[]>;
}

export type TTLCache<V> = {
  get: (key: string) => V | undefined;
  set: (key: string, value: V, ttlMs: number) => void;
  clear: () => void;
  getOrLoad: (key: string, ttlMs: number, loader: () => Promise<V>) => Promise<V>;
};

export function createTTLCache<V>(): TTLCache<V> {
  const store = new Map<string, { value: V; expiresAt: number }>();

  const get = (key: string): V | undefined => {
    const entry = store.get(key);
    if (!entry) return undefined;
    if (Date.now() >= entry.expiresAt) {
      store.delete(key);
      return undefined;
    }
    return entry.value;
  };

  const set = (key: string, value: V, ttlMs: number): void => {
    store.set(key, { value, expiresAt: Date.now() + ttlMs });
  };

  const clear = (): void => {
    store.clear();
  };

  const getOrLoad = async (key: string, ttlMs: number, loader: () => Promise<V>): Promise<V> => {
    const cached = get(key);
    if (cached !== undefined) return cached;
    const loaded = await loader();
    set(key, loaded, ttlMs);
    return loaded;
  };

  return { get, set, clear, getOrLoad };
}

export interface MemorySpace {
  agentId: string;
  cold: { cache: TTLCache<unknown> };
  hot: {
    semanticSearch: (query: string, opts?: { limit?: number }) => Promise<MemoryTrace[]>;
  };
}

const coldCacheByAgentId = new Map<string, TTLCache<unknown>>();

export function createMemorySpace(
  agentId: string,
  deps?: { semanticSearchProvider?: SemanticSearchProvider }
): MemorySpace {
  let coldCache = coldCacheByAgentId.get(agentId);
  if (!coldCache) {
    coldCache = createTTLCache<unknown>();
    coldCacheByAgentId.set(agentId, coldCache);
  }

  const provider = deps?.semanticSearchProvider ?? MemoryService;
  const inFlight = new Map<string, Promise<MemoryTrace[]>>();
  const resolved = new Map<string, MemoryTrace[]>();

  const hotSemanticSearch = (query: string, opts?: { limit?: number }): Promise<MemoryTrace[]> => {
    const limit = Math.max(1, Math.min(opts?.limit ?? 4, 60));
    const key = `${limit}:${query.trim().toLowerCase()}`;

    const cached = resolved.get(key);
    if (cached) return Promise.resolve(cached);

    const existing = inFlight.get(key);
    if (existing) return existing;

    const p = provider
      .semanticSearch(query, { limit })
      .catch(() => [] as MemoryTrace[])
      .then((results) => {
        resolved.set(key, results);
        return results;
      })
      .finally(() => {
        inFlight.delete(key);
      });

    inFlight.set(key, p);
    return p;
  };

  return {
    agentId,
    cold: { cache: coldCache },
    hot: { semanticSearch: hotSemanticSearch }
  };
}
