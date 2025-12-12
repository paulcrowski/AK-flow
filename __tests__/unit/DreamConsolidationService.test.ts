import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DreamConsolidationService } from '../../services/DreamConsolidationService';
import type { LimbicState, TraitVector } from '../types';

const mockFrom = vi.fn();

vi.mock('../services/supabase', () => ({
    supabase: {
        from: (...args: any[]) => mockFrom(...args)
    },
    getCurrentAgentId: vi.fn(() => 'agent-1'),
    MemoryService: {
        storeMemory: vi.fn().mockResolvedValue(undefined)
    }
}));

const mockStructuredDialogue = vi.fn();

vi.mock('../services/gemini', () => ({
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

    it('returns empty result when no episodes', async () => {
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
            'Test'
        );

        expect(result.episodesProcessed).toBe(0);
        expect(result.lessonsGenerated.length).toBe(0);
        expect(result.selfSummary).toBe('');
        expect(result.traitProposal).toBeNull();
    });
});
