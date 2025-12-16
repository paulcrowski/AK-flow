import { describe, it, expect } from 'vitest';
import {
  parseConversationSnapshot,
  serializeConversationSnapshot
} from '../../core/utils/conversationSnapshot';

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
});
