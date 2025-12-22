import { describe, it, expect } from 'vitest';
import {
  getConversationSnapshotStorageKey,
  loadConversationSnapshot,
  parseConversationSnapshot,
  saveConversationSnapshot,
  serializeConversationSnapshot
} from '@core/utils/conversationSnapshot';

describe('conversationSnapshot', () => {
  it('should parse valid snapshot and clamp turns', () => {
    const raw = JSON.stringify([
      { role: 'user', text: 'hi', type: 'speech' },
      { role: 'assistant', text: 'hello', type: 'speech' },
      { role: 'assistant', text: 'thought', type: 'thought' },
    ]);

    const parsed = parseConversationSnapshot(raw, { maxTurns: 2 });
    expect(parsed.length).toBe(2);
    expect(parsed[0].role).toBe('user');
    expect(parsed[1].role).toBe('assistant');
  });

  it('should fail closed on invalid json', () => {
    const parsed = parseConversationSnapshot('{');
    expect(parsed).toEqual([]);
  });

  it('should sanitize control chars and default type', () => {
    const raw = JSON.stringify([
      { role: 'user', text: 'a\u0000b', type: 'nope' },
    ]);

    const parsed = parseConversationSnapshot(raw);
    expect(parsed.length).toBe(1);
    expect(parsed[0].text.includes('\u0000')).toBe(false);
    expect(parsed[0].type).toBe('speech');
  });

  it('serialize+parse roundtrip', () => {
    const s = serializeConversationSnapshot([
      { role: 'user', text: 'hi', type: 'speech' },
      { role: 'assistant', text: 'ok', type: 'speech' }
    ]);

    const parsed = parseConversationSnapshot(s);
    expect(parsed.length).toBe(2);
    expect(parsed[0].role).toBe('user');
    expect(parsed[1].role).toBe('assistant');
  });

  it('getConversationSnapshotStorageKey should be stable', () => {
    expect(getConversationSnapshotStorageKey('abc')).toBe('ak-flow:conversation:abc');
  });

  it('saveConversationSnapshot/loadConversationSnapshot should roundtrip through localStorage', () => {
    const store = new Map<string, string>();
    (globalThis as any).localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        store.set(k, v);
      }
    };

    saveConversationSnapshot('agent1', [
      { role: 'user', text: 'hi', type: 'speech' },
      { role: 'assistant', text: 'ok', type: 'speech' }
    ]);

    const loaded = loadConversationSnapshot('agent1');
    expect(loaded.length).toBe(2);
    expect(loaded[0].role).toBe('user');
    expect(loaded[1].role).toBe('assistant');
  });

  it('loadConversationSnapshot should fail closed when localStorage throws', () => {
    (globalThis as any).localStorage = {
      getItem: () => {
        throw new Error('boom');
      }
    };

    const loaded = loadConversationSnapshot('agent1');
    expect(loaded).toEqual([]);
  });
});
