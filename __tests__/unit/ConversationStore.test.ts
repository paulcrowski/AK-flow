import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  loadConversation,
  saveConversation,
  clearConversation,
  parseConversation,
  syncToLocalStorage,
  type ConversationTurn
} from '@core/memory/ConversationStore';

// Mock localStorage
const mockStorage: Record<string, string> = {};
vi.stubGlobal('localStorage', {
  getItem: vi.fn((key: string) => mockStorage[key] ?? null),
  setItem: vi.fn((key: string, value: string) => { mockStorage[key] = value; }),
  removeItem: vi.fn((key: string) => { delete mockStorage[key]; }),
  clear: vi.fn(() => { Object.keys(mockStorage).forEach(k => delete mockStorage[k]); })
});

// Mock ConversationArchive
vi.mock('@services/ConversationArchive', () => ({
  getConversationHistory: vi.fn(async () => [])
}));

// Mock featureFlags
vi.mock('@core/config/featureFlags', () => ({
  isMemorySubEnabled: vi.fn(() => true),
  isFeatureEnabled: vi.fn(() => true)
}));

describe('ConversationStore', () => {
  beforeEach(() => {
    Object.keys(mockStorage).forEach(k => delete mockStorage[k]);
    vi.clearAllMocks();
  });

  describe('saveConversation + loadConversation', () => {
    it('should save and load conversation from localStorage', async () => {
      const turns: ConversationTurn[] = [
        { role: 'user', text: 'Hello' },
        { role: 'assistant', text: 'Hi there!', type: 'speech', knowledgeSource: 'llm' }
      ];

      saveConversation('agent-123', turns);
      const result = await loadConversation('agent-123');

      expect(result.source).toBe('localStorage');
      expect(result.turns).toHaveLength(2);
      expect(result.turns[0].role).toBe('user');
      expect(result.turns[0].text).toBe('Hello');
      expect(result.turns[1].knowledgeSource).toBe('llm');
    });

    it('should return empty when no data exists', async () => {
      const result = await loadConversation('nonexistent-agent');

      expect(result.source).toBe('empty');
      expect(result.turns).toHaveLength(0);
    });
  });

  describe('clearConversation', () => {
    it('should clear saved conversation', async () => {
      const turns: ConversationTurn[] = [
        { role: 'user', text: 'Test message' }
      ];

      saveConversation('agent-456', turns);
      let result = await loadConversation('agent-456');
      expect(result.turns).toHaveLength(1);

      clearConversation('agent-456');
      result = await loadConversation('agent-456');
      expect(result.turns).toHaveLength(0);
    });
  });

  describe('parseConversation', () => {
    it('should parse valid JSON', () => {
      const raw = JSON.stringify([
        { role: 'user', text: 'Question' },
        { role: 'assistant', text: 'Answer', type: 'speech' }
      ]);

      const turns = parseConversation(raw);

      expect(turns).toHaveLength(2);
      expect(turns[0].role).toBe('user');
      expect(turns[1].type).toBe('speech');
    });

    it('should return empty array for invalid JSON', () => {
      const turns = parseConversation('not valid json');
      expect(turns).toHaveLength(0);
    });

    it('should return empty array for empty input', () => {
      const turns = parseConversation('');
      expect(turns).toHaveLength(0);
    });
  });

  describe('syncToLocalStorage', () => {
    it('should sync React state to localStorage', async () => {
      const conversation = [
        { role: 'user', text: 'Message 1' },
        { role: 'assistant', text: 'Response 1', type: 'speech', knowledgeSource: 'memory' }
      ];

      syncToLocalStorage('agent-789', conversation);
      const result = await loadConversation('agent-789');

      expect(result.turns).toHaveLength(2);
      expect(result.turns[1].knowledgeSource).toBe('memory');
    });

    it('should handle undefined agentId gracefully', () => {
      // Should not throw
      expect(() => syncToLocalStorage(undefined, [])).not.toThrow();
    });
  });

  describe('metadata preservation', () => {
    it('should preserve all metadata fields', async () => {
      const turns: ConversationTurn[] = [
        {
          role: 'assistant',
          text: 'Response with metadata',
          type: 'speech',
          knowledgeSource: 'tool',
          evidenceSource: 'memory',
          evidenceDetail: 'search_result',
          generator: 'llm'
        }
      ];

      saveConversation('agent-meta', turns);
      const result = await loadConversation('agent-meta');

      expect(result.turns[0].knowledgeSource).toBe('tool');
      expect(result.turns[0].evidenceSource).toBe('memory');
      expect(result.turns[0].evidenceDetail).toBe('search_result');
      expect(result.turns[0].generator).toBe('llm');
    });
  });
});
