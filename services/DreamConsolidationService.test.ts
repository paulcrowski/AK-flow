import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DreamConsolidationService } from './DreamConsolidationService';
import type { LimbicState, TraitVector } from '../types';

// We will override supabase & CortexService behavior per test using mocks
const mockFrom = vi.fn();

vi.mock('./supabase', () => ({
  supabase: {
    from: (...args: any[]) => mockFrom(...args)
  },
  getCurrentAgentId: vi.fn(() => 'agent-1'),
  MemoryService: {
    storeMemory: vi.fn().mockResolvedValue(undefined)
  }
}));

const mockStructuredDialogue = vi.fn();

vi.mock('./gemini', () => ({
  CortexService: {
    structuredDialogue: (...args: any[]) => mockStructuredDialogue(...args)
  }
}));

const calmLimbic: LimbicState = {
  fear: 0.1,
  curiosity: 0.5,
  frustration: 0.1,
  satisfaction: 0.6
};

const baseTraits: TraitVector = {
  arousal: 0.3,
  verbosity: 0.4,
  conscientiousness: 0.7,
  socialAwareness: 0.6,
  curiosity: 0.5
};

describe('DreamConsolidationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReset();
    mockStructuredDialogue.mockReset();
  });

  it('returns empty result when there are no impactful episodes', async () => {
    // supabase.memories -> []
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [], error: null })
    });

    const result = await DreamConsolidationService.consolidate(
      calmLimbic,
      baseTraits,
      'Eksperyment'
    );

    expect(result.episodesProcessed).toBe(0);
    expect(result.lessonsGenerated.length).toBe(0);
    expect(result.selfSummary).toBe('');
    expect(result.traitProposal).toBeNull();
  });

  it('generates lessons, self-summary and trait proposal when episodes exist', async () => {
    // Fake two impactful memories
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({
        data: [
          {
            id: 'm1',
            created_at: new Date().toISOString(),
            content: 'User asked a deep question about identity.',
            emotional_context: { fear: 0.1, curiosity: 0.8, frustration: 0.1, satisfaction: 0.7 },
            neural_strength: 0.8,
            lesson: 'I should answer clearly and calmly.',
            tags: ['identity']
          },
          {
            id: 'm2',
            created_at: new Date().toISOString(),
            content: 'Conversation where I felt a bit frustrated by ambiguity.',
            emotional_context: { fear: 0.1, curiosity: 0.6, frustration: 0.5, satisfaction: 0.4 },
            neural_strength: 0.7,
            lesson: 'I should ask clarifying questions earlier.',
            tags: ['frustration']
          }
        ],
        error: null
      })
    });

    // First call: lessons, second call: self-summary
    mockStructuredDialogue
      .mockResolvedValueOnce({
        responseText: 'I learned to be calm.\nI should ask clearer questions.'
      })
      .mockResolvedValueOnce({
        responseText: 'Today I grew as a calm analytical mentor.'
      });

    const result = await DreamConsolidationService.consolidate(
      calmLimbic,
      baseTraits,
      'Eksperyment'
    );

    // Mamy przetworzone epizody
    expect(result.episodesProcessed).toBe(2);
    expect(result.lessonsGenerated.length).toBeGreaterThan(0);
    expect(result.selfSummary.length).toBeGreaterThan(0);

    // Trait proposal powinien istnieć, ale to tylko propozycja
    expect(result.traitProposal).not.toBeNull();
    if (result.traitProposal) {
      expect(result.traitProposal.currentTraits).toEqual(baseTraits);
      // proposedDeltas może być puste lub mieć małe wartości, ale NA PEWNO
      // nie zmieniamy samego TraitVector w miejscu – tylko raportujemy propozycję.
    }
  });
});
