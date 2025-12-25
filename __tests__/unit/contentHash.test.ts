import { beforeAll, describe, it, expect } from 'vitest';
import { contentHash } from '@utils/contentHash';

async function ensureCrypto(): Promise<void> {
  if (globalThis.crypto?.subtle) return;
  const { webcrypto } = await import('crypto');
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
}

describe('contentHash', () => {
  beforeAll(async () => {
    await ensureCrypto();
  });

  it('returns stable hash for normalized content', async () => {
    const h1 = await contentHash('agent-1', 'Hello   world');
    const h2 = await contentHash('agent-1', 'hello world');
    expect(h1).toBe(h2);
  });

  it('changes hash across different agents', async () => {
    const h1 = await contentHash('agent-1', 'same content');
    const h2 = await contentHash('agent-2', 'same content');
    expect(h1).not.toBe(h2);
  });
});
