/**
 * IdentityDataService - Dostęp do danych tożsamości w Supabase
 * 
 * CRUD dla core_identity, narrative_self, identity_shards.
 * Oddzielony od logiki biznesowej.
 * 
 * @module core/services/IdentityDataService
 */

import { supabase } from '@/services/supabase';
import type { CoreIdentity } from '../types/CoreIdentity';
import type { NarrativeSelf } from '../types/NarrativeSelf';
import type { IdentityShardWithId, ShardKind } from '../types/IdentityShard';
import type { Relationship, RelationshipStage } from '../types/Relationship';
import { DEFAULT_CORE_IDENTITY } from '../types/CoreIdentity';
import { DEFAULT_NARRATIVE_SELF } from '../types/NarrativeSelf';
import { DEFAULT_RELATIONSHIP } from '../types/Relationship';
import { MAX_SHARDS_IN_PAYLOAD } from '../types/IdentityShard';

// ═══════════════════════════════════════════════════════════════
// CORE IDENTITY
// ═══════════════════════════════════════════════════════════════

export async function fetchCoreIdentity(agentId: string): Promise<CoreIdentity> {
  const { data, error } = await supabase
    .from('core_identity')
    .select('name, core_values, constitutional_constraints')
    .eq('agent_id', agentId)
    .single();

  if (error || !data) {
    console.warn('[IdentityData] No core_identity found, using default');
    return { ...DEFAULT_CORE_IDENTITY };
  }

  return {
    name: data.name,
    core_values: data.core_values ?? [],
    constitutional_constraints: data.constitutional_constraints ?? []
  };
}

export async function upsertCoreIdentity(
  agentId: string, 
  identity: CoreIdentity
): Promise<boolean> {
  const { error } = await supabase
    .from('core_identity')
    .upsert({
      agent_id: agentId,
      name: identity.name,
      core_values: identity.core_values,
      constitutional_constraints: identity.constitutional_constraints,
      last_reviewed_at: new Date().toISOString()
    });

  if (error) {
    console.error('[IdentityData] Upsert core_identity error:', error);
    return false;
  }
  return true;
}

// ═══════════════════════════════════════════════════════════════
// NARRATIVE SELF
// ═══════════════════════════════════════════════════════════════

export async function fetchNarrativeSelf(agentId: string): Promise<NarrativeSelf> {
  const { data, error } = await supabase
    .from('narrative_self')
    .select('self_summary, persona_tags, current_mood_narrative')
    .eq('agent_id', agentId)
    .single();

  if (error || !data) {
    console.warn('[IdentityData] No narrative_self found, using default');
    return { ...DEFAULT_NARRATIVE_SELF };
  }

  return {
    self_summary: data.self_summary ?? '',
    persona_tags: data.persona_tags ?? [],
    current_mood_narrative: data.current_mood_narrative ?? 'neutral'
  };
}

export async function upsertNarrativeSelf(
  agentId: string, 
  narrative: NarrativeSelf
): Promise<boolean> {
  const { error } = await supabase
    .from('narrative_self')
    .upsert({
      agent_id: agentId,
      self_summary: narrative.self_summary,
      persona_tags: narrative.persona_tags,
      current_mood_narrative: narrative.current_mood_narrative,
      last_updated_at: new Date().toISOString()
    });

  if (error) {
    console.error('[IdentityData] Upsert narrative_self error:', error);
    return false;
  }
  return true;
}

// ═══════════════════════════════════════════════════════════════
// IDENTITY SHARDS
// ═══════════════════════════════════════════════════════════════

export async function fetchIdentityShards(
  agentId: string,
  limit: number = MAX_SHARDS_IN_PAYLOAD
): Promise<IdentityShardWithId[]> {
  const { data, error } = await supabase
    .from('identity_shards')
    .select('id, kind, content, strength, is_core, last_reinforced_at, created_at')
    .eq('agent_id', agentId)
    .order('strength', { ascending: false })
    .limit(limit);

  if (error || !data) {
    console.warn('[IdentityData] No identity_shards found');
    return [];
  }

  return data.map(s => ({
    id: s.id,
    kind: s.kind as ShardKind,
    content: s.content,
    strength: s.strength,
    is_core: s.is_core,
    last_reinforced_at: s.last_reinforced_at,
    created_at: s.created_at
  }));
}

export async function insertIdentityShard(
  agentId: string,
  shard: Omit<IdentityShardWithId, 'id' | 'last_reinforced_at' | 'created_at'>
): Promise<string | null> {
  const { data, error } = await supabase
    .from('identity_shards')
    .insert({
      agent_id: agentId,
      kind: shard.kind,
      content: shard.content,
      strength: shard.strength,
      is_core: shard.is_core
    })
    .select('id')
    .single();

  if (error || !data) {
    console.error('[IdentityData] Insert shard error:', error);
    return null;
  }
  return data.id;
}

export async function updateShardStrength(
  shardId: string, 
  newStrength: number
): Promise<boolean> {
  const { error } = await supabase
    .from('identity_shards')
    .update({ 
      strength: Math.max(1, Math.min(100, newStrength)),
      last_reinforced_at: new Date().toISOString()
    })
    .eq('id', shardId);

  if (error) {
    console.error('[IdentityData] Update shard strength error:', error);
    return false;
  }
  return true;
}

export async function deleteIdentityShard(shardId: string): Promise<boolean> {
  const { error } = await supabase
    .from('identity_shards')
    .delete()
    .eq('id', shardId);

  if (error) {
    console.error('[IdentityData] Delete shard error:', error);
    return false;
  }
  return true;
}

// ═══════════════════════════════════════════════════════════════
// RELATIONSHIP
// ═══════════════════════════════════════════════════════════════

export async function fetchRelationship(
  agentId: string, 
  userId: string
): Promise<Relationship> {
  const { data, error } = await supabase
    .from('agent_relationships')
    .select('trust_level, stage')
    .eq('agent_id', agentId)
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    return { ...DEFAULT_RELATIONSHIP };
  }

  return {
    trust_level: data.trust_level ?? 0.5,
    stage: (data.stage as RelationshipStage) ?? 'new'
  };
}

export async function upsertRelationship(
  agentId: string,
  userId: string,
  relationship: Relationship
): Promise<boolean> {
  const { error } = await supabase
    .from('agent_relationships')
    .upsert({
      agent_id: agentId,
      user_id: userId,
      trust_level: relationship.trust_level,
      stage: relationship.stage,
      last_interaction_at: new Date().toISOString()
    });

  if (error) {
    console.error('[IdentityData] Upsert relationship error:', error);
    return false;
  }
  return true;
}
