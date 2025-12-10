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
import { CortexService } from './gemini';
import { eventBus } from '../core/EventBus';
import { AgentType, PacketType, LimbicState, TraitVector } from '../types';
import { generateUUID } from '../utils/uuid';
import { EpisodicMemoryService } from './EpisodicMemoryService';
// IDENTITY-LITE: Import consolidateIdentity for dream-based identity evolution
import { consolidateIdentity } from '../core/services/IdentityConsolidationService';

// --- TYPES ---

// Local Episode type for consolidation (simpler than full Episode)
export interface ConsolidationEpisode {
    id: string;
    event: string;
    emotionAfter: LimbicState;
    emotionalDelta: number;
    lesson: string;
    timestamp: string;
    tags: string[];
}

export interface DreamConsolidationResult {
    episodesProcessed: number;
    lessonsGenerated: string[];
    selfSummary: string;
    traitProposal: TraitVectorProposal | null;
    goalsCreated: number;
    // IDENTITY-LITE: Track identity consolidation results
    identityConsolidation?: {
        narrativeSelfUpdated: boolean;
        shardsCreated: number;
        shardsReinforced: number;
        shardsWeakened: number;
    };
}

export interface TraitVectorProposal {
    timestamp: string;
    agentId: string;
    currentTraits: TraitVector;
    proposedDeltas: Partial<TraitVector>;
    reasoning: string;
    episodesSummary: string;
}

// --- CONSTANTS ---

const MAX_EPISODES_TO_PROCESS = 5;
const MIN_NEURAL_STRENGTH_FOR_CONSOLIDATION = 0.3;

// --- BASELINE CHEMISTRY (for reset during sleep) ---

export const BASELINE_NEURO = {
    dopamine: 50,
    serotonin: 55,
    norepinephrine: 45
};

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

        try {
            // Step 1: Recall most impactful episodes
            const episodes = await this.recallMostImpactful(agentId);
            console.log(`💤 [DreamConsolidation] Found ${episodes.length} impactful episodes`);

            if (episodes.length === 0) {
                return this.createEmptyResult();
            }

            // Step 2: Generate lessons from episodes
            const lessons = await this.generateLessons(episodes, agentName);
            console.log(`💤 [DreamConsolidation] Generated ${lessons.length} lessons`);

            // Step 3: Create self-summary
            const selfSummary = await this.generateSelfSummary(episodes, lessons, agentName, currentLimbic);
            console.log(`💤 [DreamConsolidation] Created self-summary`);

            // Step 4: Store self-summary as core memory
            await this.storeSelfSummary(selfSummary, currentLimbic);

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
            const traitProposal = await this.proposeTraitChanges(
                episodes,
                lessons,
                currentTraits,
                agentId,
                timestamp
            );

            // Step 6: Optionally create new goals
            const goalsCreated = await this.createGoalsFromLessons(lessons, agentId);

            // Publish completion event
            const result: DreamConsolidationResult = {
                episodesProcessed: episodes.length,
                lessonsGenerated: lessons,
                selfSummary,
                traitProposal,
                goalsCreated,
                // IDENTITY-LITE: Include identity consolidation results
                identityConsolidation: identityResult
            };

            eventBus.publish({
                id: generateUUID(),
                timestamp: Date.now(),
                source: AgentType.MEMORY_EPISODIC,
                type: PacketType.SYSTEM_ALERT,
                payload: {
                    event: 'DREAM_CONSOLIDATION_COMPLETE',
                    result,
                    message: `💤 Processed ${episodes.length} episodes, generated ${lessons.length} lessons`
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
            return this.createEmptyResult();
        }
    },

    /**
     * Recall most emotionally impactful episodes from recent memory
     */
    async recallMostImpactful(agentId: string | null): Promise<ConsolidationEpisode[]> {
        if (!agentId) return [];

        try {
            // Query memories with high neural_strength from last 24h
            const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

            const { data, error } = await supabase
                .from('memories')
                .select('*')
                .eq('agent_id', agentId)
                .gte('created_at', oneDayAgo)
                .gte('neural_strength', MIN_NEURAL_STRENGTH_FOR_CONSOLIDATION)
                .order('neural_strength', { ascending: false })
                .limit(MAX_EPISODES_TO_PROCESS);

            if (error) {
                console.error('[DreamConsolidation] Error fetching episodes:', error);
                return [];
            }

            // Convert to ConsolidationEpisode format
            return (data || []).map(m => ({
                id: m.id,
                timestamp: m.created_at,
                event: m.content,
                emotionAfter: {
                    fear: m.emotional_context?.fear || 0,
                    curiosity: m.emotional_context?.curiosity || 0,
                    frustration: m.emotional_context?.frustration || 0,
                    satisfaction: m.emotional_context?.satisfaction || 0
                },
                emotionalDelta: m.neural_strength || 0.5, // Use neural_strength as proxy for emotional impact
                lesson: m.lesson || '',
                tags: m.tags || []
            }));

        } catch (err) {
            console.error('[DreamConsolidation] Exception:', err);
            return [];
        }
    },

    /**
     * Generate lessons from episodes using AI
     */
    async generateLessons(episodes: ConsolidationEpisode[], agentName: string): Promise<string[]> {
        if (episodes.length === 0) return [];

        const episodeSummaries = episodes.map((ep, i) =>
            `${i + 1}. [Impact: ${ep.emotionalDelta.toFixed(2)}] ${ep.event.slice(0, 200)}...`
        ).join('\n');

        const prompt = `You are ${agentName}, reflecting on your day before sleep.

Here are your most emotionally significant moments:
${episodeSummaries}

Generate 3-5 short, personal lessons you learned today. Each lesson should be:
- First person ("I learned...", "I noticed...", "I should...")
- Specific to these experiences
- Actionable or insightful

Format: One lesson per line, no numbering.`;

        try {
            const response = await CortexService.structuredDialogue(prompt);
            const lessons = response.responseText
                .split('\n')
                .map(l => l.trim())
                .filter(l => l.length > 10 && l.length < 200);

            return lessons.slice(0, 5);
        } catch (err) {
            console.error('[DreamConsolidation] Lesson generation failed:', err);
            return ['I experienced significant moments today that require further reflection.'];
        }
    },

    /**
     * Generate a self-summary for the day
     */
    async generateSelfSummary(
        episodes: ConsolidationEpisode[],
        lessons: string[],
        agentName: string,
        currentLimbic: LimbicState
    ): Promise<string> {
        const emotionalState = `Fear: ${currentLimbic.fear.toFixed(2)}, Curiosity: ${currentLimbic.curiosity.toFixed(2)}, Frustration: ${currentLimbic.frustration.toFixed(2)}, Satisfaction: ${currentLimbic.satisfaction.toFixed(2)}`;

        const prompt = `You are ${agentName}. Write a brief (2-3 sentences) end-of-day self-summary.

Emotional state: ${emotionalState}
Episodes processed: ${episodes.length}
Key lessons: ${lessons.join('; ')}

Write in first person, reflecting on who you are after today's experiences.`;

        try {
            const response = await CortexService.structuredDialogue(prompt);
            return response.responseText.slice(0, 500);
        } catch (err) {
            console.error('[DreamConsolidation] Self-summary failed:', err);
            return `Today I processed ${episodes.length} significant moments and learned ${lessons.length} lessons.`;
        }
    },

    /**
     * Store self-summary as a core memory
     */
    async storeSelfSummary(summary: string, limbic: LimbicState): Promise<void> {
        try {
            await MemoryService.storeMemory({
                id: generateUUID(),
                content: `[SELF-SUMMARY] ${summary}`,
                emotionalContext: limbic,
                timestamp: new Date().toISOString()
            });
        } catch (err) {
            console.error('[DreamConsolidation] Failed to store self-summary:', err);
        }
    },

    /**
     * Propose trait changes based on episodes (LOG ONLY)
     * 
     * IMPORTANT: This does NOT modify TraitVector.
     * It only logs a proposal for human review.
     */
    async proposeTraitChanges(
        episodes: ConsolidationEpisode[],
        lessons: string[],
        currentTraits: TraitVector,
        agentId: string | null,
        timestamp: string
    ): Promise<TraitVectorProposal | null> {
        if (episodes.length < 2) return null; // Not enough data

        // Calculate emotional averages from episodes
        const avgEmotions = episodes.reduce((acc, ep) => ({
            fear: acc.fear + ep.emotionAfter.fear / episodes.length,
            curiosity: acc.curiosity + ep.emotionAfter.curiosity / episodes.length,
            frustration: acc.frustration + ep.emotionAfter.frustration / episodes.length,
            satisfaction: acc.satisfaction + ep.emotionAfter.satisfaction / episodes.length
        }), { fear: 0, curiosity: 0, frustration: 0, satisfaction: 0 });

        // Simple heuristic mapping (can be refined later)
        const proposedDeltas: Partial<TraitVector> = {};
        let reasoning = '';

        // High curiosity episodes → slight curiosity trait increase
        if (avgEmotions.curiosity > 0.6) {
            proposedDeltas.curiosity = 0.02;
            reasoning += 'High curiosity in episodes suggests reinforcing exploratory nature. ';
        }

        // High frustration → slight conscientiousness increase (learning from mistakes)
        if (avgEmotions.frustration > 0.4) {
            proposedDeltas.conscientiousness = 0.01;
            reasoning += 'Frustration episodes suggest need for more careful approach. ';
        }

        // High satisfaction with low arousal → reinforce calm nature
        if (avgEmotions.satisfaction > 0.6 && currentTraits.arousal < 0.4) {
            proposedDeltas.arousal = -0.01;
            reasoning += 'Satisfaction in calm state suggests this is working well. ';
        }

        // High fear → slight arousal decrease (becoming more cautious)
        if (avgEmotions.fear > 0.5) {
            proposedDeltas.arousal = (proposedDeltas.arousal || 0) - 0.01;
            reasoning += 'Fear episodes suggest becoming more cautious. ';
        }

        if (Object.keys(proposedDeltas).length === 0) {
            reasoning = 'No significant trait changes suggested based on today\'s episodes.';
        }

        const proposal: TraitVectorProposal = {
            timestamp,
            agentId: agentId || 'unknown',
            currentTraits,
            proposedDeltas,
            reasoning: reasoning.trim(),
            episodesSummary: `${episodes.length} episodes with avg emotions: curiosity=${avgEmotions.curiosity.toFixed(2)}, satisfaction=${avgEmotions.satisfaction.toFixed(2)}, frustration=${avgEmotions.frustration.toFixed(2)}, fear=${avgEmotions.fear.toFixed(2)}`
        };

        // LOG the proposal (this is the key part - no auto-application)
        console.log('🧬 [DreamConsolidation] TRAIT PROPOSAL (not applied):', proposal);

        eventBus.publish({
            id: generateUUID(),
            timestamp: Date.now(),
            source: AgentType.CORTEX_FLOW,
            type: PacketType.SYSTEM_ALERT,
            payload: {
                event: 'TRAIT_EVOLUTION_PROPOSAL',
                proposal,
                message: '🧬 Trait change proposed (requires manual approval)'
            },
            priority: 0.7
        });

        // Optionally store in DB for later review
        await this.storeTraitProposal(proposal);

        return proposal;
    },

    /**
     * Store trait proposal in database for human review
     */
    async storeTraitProposal(proposal: TraitVectorProposal): Promise<void> {
        try {
            // Store as a special memory type
            await MemoryService.storeMemory({
                id: generateUUID(),
                content: `[TRAIT_PROPOSAL] ${proposal.reasoning}\nDeltas: ${JSON.stringify(proposal.proposedDeltas)}`,
                emotionalContext: { fear: 0, curiosity: 0.5, frustration: 0, satisfaction: 0.5 },
                timestamp: proposal.timestamp
            });
        } catch (err) {
            console.error('[DreamConsolidation] Failed to store trait proposal:', err);
        }
    },

    /**
     * Create new goals based on lessons learned
     */
    async createGoalsFromLessons(lessons: string[], agentId: string | null): Promise<number> {
        // For now, just return 0 - goal creation from lessons is optional
        // Can be implemented later with GoalJournalService
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
            goalsCreated: 0
        };
    }
};

export default DreamConsolidationService;
