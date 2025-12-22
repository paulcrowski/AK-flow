/**
 * IdentityCoherenceService - Sprawdzanie spójności tożsamości
 * 
 * Zapobiega "schizofrenii" typu "kocham minimalizm" + "kocham wodolejstwo".
 * Używa LLM do sprawdzenia czy nowy shard jest spójny z istniejącymi.
 * 
 * @module core/services/IdentityCoherenceService
 */

import type { IdentityShard, IdentityShardWithId } from '../types/IdentityShard';

/**
 * Wynik sprawdzenia spójności
 */
export interface CoherenceResult {
  /** Akcja do podjęcia */
  action: 'accept' | 'reject' | 'weaken_old';
  /** ID konflikującego sharda (jeśli weaken_old) */
  conflicting_shard_id?: string;
  /** Powód decyzji */
  reason: string;
}

/**
 * Input do sprawdzenia spójności (bez zależności od Gemini)
 */
export interface CoherenceCheckInput {
  newShard: Omit<IdentityShard, 'strength'>;
  existingShards: IdentityShardWithId[];
}

/**
 * Buduje prompt do sprawdzenia spójności
 */
export function buildCoherencePrompt(input: CoherenceCheckInput): string {
  const topShards = input.existingShards
    .sort((a, b) => b.strength - a.strength)
    .slice(0, 10);

  return `
You are a coherence validator for an AI agent's identity.

EXISTING IDENTITY SHARDS (sorted by strength):
${topShards.map((s, i) => `${i + 1}. [${s.kind}] "${s.content}" (strength: ${s.strength}, core: ${s.is_core})`).join('\n')}

NEW SHARD TO ADD:
[${input.newShard.kind}] "${input.newShard.content}"

TASK: Determine if the new shard is coherent with existing shards.

OUTPUT JSON:
{
  "action": "accept" | "reject" | "weaken_old",
  "conflicting_shard_index": number | null,
  "reason": "brief explanation"
}

RULES:
- "accept" if no conflict or if new shard strengthens existing beliefs
- "reject" if directly contradicts a core shard (is_core = true)
- "weaken_old" if conflicts with non-core shard that should be weakened
`.trim();
}

/**
 * Parsuje odpowiedź LLM na CoherenceResult
 */
export function parseCoherenceResponse(
  responseText: string,
  existingShards: IdentityShardWithId[]
): CoherenceResult {
  try {
    // Wyciągnij JSON z odpowiedzi
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { action: 'reject', reason: 'Could not parse response' };
    }

    const parsed = JSON.parse(jsonMatch[0]);
    
    // Walidacja
    if (!['accept', 'reject', 'weaken_old'].includes(parsed.action)) {
      return { action: 'reject', reason: 'Invalid action in response' };
    }

    // Mapuj index na ID
    const topShards = existingShards
      .sort((a, b) => b.strength - a.strength)
      .slice(0, 10);

    return {
      action: parsed.action,
      conflicting_shard_id: parsed.conflicting_shard_index 
        ? topShards[parsed.conflicting_shard_index - 1]?.id 
        : undefined,
      reason: parsed.reason || 'No reason provided'
    };
  } catch (error) {
    console.error('[IdentityCoherence] Parse error:', error);
    return { action: 'reject', reason: 'Parse error' };
  }
}

/**
 * Szybkie sprawdzenie spójności bez LLM.
 * Zwraca null jeśli potrzebne pełne sprawdzenie.
 * 
 * SOFT PLASTICITY: Nawet konflikty z Core Shards nie są odrzucane całkowicie.
 * Zamiast tego stosujemy erozję - nowy shard jako "pending", stary osłabiony.
 */
export function quickCoherenceCheck(
  newShard: Omit<IdentityShard, 'strength'>,
  existingShards: IdentityShardWithId[]
): CoherenceResult | null {
  // 1. Exact duplicate check
  for (const shard of existingShards) {
    if (shard.content.toLowerCase() === newShard.content.toLowerCase()) {
      return {
        action: 'reject',
        conflicting_shard_id: shard.id,
        reason: 'Exact duplicate exists'
      };
    }
  }

  // 2. Simple contradiction check (love vs hate)
  const loveHatePattern = /\b(love|hate|prefer|avoid|always|never)\b/i;
  const newMatch = newShard.content.match(loveHatePattern);
  
  if (newMatch) {
    const opposites: Record<string, string> = {
      'love': 'hate', 'hate': 'love',
      'prefer': 'avoid', 'avoid': 'prefer',
      'always': 'never', 'never': 'always'
    };
    
    const opposite = opposites[newMatch[0].toLowerCase()];
    if (opposite) {
      for (const shard of existingShards) {
        if (shard.content.toLowerCase().includes(opposite)) {
          // Check if same topic
          const newWords = new Set(newShard.content.toLowerCase().split(/\s+/));
          const shardWords = new Set(shard.content.toLowerCase().split(/\s+/));
          const overlap = [...newWords].filter(w => shardWords.has(w) && w.length > 3);
          
          if (overlap.length >= 2) {
            // SOFT PLASTICITY: Even core shard conflicts use erosion, not rejection
            // Core shards erode slower, but they DO erode
            return {
              action: 'weaken_old',
              conflicting_shard_id: shard.id,
              reason: shard.is_core 
                ? `Soft conflict with core shard - will erode slowly: "${shard.content.slice(0, 50)}..."`
                : `Contradicts existing shard, will weaken old`
            };
          }
        }
      }
    }
  }

  // No obvious conflict, needs LLM check
  return null;
}
