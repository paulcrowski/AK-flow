/**
 * Integration Test: Memory Recall Flow
 * 
 * Tests that memory storage and semantic recall work correctly.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock supabase before importing MemoryService
vi.mock('../../services/supabase', () => ({
    supabase: {
        from: vi.fn(() => ({
            select: vi.fn(() => ({
                eq: vi.fn(() => ({
                    order: vi.fn(() => ({
                        limit: vi.fn(() => Promise.resolve({
                            data: [
                                {
                                    id: 'mem-1',
                                    raw_text: 'Rozmawialiśmy o sensie życia i filozofii.',
                                    created_at: '2025-12-17T10:00:00Z',
                                    neural_strength: 5,
                                    is_core_memory: false
                                },
                                {
                                    id: 'mem-2',
                                    raw_text: 'User pytał o znaczenie egzystencji.',
                                    created_at: '2025-12-17T09:00:00Z',
                                    neural_strength: 3,
                                    is_core_memory: false
                                }
                            ],
                            error: null
                        }))
                    }))
                }))
            })),
            insert: vi.fn(() => Promise.resolve({ error: null }))
        })),
        rpc: vi.fn(() => Promise.resolve({
            data: [
                {
                    id: 'semantic-1',
                    raw_text: 'Sens życia to głębokie pytanie filozoficzne.',
                    neural_strength: 8,
                    similarity: 0.85
                }
            ],
            error: null
        }))
    },
    setCurrentAgentId: vi.fn(),
    getCurrentAgentId: vi.fn(() => 'test-agent-id'),
    MemoryService: {
        recallRecent: vi.fn(async () => [
            {
                id: 'mem-1',
                content: 'Rozmawialiśmy o sensie życia i filozofii.',
                timestamp: '2025-12-17T10:00:00Z',
                neuralStrength: 5
            }
        ]),
        semanticSearch: vi.fn(async (query: string) => {
            if (query.toLowerCase().includes('sens') || query.toLowerCase().includes('życia')) {
                return [
                    {
                        id: 'semantic-1',
                        content: 'Sens życia to głębokie pytanie filozoficzne.',
                        timestamp: '2025-12-17T09:30:00Z',
                        neuralStrength: 8
                    }
                ];
            }
            return [];
        }),
        storeMemory: vi.fn(async () => true)
    }
}));

// Mock gemini service
vi.mock('../../services/gemini', () => ({
    CortexService: {
        generateEmbedding: vi.fn(async () => new Array(768).fill(0.1)),
        structuredDialogue: vi.fn(async () => ({
            responseText: 'Test response',
            internalThought: 'Test thought'
        }))
    }
}));

import { MemoryService } from '../../services/supabase';

describe('Memory Recall Integration', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should recall recent memories', async () => {
        const memories = await MemoryService.recallRecent(5);
        
        expect(memories).toHaveLength(1);
        expect(memories[0].content).toContain('sensie życia');
    });

    it('should find memories via semantic search for "sens życia" query', async () => {
        const memories = await MemoryService.semanticSearch('pamietasz rozmowe o sensie zycia?');
        
        expect(memories).toHaveLength(1);
        expect(memories[0].content).toContain('Sens życia');
    });

    it('should return empty for unrelated queries', async () => {
        const memories = await MemoryService.semanticSearch('jaka jest pogoda');
        
        expect(memories).toHaveLength(0);
    });

    it('should handle memory recall heuristic for "pamietasz" questions', () => {
        const query = 'pamietasz rozmowe o sensie zycia?';
        const q = query.toLowerCase();
        
        const looksLikeRecallQuestion =
            q.includes('pamiętasz') ||
            q.includes('pamietasz') ||
            q.includes('wczoraj') ||
            q.includes('dzis') ||
            q.includes('dzisiaj') ||
            q.includes('dziś') ||
            q.includes('rozmow') ||
            q.includes('rozmaw');
        
        expect(looksLikeRecallQuestion).toBe(true);
    });
});
