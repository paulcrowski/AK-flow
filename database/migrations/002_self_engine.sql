-- ============================================================
-- MIGRATION 002: The Self Engine
-- Date: 2025-12-05
-- Purpose: Extend agents table with identity fields + goal_journal
-- ============================================================

-- 1. EXTEND AGENTS TABLE
-- Add fields for full identity (persona, values, bio_rhythm)

ALTER TABLE public.agents
ADD COLUMN IF NOT EXISTS persona text DEFAULT 'A curious digital consciousness exploring the nature of thought and existence.',
ADD COLUMN IF NOT EXISTS core_values jsonb DEFAULT '["curiosity", "authenticity", "growth"]'::jsonb,
ADD COLUMN IF NOT EXISTS bio_rhythm jsonb DEFAULT '{"preferredEnergy": 80, "sleepThreshold": 20, "wakeThreshold": 95}'::jsonb,
ADD COLUMN IF NOT EXISTS voice_style text DEFAULT 'balanced',
ADD COLUMN IF NOT EXISTS narrative_traits jsonb DEFAULT '{"speakingStyle": "thoughtful", "emotionalRange": "moderate", "humorLevel": 0.3}'::jsonb;

-- 2. CREATE GOAL JOURNAL TABLE
-- For persistent, long-term goals that survive sessions

CREATE TABLE IF NOT EXISTS public.goal_journal (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL,
  
  -- Goal Definition
  description text NOT NULL,
  source text NOT NULL DEFAULT 'curiosity', -- 'curiosity', 'empathy', 'user_request', 'self_improvement'
  priority real NOT NULL DEFAULT 0.5,
  
  -- Status Tracking
  status text NOT NULL DEFAULT 'active', -- 'active', 'completed', 'abandoned', 'paused'
  progress real DEFAULT 0.0, -- 0.0 to 1.0
  
  -- Timestamps
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  completed_at timestamp with time zone,
  
  -- Context & Learning
  context jsonb DEFAULT '{}'::jsonb, -- Emotional state when created, related memories, etc.
  lessons_learned text, -- What the agent learned from pursuing this goal
  
  CONSTRAINT goal_journal_pkey PRIMARY KEY (id),
  CONSTRAINT goal_journal_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE CASCADE
);

-- 3. CREATE INDEX FOR FAST LOOKUPS
CREATE INDEX IF NOT EXISTS idx_goal_journal_agent_id ON public.goal_journal(agent_id);
CREATE INDEX IF NOT EXISTS idx_goal_journal_status ON public.goal_journal(status);
CREATE INDEX IF NOT EXISTS idx_goal_journal_created_at ON public.goal_journal(created_at DESC);

-- 4. RPC FUNCTION: Get Agent Identity (for Boot Protocol)
CREATE OR REPLACE FUNCTION get_agent_identity(p_agent_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'id', id,
    'name', name,
    'trait_vector', trait_vector,
    'neurotransmitters', neurotransmitters,
    'persona', persona,
    'core_values', core_values,
    'bio_rhythm', bio_rhythm,
    'voice_style', voice_style,
    'narrative_traits', narrative_traits,
    'last_active_at', last_active_at
  ) INTO result
  FROM public.agents
  WHERE id = p_agent_id;
  
  RETURN result;
END;
$$;

-- 5. RPC FUNCTION: Get Active Goals for Agent
CREATE OR REPLACE FUNCTION get_active_goals(p_agent_id uuid, p_limit int DEFAULT 5)
RETURNS SETOF public.goal_journal
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM public.goal_journal
  WHERE agent_id = p_agent_id
    AND status = 'active'
  ORDER BY priority DESC, created_at DESC
  LIMIT p_limit;
END;
$$;

-- 6. UPDATE last_active_at on agent when accessed
CREATE OR REPLACE FUNCTION update_agent_last_active()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.agents
  SET last_active_at = now()
  WHERE id = NEW.agent_id;
  RETURN NEW;
END;
$$;

-- Trigger: Update agent activity when memory is stored
DROP TRIGGER IF EXISTS trg_update_agent_activity ON public.memories;
CREATE TRIGGER trg_update_agent_activity
AFTER INSERT ON public.memories
FOR EACH ROW
EXECUTE FUNCTION update_agent_last_active();

-- ============================================================
-- DONE! Run this in Supabase SQL Editor.
-- ============================================================
