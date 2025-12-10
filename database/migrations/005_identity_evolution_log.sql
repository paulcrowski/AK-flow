-- ============================================================
-- MIGRATION 005: Identity Evolution Log (Tensorboard for Soul)
-- Date: 2025-12-10
-- Purpose: Track all identity changes for debugging & analysis
-- 
-- ZASADA: Logowanie ZAWSZE, bez flag. To jest fundament AGI.
-- ============================================================

-- 1. TABELA GŁÓWNA
CREATE TABLE IF NOT EXISTS identity_evolution_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid REFERENCES agents(id) ON DELETE CASCADE,
  timestamp timestamptz DEFAULT now(),
  
  -- Co się zmieniło
  component text NOT NULL, -- 'trait_vector' | 'narrative_self' | 'identity_shards'
  
  -- Stan przed/po (JSONB dla elastyczności)
  state_before jsonb,
  state_after jsonb,
  delta jsonb, -- obliczona różnica
  
  -- Dlaczego się zmieniło
  trigger text NOT NULL, -- 'dream_consolidation' | 'homeostasis' | 'user_review' | 'shard_erosion'
  reason text,
  
  -- Metadata
  session_id text,
  confidence float CHECK (confidence >= 0 AND confidence <= 1)
);

-- 2. INDEXY
CREATE INDEX IF NOT EXISTS idx_identity_log_agent ON identity_evolution_log(agent_id);
CREATE INDEX IF NOT EXISTS idx_identity_log_timestamp ON identity_evolution_log(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_identity_log_component ON identity_evolution_log(component);
CREATE INDEX IF NOT EXISTS idx_identity_log_trigger ON identity_evolution_log(trigger);

-- 3. KOMENTARZE
COMMENT ON TABLE identity_evolution_log IS 'Tensorboard for the soul - tracks all identity evolution. NEVER disable logging.';
COMMENT ON COLUMN identity_evolution_log.component IS 'What changed: trait_vector | narrative_self | identity_shards';
COMMENT ON COLUMN identity_evolution_log.trigger IS 'Why it changed: dream_consolidation | homeostasis | user_review | shard_erosion';
COMMENT ON COLUMN identity_evolution_log.delta IS 'Computed difference between before and after states';

-- ============================================================
-- DONE! Run this in Supabase SQL Editor.
-- ============================================================
