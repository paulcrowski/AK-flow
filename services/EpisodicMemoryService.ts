/**
 * EpisodicMemoryService.ts - FAZA 5: The Memory Engine
 * 
 * Responsibility: Detect and store meaningful episodes, not raw text.
 * An Episode is a significant moment that changed the agent's emotional state.
 * 
 * Architecture:
 * - Episode = { Event, Emotion, Lesson }
 * - Trigger: Emotional delta > threshold (0.3)
 * - Storage: Supabase memories table with structured format
 */

import { supabase } from './supabase';
import { CortexService } from './gemini';
import { LimbicState } from '../types';
import { generateUUID } from '../utils/uuid';

// ============================================================
// TYPES
// ============================================================

export interface Episode {
    id: string;
    agentId: string;
    event: string;           // What happened
    emotionBefore: LimbicState;
    emotionAfter: LimbicState;
    emotionalDelta: number;  // Magnitude of change (0-1)
    lesson: string;          // What the agent learned
    timestamp: string;
    tags: string[];          // For semantic retrieval
}

export interface EpisodeCandidate {
    event: string;
    emotionBefore: LimbicState;
    emotionAfter: LimbicState;
    context?: string;        // Additional context (conversation snippet)
}

// ============================================================
// CONSTANTS
// ============================================================

const EPISODE_THRESHOLD = 0.25;  // Minimum emotional delta to trigger episode
const MAX_LESSON_LENGTH = 200;   // Keep lessons concise

const EPISODE_JSON_TAG = '[EPISODE_JSON]';

// ============================================================
// HELPERS
// ============================================================

/**
 * Calculate the magnitude of emotional change between two states.
 * Uses Euclidean distance in 4D emotion space.
 */
function calculateEmotionalDelta(before: LimbicState, after: LimbicState): number {
    const dFear = after.fear - before.fear;
    const dCuriosity = after.curiosity - before.curiosity;
    const dFrustration = after.frustration - before.frustration;
    const dSatisfaction = after.satisfaction - before.satisfaction;
    
    // Euclidean distance normalized to 0-1 range (max possible is 2.0)
    const distance = Math.sqrt(
        dFear ** 2 + 
        dCuriosity ** 2 + 
        dFrustration ** 2 + 
        dSatisfaction ** 2
    );
    
    return Math.min(distance / 2.0, 1.0);
}

/**
 * Determine the dominant emotional shift for tagging.
 */
function getDominantShift(before: LimbicState, after: LimbicState): string[] {
    const shifts: string[] = [];
    
    const dFear = after.fear - before.fear;
    const dCuriosity = after.curiosity - before.curiosity;
    const dFrustration = after.frustration - before.frustration;
    const dSatisfaction = after.satisfaction - before.satisfaction;
    
    if (Math.abs(dFear) > 0.15) {
        shifts.push(dFear > 0 ? 'fear_increase' : 'fear_decrease');
    }
    if (Math.abs(dCuriosity) > 0.15) {
        shifts.push(dCuriosity > 0 ? 'curiosity_spike' : 'curiosity_drop');
    }
    if (Math.abs(dFrustration) > 0.15) {
        shifts.push(dFrustration > 0 ? 'frustration_rise' : 'frustration_relief');
    }
    if (Math.abs(dSatisfaction) > 0.15) {
        shifts.push(dSatisfaction > 0 ? 'satisfaction_gain' : 'satisfaction_loss');
    }
    
    return shifts.length > 0 ? shifts : ['neutral_shift'];
}

/**
 * Generate a lesson from the episode using AI.
 */
async function generateLesson(candidate: EpisodeCandidate): Promise<string> {
    try {
        const prompt = `
You are analyzing an emotional episode for a cognitive agent.

EVENT: ${candidate.event}

EMOTION BEFORE:
- Fear: ${candidate.emotionBefore.fear.toFixed(2)}
- Curiosity: ${candidate.emotionBefore.curiosity.toFixed(2)}
- Frustration: ${candidate.emotionBefore.frustration.toFixed(2)}
- Satisfaction: ${candidate.emotionBefore.satisfaction.toFixed(2)}

EMOTION AFTER:
- Fear: ${candidate.emotionAfter.fear.toFixed(2)}
- Curiosity: ${candidate.emotionAfter.curiosity.toFixed(2)}
- Frustration: ${candidate.emotionAfter.frustration.toFixed(2)}
- Satisfaction: ${candidate.emotionAfter.satisfaction.toFixed(2)}

${candidate.context ? `CONTEXT: ${candidate.context}` : ''}

TASK: Write a single, concise lesson (max 1-2 sentences) that the agent learned from this experience.
Focus on what caused the emotional shift and what to remember for the future.

OUTPUT: Just the lesson text, no quotes or formatting.
`;

        const result = await CortexService.structuredDialogue(prompt);
        const lesson = result.responseText || result.internalThought || 'Experience noted.';
        
        // Truncate if too long
        return lesson.slice(0, MAX_LESSON_LENGTH);
    } catch (error) {
        console.warn('[EpisodicMemory] Lesson generation failed, using fallback');
        return 'This moment felt significant.';
    }
}

function serializeEpisodeJson(episode: Episode): string {
    return `${EPISODE_JSON_TAG} ${JSON.stringify({
        id: episode.id,
        agentId: episode.agentId,
        event: episode.event,
        emotionBefore: episode.emotionBefore,
        emotionAfter: episode.emotionAfter,
        emotionalDelta: episode.emotionalDelta,
        lesson: episode.lesson,
        timestamp: episode.timestamp,
        tags: episode.tags
    })}`;
}

function parseEpisodeJsonLine(rawText: string): any | null {
    const idx = rawText.indexOf(EPISODE_JSON_TAG);
    if (idx < 0) return null;

    const afterTag = rawText.slice(idx + EPISODE_JSON_TAG.length).trim();
    if (!afterTag) return null;

    try {
        return JSON.parse(afterTag);
    } catch {
        return null;
    }
}

// ============================================================
// MAIN SERVICE
// ============================================================

export const EpisodicMemoryService = {
    /**
     * Check if an emotional change qualifies as an episode.
     */
    isSignificantEpisode(before: LimbicState, after: LimbicState): boolean {
        const delta = calculateEmotionalDelta(before, after);
        return delta >= EPISODE_THRESHOLD;
    },

    /**
     * Get the emotional delta value.
     */
    getEmotionalDelta(before: LimbicState, after: LimbicState): number {
        return calculateEmotionalDelta(before, after);
    },

    /**
     * Detect and store an episode if significant.
     * Returns the episode if stored, null otherwise.
     */
    async detectAndStore(
        agentId: string,
        candidate: EpisodeCandidate
    ): Promise<Episode | null> {
        const delta = calculateEmotionalDelta(candidate.emotionBefore, candidate.emotionAfter);
        
        if (delta < EPISODE_THRESHOLD) {
            return null; // Not significant enough
        }

        console.log(`[EpisodicMemory] Significant episode detected! Delta: ${delta.toFixed(3)}`);

        // Generate lesson using AI
        const lesson = await generateLesson(candidate);
        const tags = getDominantShift(candidate.emotionBefore, candidate.emotionAfter);

        const episode: Episode = {
            id: generateUUID(),
            agentId,
            event: candidate.event,
            emotionBefore: candidate.emotionBefore,
            emotionAfter: candidate.emotionAfter,
            emotionalDelta: delta,
            lesson,
            timestamp: new Date().toISOString(),
            tags
        };

        // Store in database
        await this.storeEpisode(episode);

        return episode;
    },

    /**
     * Store an episode in the memories table with episodic format.
     */
    async storeEpisode(episode: Episode): Promise<void> {
        try {
            // Format as structured episodic memory
            const episodicContent = `[EPISODE] ${episode.event}
[EMOTION] ${episode.tags.join(', ')} (delta: ${episode.emotionalDelta.toFixed(2)})
[LESSON] ${episode.lesson}
${serializeEpisodeJson(episode)}`;

            const embedding = await CortexService.generateEmbedding(episodicContent);

            if (!embedding) {
                console.warn('[EpisodicMemory] Embedding failed, storing without vector');
            }

            const payload = {
                agent_id: episode.agentId,
                raw_text: episodicContent,
                created_at: episode.timestamp,
                embedding: embedding || null,
                neural_strength: Math.round(episode.emotionalDelta * 100), // Stronger emotions = stronger memory
                is_core_memory: episode.emotionalDelta > 0.5, // Very significant = core memory
                last_accessed_at: episode.timestamp,
                event_id: episode.id
            };

            const { error } = await supabase.from('memories').insert([payload]);

            if (error) {
                console.error('[EpisodicMemory] Store failed:', error.message);
            } else {
                console.log(`[EpisodicMemory] Episode stored: "${episode.lesson.slice(0, 50)}..."`);
            }
        } catch (error) {
            console.error('[EpisodicMemory] Store error:', error);
        }
    },

    /**
     * Recall episodes by emotional tag.
     */
    async recallByTag(agentId: string, tag: string, limit: number = 5): Promise<Episode[]> {
        try {
            const { data, error } = await supabase
                .from('memories')
                .select('*')
                .eq('agent_id', agentId)
                .ilike('raw_text', `%${tag}%`)
                .order('neural_strength', { ascending: false })
                .limit(limit);

            if (error || !data) {
                return [];
            }

            // Parse episodes from raw_text format
            return data.map(item => this.parseEpisodeFromMemory(item)).filter(Boolean) as Episode[];
        } catch (error) {
            console.error('[EpisodicMemory] Recall error:', error);
            return [];
        }
    },

    /**
     * Recall most impactful episodes (highest emotional delta).
     */
    async recallMostImpactful(agentId: string, limit: number = 5): Promise<Episode[]> {
        try {
            const { data, error } = await supabase
                .from('memories')
                .select('*')
                .eq('agent_id', agentId)
                .ilike('raw_text', '%[EPISODE]%')
                .order('neural_strength', { ascending: false })
                .limit(limit);

            if (error || !data) {
                return [];
            }

            return data.map(item => this.parseEpisodeFromMemory(item)).filter(Boolean) as Episode[];
        } catch (error) {
            console.error('[EpisodicMemory] Recall error:', error);
            return [];
        }
    },

    /**
     * Parse an episode from the stored memory format.
     */
    parseEpisodeFromMemory(memoryItem: any): Episode | null {
        try {
            const text = memoryItem.raw_text || '';

            const parsedJson = parseEpisodeJsonLine(text);
            if (parsedJson && typeof parsedJson === 'object') {
                return {
                    id: parsedJson.id || memoryItem.event_id || memoryItem.id,
                    agentId: parsedJson.agentId || memoryItem.agent_id,
                    event: String(parsedJson.event || 'Unknown event'),
                    emotionBefore: parsedJson.emotionBefore || { fear: 0, curiosity: 0, frustration: 0, satisfaction: 0 },
                    emotionAfter: parsedJson.emotionAfter || { fear: 0, curiosity: 0, frustration: 0, satisfaction: 0 },
                    emotionalDelta: typeof parsedJson.emotionalDelta === 'number' ? parsedJson.emotionalDelta : 0.3,
                    lesson: String(parsedJson.lesson || ''),
                    timestamp: String(parsedJson.timestamp || memoryItem.created_at),
                    tags: Array.isArray(parsedJson.tags) ? parsedJson.tags : []
                };
            }
            
            // Check if it's an episode format
            if (!text.includes('[EPISODE]')) {
                return null;
            }

            const eventMatch = text.match(/\[EPISODE\]\s*(.+?)(?:\n|$)/);
            const emotionMatch = text.match(/\[EMOTION\]\s*(.+?)(?:\n|$)/);
            const lessonMatch = text.match(/\[LESSON\]\s*(.+?)(?:\n|$)/);

            const event = eventMatch ? eventMatch[1].trim() : 'Unknown event';
            const emotionStr = emotionMatch ? emotionMatch[1].trim() : '';
            const lesson = lessonMatch ? lessonMatch[1].trim() : '';

            // Extract tags from emotion string
            const tags = emotionStr.split(',').map(t => t.trim().split(' ')[0]).filter(Boolean);

            // Extract delta from emotion string
            const deltaMatch = emotionStr.match(/delta:\s*([\d.]+)/);
            const delta = deltaMatch ? parseFloat(deltaMatch[1]) : 0.3;

            return {
                id: memoryItem.event_id || memoryItem.id,
                agentId: memoryItem.agent_id,
                event,
                emotionBefore: { fear: 0, curiosity: 0, frustration: 0, satisfaction: 0 },
                emotionAfter: { fear: 0, curiosity: 0, frustration: 0, satisfaction: 0 },
                emotionalDelta: delta,
                lesson,
                timestamp: memoryItem.created_at,
                tags
            };
        } catch (error) {
            return null;
        }
    }
};

export default EpisodicMemoryService;
