/**
 * IdentityConsolidationService - Konsolidacja tożsamości podczas snu
 * 
 * Aktualizuje narrative_self i identity_shards na podstawie
 * epizodów z dnia. Część Persona-Less Cortex Architecture.
 * 
 * @module core/services/IdentityConsolidationService
 */

import { CortexService } from '@/llm/gemini';
import { eventBus } from '../EventBus';
import { AgentType, PacketType } from '../../types';
import { generateUUID } from '../../utils/uuid';
// extractJSON no longer needed - using CortexService.generateJSON with schema

import type { NarrativeSelf } from '../types/NarrativeSelf';
import type { IdentityShard, IdentityShardWithId, ShardKind } from '../types/IdentityShard';
import { CORE_SHARD_MIN_STRENGTH } from '../types/IdentityShard';

import {
  fetchNarrativeSelf,
  upsertNarrativeSelf,
  fetchIdentityShards,
  insertIdentityShard,
  updateShardStrength
} from './IdentityDataService';

import {
  quickCoherenceCheck,
  buildCoherencePrompt,
  parseCoherenceResponse
} from './IdentityCoherenceService';

import { isCortexSubEnabled } from '../config/featureFlags';

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

export interface ConsolidationInput {
  agentId: string;
  agentName: string;
  episodes: Array<{
    content: string;
    emotionalImpact: number;
    tags?: string[];
  }>;
  lessons: string[];
}

export interface IdentityConsolidationResult {
  narrativeSelfUpdated: boolean;
  shardsCreated: number;
  shardsReinforced: number;
  shardsWeakened: number;
}

// ═══════════════════════════════════════════════════════════════
// MAIN SERVICE
// ═══════════════════════════════════════════════════════════════

/**
 * Konsoliduje tożsamość agenta na podstawie epizodów z dnia.
 * Wywoływane podczas DreamConsolidation.
 */
export async function consolidateIdentity(
  input: ConsolidationInput
): Promise<IdentityConsolidationResult> {
  // Check feature flag
  if (!isCortexSubEnabled('minimalPrompt')) {
    console.log('[IdentityConsolidation] Feature disabled, skipping');
    return {
      narrativeSelfUpdated: false,
      shardsCreated: 0,
      shardsReinforced: 0,
      shardsWeakened: 0
    };
  }

  console.log(`🧠 [IdentityConsolidation] Starting for ${input.agentName}...`);

  const result: IdentityConsolidationResult = {
    narrativeSelfUpdated: false,
    shardsCreated: 0,
    shardsReinforced: 0,
    shardsWeakened: 0
  };

  try {
    // 1. Update narrative_self
    const narrativeUpdated = await updateNarrativeSelf(input);
    result.narrativeSelfUpdated = narrativeUpdated;

    // 2. Process lessons into shards
    const shardResult = await processLessonsIntoShards(input);
    result.shardsCreated = shardResult.created;
    result.shardsReinforced = shardResult.reinforced;

    // 3. Decay weak shards
    const decayed = await decayWeakShards(input.agentId);
    result.shardsWeakened = decayed;

    // Publish event
    eventBus.publish({
      id: generateUUID(),
      timestamp: Date.now(),
      source: AgentType.MEMORY_EPISODIC,
      type: PacketType.SYSTEM_ALERT,
      payload: {
        event: 'IDENTITY_CONSOLIDATION_COMPLETE',
        result,
        agentId: input.agentId
      },
      priority: 0.7
    });

    console.log(`🧠 [IdentityConsolidation] Complete:`, result);
    return result;

  } catch (error) {
    console.error('[IdentityConsolidation] Error:', error);
    return result;
  }
}

// ═══════════════════════════════════════════════════════════════
// NARRATIVE SELF UPDATE
// ═══════════════════════════════════════════════════════════════

async function updateNarrativeSelf(input: ConsolidationInput): Promise<boolean> {
  const current = await fetchNarrativeSelf(input.agentId);

  // Build prompt for self-summary update
  const episodeSummary = input.episodes
    .slice(0, 5)
    .map(e => `- ${e.content.slice(0, 100)}...`)
    .join('\n');

  const lessonsSummary = input.lessons.join('; ');

  const prompt = `You are ${input.agentName}. Based on today's experiences, update your self-summary.

CURRENT SELF-SUMMARY:
${current.self_summary}

TODAY'S SIGNIFICANT EPISODES:
${episodeSummary}

LESSONS LEARNED:
${lessonsSummary}

TASK: Write a new self-summary (2-3 sentences) that incorporates today's growth.
Include 1-3 persona tags that describe you and your current mood.`;

  // Schema for Gemini structured output - guarantees JSON response
  const narrativeSchema = {
    type: 'OBJECT',
    properties: {
      self_summary: { type: 'STRING', description: 'I am [name], 2-3 sentences about identity' },
      persona_tags: { 
        type: 'ARRAY', 
        items: { type: 'STRING' },
        description: '1-3 tags describing personality'
      },
      current_mood_narrative: { type: 'STRING', description: 'One phrase describing current mood' }
    },
    required: ['self_summary', 'persona_tags', 'current_mood_narrative']
  };

  const defaultNarrative = {
    self_summary: current.self_summary,
    persona_tags: current.persona_tags || ['adaptive', 'learning'],
    current_mood_narrative: 'reflective after consolidation'
  };

  try {
    // Use generateJSON with schema - guarantees structured response
    const parsed = await CortexService.generateJSON<{
      self_summary: string;
      persona_tags: string[];
      current_mood_narrative: string;
    }>(prompt, narrativeSchema, defaultNarrative);

    const updated: NarrativeSelf = {
      self_summary: parsed.self_summary || current.self_summary,
      persona_tags: (parsed.persona_tags || current.persona_tags || []).slice(0, 5),
      current_mood_narrative: parsed.current_mood_narrative || 'reflective after consolidation'
    };

    return await upsertNarrativeSelf(input.agentId, updated);
  } catch (error) {
    console.error('[IdentityConsolidation] Narrative update failed:', error);
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════
// SHARD PROCESSING
// ═══════════════════════════════════════════════════════════════

async function processLessonsIntoShards(
  input: ConsolidationInput
): Promise<{ created: number; reinforced: number }> {
  let created = 0;
  let reinforced = 0;

  const existingShards = await fetchIdentityShards(input.agentId, 50);

  for (const lesson of input.lessons) {
    // Extract potential shard from lesson
    const shardCandidate = await extractShardFromLesson(lesson, input.agentName);
    if (!shardCandidate) continue;

    // Check for existing similar shard
    const similar = findSimilarShard(shardCandidate.content, existingShards);

    if (similar) {
      // Reinforce existing shard
      const newStrength = Math.min(100, similar.strength + 5);
      await updateShardStrength(similar.id, newStrength);
      reinforced++;
    } else {
      // Check coherence before adding
      const shardForCheck = { ...shardCandidate, is_core: false };
      const coherenceResult = quickCoherenceCheck(shardForCheck, existingShards);

      if (coherenceResult === null) {
        // Need full LLM check
        const prompt = buildCoherencePrompt({ newShard: shardForCheck, existingShards });
        try {
          const response = await CortexService.structuredDialogue(prompt);
          const fullResult = parseCoherenceResponse(response.responseText, existingShards);

          if (fullResult.action === 'accept') {
            await insertIdentityShard(input.agentId, {
              ...shardCandidate,
              strength: 50,
              is_core: false
            });
            created++;
          } else if (fullResult.action === 'weaken_old' && fullResult.conflicting_shard_id) {
            // SOFT PLASTICITY: Weaken old (even core shards, but slower)
            const oldShard = existingShards.find(s => s.id === fullResult.conflicting_shard_id);
            if (oldShard) {
              // Core shards erode slower (1 point), non-core faster (5 points)
              const erosion = oldShard.is_core ? 1 : 5;
              const minStrength = oldShard.is_core ? CORE_SHARD_MIN_STRENGTH : 1;
              await updateShardStrength(oldShard.id, Math.max(minStrength, oldShard.strength - erosion));
              console.log(`[IdentityConsolidation] Eroded shard "${oldShard.content.slice(0, 30)}..." by ${erosion} (core: ${oldShard.is_core})`);
            }
            // Add new shard as "pending" with low strength
            const newStrength = oldShard?.is_core ? 10 : 30; // Weaker if challenging core
            await insertIdentityShard(input.agentId, {
              ...shardCandidate,
              strength: newStrength,
              is_core: false
            });
            created++;
          }
          // If 'reject', do nothing
        } catch (error) {
          console.warn('[IdentityConsolidation] Coherence check failed:', error);
        }
      } else if (coherenceResult.action === 'accept') {
        await insertIdentityShard(input.agentId, {
          ...shardCandidate,
          strength: 50,
          is_core: false
        });
        created++;
      } else if (coherenceResult.action === 'weaken_old' && coherenceResult.conflicting_shard_id) {
        // SOFT PLASTICITY from quick check
        const oldShard = existingShards.find(s => s.id === coherenceResult.conflicting_shard_id);
        if (oldShard) {
          const erosion = oldShard.is_core ? 1 : 5;
          const minStrength = oldShard.is_core ? CORE_SHARD_MIN_STRENGTH : 1;
          await updateShardStrength(oldShard.id, Math.max(minStrength, oldShard.strength - erosion));
          console.log(`[IdentityConsolidation] Quick eroded shard "${oldShard.content.slice(0, 30)}..." by ${erosion}`);
        }
        const newStrength = oldShard?.is_core ? 10 : 30;
        await insertIdentityShard(input.agentId, {
          ...shardCandidate,
          strength: newStrength,
          is_core: false
        });
        created++;
      }
      // If 'reject' (only for exact duplicates), do nothing
    }
  }

  return { created, reinforced };
}

async function extractShardFromLesson(
  lesson: string,
  agentName: string
): Promise<Omit<IdentityShard, 'strength' | 'is_core'> | null> {
  const prompt = `You are ${agentName}. Convert this lesson into an identity shard.

LESSON: "${lesson}"

TASK: Extract a core belief, preference, or constraint from this lesson.
If the lesson doesn't translate to a clear identity shard, use kind="none".`;

  // Schema for Gemini structured output
  const shardSchema = {
    type: 'OBJECT',
    properties: {
      kind: { 
        type: 'STRING', 
        enum: ['belief', 'preference', 'constraint', 'none'],
        description: 'Type of identity shard or none if not applicable'
      },
      content: { 
        type: 'STRING', 
        description: 'The shard content starting with I believe/prefer/must, or empty if none'
      }
    },
    required: ['kind', 'content']
  };

  const defaultShard = { kind: 'none', content: '' };

  try {
    const parsed = await CortexService.generateJSON<{
      kind: string;
      content: string;
    }>(prompt, shardSchema, defaultShard);

    if (!parsed.kind || parsed.kind === 'none' || !parsed.content) return null;
    if (!['belief', 'preference', 'constraint'].includes(parsed.kind)) return null;

    return {
      kind: parsed.kind as ShardKind,
      content: parsed.content
    };
  } catch {
    return null;
  }
}

function findSimilarShard(
  content: string,
  existingShards: IdentityShardWithId[]
): IdentityShardWithId | null {
  const contentLower = content.toLowerCase();
  const contentWords = new Set(contentLower.split(/\s+/).filter(w => w.length > 3));

  for (const shard of existingShards) {
    const shardLower = shard.content.toLowerCase();

    // Exact match
    if (shardLower === contentLower) return shard;

    // High word overlap (>60%)
    const shardWords = new Set(shardLower.split(/\s+/).filter(w => w.length > 3));
    const intersection = [...contentWords].filter(w => shardWords.has(w));
    const overlap = intersection.length / Math.max(contentWords.size, shardWords.size);

    if (overlap > 0.6) return shard;
  }

  return null;
}

// ═══════════════════════════════════════════════════════════════
// SHARD DECAY
// ═══════════════════════════════════════════════════════════════

async function decayWeakShards(agentId: string): Promise<number> {
  const shards = await fetchIdentityShards(agentId, 100);
  let decayed = 0;

  for (const shard of shards) {
    // Skip core shards
    if (shard.is_core) continue;

    // Check if not reinforced recently (>7 days)
    if (shard.last_reinforced_at) {
      const lastReinforced = new Date(shard.last_reinforced_at).getTime();
      const daysSince = (Date.now() - lastReinforced) / (1000 * 60 * 60 * 24);

      if (daysSince > 7 && shard.strength > 20) {
        // Decay by 5 points
        const newStrength = Math.max(1, shard.strength - 5);

        // Core shards don't go below minimum
        if (shard.is_core && newStrength < CORE_SHARD_MIN_STRENGTH) {
          continue;
        }

        await updateShardStrength(shard.id, newStrength);
        decayed++;
      }
    }
  }

  return decayed;
}
