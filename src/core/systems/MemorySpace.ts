import type { MemoryTrace } from '../../types';
import { MemoryService } from '../../services/supabase';

export interface SemanticSearchProvider {
  semanticSearch: (query: string, opts?: { limit?: number }) => Promise<MemoryTrace[]>;
}

export class TTLCache<V> {
  private store = new Map<string, { value: V; expiresAt: number }>();

  get(key: string): V | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() >= entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: string, value: V, ttlMs: number): void {
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  clear(): void {
    this.store.clear();
  }

  async getOrLoad(key: string, ttlMs: number, loader: () => Promise<V>): Promise<V> {
    const cached = this.get(key);
    if (cached !== undefined) return cached;
    const loaded = await loader();
    this.set(key, loaded, ttlMs);
    return loaded;
  }
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
    coldCache = new TTLCache<unknown>();
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
