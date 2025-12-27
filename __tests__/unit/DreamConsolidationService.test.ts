import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DreamConsolidationService } from '@services/DreamConsolidationService';
import { eventBus } from '@core/EventBus';
import type { LimbicState, TraitVector } from '@/types';

const mockFrom = vi.fn();
const mockRpc = vi.fn();

vi.mock('@services/supabase', () => ({
    supabase: {
        from: (...args: any[]) => mockFrom(...args),
        rpc: (...args: any[]) => mockRpc(...args)
    },
    getCurrentAgentId: vi.fn(() => 'agent-1'),
    MemoryService: {
        storeMemory: vi.fn().mockResolvedValue(undefined)
    }
}));

const mockStructuredDialogue = vi.fn();

vi.mock('@llm/gemini', () => ({
    CortexService: {
        structuredDialogue: (...args: any[]) => mockStructuredDialogue(...args)
    }
}));

const mockBuildChunk = vi.fn();

vi.mock('@services/SessionChunkService', () => ({
    SessionChunkService: {
        buildAndStoreLatestSessionChunk: (...args: any[]) => mockBuildChunk(...args)
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
        eventBus.clear();
        mockFrom.mockReset();
        mockRpc.mockReset();
        mockStructuredDialogue.mockReset();
        mockBuildChunk.mockReset();
    });

    it('returns empty result when no episodes', async () => {
        mockFrom.mockReturnValue({
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            gte: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue({ data: [], error: null })
        });
        mockBuildChunk.mockResolvedValue(true);
        mockRpc
            .mockResolvedValueOnce({ data: 2, error: null })
            .mockResolvedValueOnce({ data: 1, error: null });

        const result = await DreamConsolidationService.consolidate(
            calmLimbic,
            baseTraits,
            'Test'
        );

        expect(mockBuildChunk).toHaveBeenCalledWith('Test');
        expect(mockRpc).toHaveBeenNthCalledWith(1, 'decay_memories_v1', { p_agent_id: 'agent-1' });
        expect(mockRpc).toHaveBeenNthCalledWith(2, 'prune_memories_v1', { p_agent_id: 'agent-1' });
        expect(result.episodesProcessed).toBe(0);
        expect(result.lessonsGenerated.length).toBe(0);
        expect(result.selfSummary).toBe('');
        expect(result.traitProposal).toBeNull();
        expect(result.sessionChunkCreated).toBe(true);
        expect(result.decayPrune).toEqual({ decayed: 2, pruned: 1 });

        const history = eventBus.getHistory();
        const complete = history.find(p => (p as any)?.payload?.event === 'DREAM_CONSOLIDATION_COMPLETE');
        expect(complete).toBeTruthy();
        expect((complete as any)?.payload?.result?.sessionChunkCreated).toBe(true);
    });
});
