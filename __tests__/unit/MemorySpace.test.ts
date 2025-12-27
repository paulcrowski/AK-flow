import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createTTLCache, createMemorySpace } from '@core/systems/MemorySpace';

describe('MemorySpace', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2025-01-01T00:00:00.000Z'));
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('TTLCache should expire entries after ttlMs', async () => {
        const cache = createTTLCache<number>();

        cache.set('a', 123, 1000);
        expect(cache.get('a')).toBe(123);

        vi.advanceTimersByTime(999);
        expect(cache.get('a')).toBe(123);

        vi.advanceTimersByTime(1);
        expect(cache.get('a')).toBeUndefined();
    });

    it('hot.semanticSearch should dedupe in-flight calls and cache settled results per MemorySpace instance', async () => {
        const provider = {
            semanticSearch: vi.fn(async (_query: string, _opts?: { limit?: number }) => {
                await Promise.resolve();
                return [{ content: 'x' } as any];
            })
        };

        const memorySpace = createMemorySpace('test-agent', { semanticSearchProvider: provider });

        const p1 = memorySpace.hot.semanticSearch('Hello', { limit: 4 });
        const p2 = memorySpace.hot.semanticSearch('Hello', { limit: 4 });

        expect(p1).toBe(p2);
        await Promise.all([p1, p2]);
        expect(provider.semanticSearch).toHaveBeenCalledTimes(1);

        await memorySpace.hot.semanticSearch('Hello', { limit: 4 });
        expect(provider.semanticSearch).toHaveBeenCalledTimes(1);

        await memorySpace.hot.semanticSearch('Hello', { limit: 8 });
        expect(provider.semanticSearch).toHaveBeenCalledTimes(2);

        const memorySpace2 = createMemorySpace('test-agent', { semanticSearchProvider: provider });
        await memorySpace2.hot.semanticSearch('Hello', { limit: 4 });
        expect(provider.semanticSearch).toHaveBeenCalledTimes(3);
    });
});
