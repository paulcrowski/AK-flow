import { describe, it, expect } from 'vitest';
import { extractFactsFromSynthesis, buildSearchKnowledgeChunkContent } from '@services/SearchKnowledgeChunker';

describe('SearchKnowledgeChunker', () => {
  describe('extractFactsFromSynthesis', () => {
    it('should extract numeric/time/unit facts and dedupe', () => {
      const synthesis = [
        'INTELLIGENCE BRIEFING: Example Topic',
        'The Maldives are the lowest-lying country in the world (avg. elevation ~1.5 m above sea level).',
        'They consist of 26 atolls and around 1,190 islands.',
        'Temperatures are typically 25-30Â°C year-round.',
        'Temperatures are typically 25-30Â°C year-round.',
        'Tourism revenue reached 3.2 mld USD in 2023.',
        'A poetic line without any measurable details.'
      ].join('\n');

      const facts = extractFactsFromSynthesis(synthesis, 10);

      expect(facts.length).toBeGreaterThan(0);
      // Should dedupe duplicated sentence
      const tempFacts = facts.filter((f) => f.includes('25-30'));
      expect(tempFacts.length).toBe(1);

      // Prefer numeric/unit facts
      const joined = facts.join(' | ');
      expect(joined).toContain('1.5');
      expect(joined).toContain('26');
      expect(joined).toContain('Â°C');
    });
  });

  describe('buildSearchKnowledgeChunkContent', () => {
    it('should include FACTS section when facts exist', () => {
      const synthesis = [
        'Deep Research Sweep Intelligence Briefing: Example Topic.',
        'Temperatures are typically 25-30Â°C year-round.',
        'They consist of 26 atolls.'
      ].join('\n');

      const content = buildSearchKnowledgeChunkContent({
        query: 'example',
        synthesis,
        sources: [{ title: 'Example', uri: 'https://example.com' }],
        timestampIso: '2025-12-17T00:00:00.000Z',
        maxFacts: 10
      });

      expect(content).toContain('KNOWLEDGE_CHUNK (SEARCH)');
      expect(content).toContain('TOPIC: example');
      expect(content).toContain('TS: 2025-12-17T00:00:00.000Z');
      expect(content).toContain('\nFACTS:\n');
      expect(content).toContain('- Temperatures');
      expect(content).toContain('- They consist of 26 atolls.');
      expect(content).toContain('SOURCES:');
      expect(content).toContain('https://example.com');
    });

    it('should omit FACTS section when none extracted', () => {
      const synthesis = 'A purely abstract statement with no measurable details.';

      const content = buildSearchKnowledgeChunkContent({
        query: 'abstract',
        synthesis,
        sources: [],
        timestampIso: '2025-12-17T00:00:00.000Z',
        maxFacts: 10
      });

      expect(content).toContain('KNOWLEDGE_CHUNK (SEARCH)');
      expect(content).toContain('DETAIL:');
      expect(content).not.toContain('\nFACTS:\n');
    });
  });
});
