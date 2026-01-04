/**
 * DreamConsolidation Service v1
 * 
 * FAZA 5 - Sleep & Memory Consolidation
 * 
 * Odpowiedzialność:
 * 1. Pobiera najważniejsze epizody z dnia (top emocjonalne)
 * 2. Generuje "lekcje dnia" z AI
 * 3. Tworzy self-summary jako core memory
 * 4. PROPOZYCJA zmian TraitVector (tylko log, bez aplikacji)
 * 
 * Zasada: TraitVector NIE jest modyfikowany automatycznie.
 * Agent proponuje zmiany, człowiek decyduje.
 */

import { supabase, getCurrentAgentId, MemoryService } from './supabase';
import { CortexService } from '../llm/gemini';
import { eventBus } from '../core/EventBus';
import { AgentType, PacketType, LimbicState, TraitVector } from '../types';
import { generateUUID } from '../utils/uuid';
import { consolidateIdentity } from '../core/services/IdentityConsolidationService';
import { INITIAL_LIMBIC } from '../core/kernel/initialState';
import { isMainFeatureEnabled } from '../core/config/featureFlags';
import type { ConsolidationEpisode, DreamConsolidationResult, TraitVectorProposal } from './dreamConsolidation/types';
import { recallMostImpactfulEpisodes } from './dreamConsolidation/episodeRecall';
import { generateLessonsFromEpisodes, generateSelfSummaryFromDream } from './dreamConsolidation/aiGeneration';
import { storeSelfSummary } from './dreamConsolidation/storage';
import { storeTopicShardsFromRecent } from './dreamConsolidation/topicShards';
import { proposeTraitChanges } from './dreamConsolidation/traitProposal';
import { SessionChunkService } from './SessionChunkService';
import { SchemaStore } from '../core/memory/SchemaStore';
import { performSleepCycle } from '../core/systems/SleepSystem';
import { tensionRegistry } from '../core/systems/TensionRegistry';
import { DEFAULT_AGENT_ID, getAgentWorldRoot } from '../core/systems/WorldAccess';

// --- TYPES ---

export type { ConsolidationEpisode, DreamConsolidationResult, TraitVectorProposal };

// --- CONSTANTS ---

const MAX_EPISODES_TO_PROCESS = 5;
// Lowered threshold to reduce empty consolidations
const MIN_NEURAL_STRENGTH_FOR_CONSOLIDATION = 5; // Integer 0-100 (percentage)

// --- SERVICE ---

export const DreamConsolidationService = {
    /**
     * Main consolidation function - called when agent enters sleep
     */
    async consolidate(
        currentLimbic: LimbicState,
        currentTraits: TraitVector,
        agentName: string
    ): Promise<DreamConsolidationResult> {
        const agentId = getCurrentAgentId();
        const timestamp = new Date().toISOString();
        const worldRoot = getAgentWorldRoot(agentId || DEFAULT_AGENT_ID);
        const schemaStore = new SchemaStore(worldRoot);

        const runSleepCycle = async () => {
            try {
                await performSleepCycle({
                    store: schemaStore,
                    usedSchemaIds: [],
                    tensionRegistry,
                    errors: []
                });
            } catch (error) {
                console.warn('[DreamConsolidation] SleepSystem failed:', error);
            }
        };

        console.log('💤 [DreamConsolidation] Starting sleep consolidation...');

        // Publish start event
        eventBus.publish({
            id: generateUUID(),
            timestamp: Date.now(),
            source: AgentType.MEMORY_EPISODIC,
            type: PacketType.SYSTEM_ALERT,
            payload: {
                event: 'DREAM_CONSOLIDATION_START',
                agentId,
                agentName,
                currentLimbic,
                currentTraits
            },
            priority: 0.8
        });

        let sessionChunkCreated = false;
        let decayPrune = { decayed: 0, pruned: 0 };

        try {
            try {
                sessionChunkCreated = await SessionChunkService.buildAndStoreLatestSessionChunk(agentName);
            } catch (e) {
                console.warn('[DreamConsolidation] SessionChunk failed:', e);
            }

            try {
                if (agentId) {
                    const d = await supabase.rpc('decay_memories_v1', { p_agent_id: agentId });
                    const p = await supabase.rpc('prune_memories_v1', { p_agent_id: agentId });
                    decayPrune = {
                        decayed: Number(d.data ?? 0),
                        pruned: Number(p.data ?? 0)
                    };
                }
            } catch (e) {
                console.warn('[DreamConsolidation] decay/prune failed:', e);
            }

            // Step 1: Recall most impactful episodes
            const episodes = await recallMostImpactfulEpisodes({
                agentId,
                supabase,
                minNeuralStrength: MIN_NEURAL_STRENGTH_FOR_CONSOLIDATION,
                maxEpisodes: MAX_EPISODES_TO_PROCESS
            });
            console.log(`💤 [DreamConsolidation] Found ${episodes.length} impactful episodes`);

            if (episodes.length === 0) {
                const result = {
                    ...this.createEmptyResult(),
                    sessionChunkCreated,
                    decayPrune
                };

                await runSleepCycle();

                eventBus.publish({
                    id: generateUUID(),
                    timestamp: Date.now(),
                    source: AgentType.MEMORY_EPISODIC,
                    type: PacketType.SYSTEM_ALERT,
                    payload: {
                        event: 'DREAM_CONSOLIDATION_COMPLETE',
                        result,
                        message: `No episodes, maintenance done (chunk=${sessionChunkCreated}, decayed=${decayPrune.decayed}, pruned=${decayPrune.pruned})`
                    },
                    priority: 0.9
                });

                return result;
            }

            // Step 2: Generate lessons from episodes
            const lessons = await generateLessonsFromEpisodes({
                episodes,
                agentName,
                cortexService: CortexService
            });
            console.log(`💤 [DreamConsolidation] Generated ${lessons.length} lessons`);

            // Step 3: Create self-summary
            const selfSummary = await generateSelfSummaryFromDream({
                episodes,
                lessons,
                agentName,
                currentLimbic,
                cortexService: CortexService
            });
            console.log(`💤 [DreamConsolidation] Created self-summary`);

            // Step 4: Store self-summary as core memory
            await storeSelfSummary({
                summary: selfSummary,
                limbic: currentLimbic,
                memoryService: MemoryService,
                generateUUID
            });

            if (agentId && isMainFeatureEnabled('DREAM_ENABLED')) {
                await storeTopicShardsFromRecent({
                    agentId,
                    limbic: currentLimbic,
                    memoryService: MemoryService as any,
                    eventBus,
                    generateUUID,
                    agentTypeMemoryEpisodic: AgentType.MEMORY_EPISODIC,
                    packetTypeSystemAlert: PacketType.SYSTEM_ALERT
                });
            }

            // ═══════════════════════════════════════════════════════════════
            // IDENTITY-LITE: Consolidate identity (narrative_self + shards)
            // This is the CRITICAL connection between dreams and identity evolution
            // ═══════════════════════════════════════════════════════════════
            let identityResult = {
                narrativeSelfUpdated: false,
                shardsCreated: 0,
                shardsReinforced: 0,
                shardsWeakened: 0
            };

            if (agentId) {
                try {
                    identityResult = await consolidateIdentity({
                        agentId,
                        agentName,
                        episodes: episodes.map(e => ({
                            content: e.event,
                            emotionalImpact: e.emotionalDelta,
                            tags: e.tags
                        })),
                        lessons
                    });
                    console.log(`🧬 [DreamConsolidation] Identity consolidated:`, identityResult);
                } catch (identityError) {
                    console.error('🧬 [DreamConsolidation] Identity consolidation failed:', identityError);
                }
            }

            // Step 5: Generate trait proposal (LOG ONLY, no application)
            const traitProposal = await proposeTraitChanges({
                episodes,
                lessons,
                currentTraits,
                agentId,
                timestamp,
                initialLimbic: INITIAL_LIMBIC,
                eventBus,
                memoryService: MemoryService,
                generateUUID,
                agentTypeCortexFlow: AgentType.CORTEX_FLOW,
                packetTypeSystemAlert: PacketType.SYSTEM_ALERT
            });

            // Step 6: Optionally create new goals
            const goalsCreated = await this.createGoalsFromLessons(lessons, agentId);

            const episodeDetails = episodes.map((e) => ({
                id: e.id,
                preview: String(e.event || '').slice(0, 120),
                timestamp: e.timestamp,
                neuralStrength: typeof e.emotionalDelta === 'number' ? e.emotionalDelta : undefined,
                tags: Array.isArray(e.tags) ? e.tags.slice(0, 5) : []
            }));

            // Publish completion event
            const result: DreamConsolidationResult = {
                episodesProcessed: episodes.length,
                lessonsGenerated: lessons,
                selfSummary,
                traitProposal,
                goalsCreated,
                episodeDetails,
                // IDENTITY-LITE: Include identity consolidation results
                identityConsolidation: identityResult,
                sessionChunkCreated,
                decayPrune
            };

            const episodePreview = episodeDetails.length > 0
                ? ` (${episodeDetails.map((e) => e.id).slice(0, 3).join(', ')}${episodeDetails.length > 3 ? ', ...' : ''})`
                : '';

            await runSleepCycle();

            eventBus.publish({
                id: generateUUID(),
                timestamp: Date.now(),
                source: AgentType.MEMORY_EPISODIC,
                type: PacketType.SYSTEM_ALERT,
                payload: {
                    event: 'DREAM_CONSOLIDATION_COMPLETE',
                    result,
                    message: `Processed ${episodes.length} episodes${episodePreview}, generated ${lessons.length} lessons`
                },
                priority: 0.9
            });

            return result;

        } catch (error) {
            console.error('💤 [DreamConsolidation] Error:', error);
            eventBus.publish({
                id: generateUUID(),
                timestamp: Date.now(),
                source: AgentType.MEMORY_EPISODIC,
                type: PacketType.SYSTEM_ALERT,
                payload: {
                    event: 'DREAM_CONSOLIDATION_ERROR',
                    error: String(error)
                },
                priority: 0.9
            });
            await runSleepCycle();
            return this.createEmptyResult();
        }
    },

    /**
     * Create new goals based on lessons learned
     */
    async createGoalsFromLessons(lessons: string[], agentId: string | null): Promise<number> {
        // For now, just return 0 - goal creation from lessons is optional
        // TODO(PHASE2): implement goal creation from lessons (GoalJournalService or equivalent).
        if (lessons.length > 0) {
            eventBus.publish({
                id: generateUUID(),
                timestamp: Date.now(),
                source: AgentType.CORTEX_FLOW,
                type: PacketType.LESSON_GOALS_PLACEHOLDER,
                payload: {
                    event: 'LESSON_GOALS_PLACEHOLDER',
                    lessonsCount: lessons.length,
                    agentId
                },
                priority: 0.5
            });
        }
        return 0;
    },

    /**
     * Create empty result for error cases
     */
    createEmptyResult(): DreamConsolidationResult {
        return {
            episodesProcessed: 0,
            lessonsGenerated: [],
            selfSummary: '',
            traitProposal: null,
            goalsCreated: 0,
            episodeDetails: []
        };
    }
};

export default DreamConsolidationService;
