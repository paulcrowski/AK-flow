-- ============================================================
-- MIGRATION 007: Add owner_id to agents and memories
-- Date: 2025-12-18
-- Purpose: Support multi-owner model while keeping email fallback (option A)
-- SAFE: No data deletion. Only ADD COLUMN + backfill + RLS.
-- ============================================================

-- 1. ADD owner_id TO agents
ALTER TABLE public.agents
ADD COLUMN IF NOT EXISTS owner_id uuid;

-- 2. ADD owner_id TO memories
ALTER TABLE public.memories
ADD COLUMN IF NOT EXISTS owner_id uuid;

-- 3. BACKFILL owner_id for agents
-- Map user_id (email) to auth.users.id where possible
UPDATE public.agents a
SET owner_id = u.id
FROM auth.users u
WHERE a.owner_id IS NULL
  AND a.user_id IS NOT NULL
  AND lower(a.user_id) = lower(u.email);

-- 4. BACKFILL owner_id for memories via agent
UPDATE public.memories m
SET owner_id = a.owner_id
FROM public.agents a
WHERE m.owner_id IS NULL
  AND m.agent_id = a.id
  AND a.owner_id IS NOT NULL;

-- 5. CREATE INDEXES
CREATE INDEX IF NOT EXISTS idx_agents_owner_id ON public.agents(owner_id);
CREATE INDEX IF NOT EXISTS idx_memories_owner_id ON public.memories(owner_id);

-- 6. ENABLE RLS
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memories ENABLE ROW LEVEL SECURITY;

-- 7. RLS POLICIES FOR agents (owner_id OR user_id=email fallback)
DROP POLICY IF EXISTS agents_select_own ON public.agents;
CREATE POLICY agents_select_own ON public.agents
  FOR SELECT
  TO authenticated
  USING (
    (owner_id IS NOT NULL AND owner_id = auth.uid())
    OR
    (user_id IS NOT NULL AND lower(user_id) = lower(auth.jwt() ->> 'email'))
  );

DROP POLICY IF EXISTS agents_insert_own ON public.agents;
CREATE POLICY agents_insert_own ON public.agents
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (owner_id IS NOT NULL AND owner_id = auth.uid())
    OR
    (user_id IS NOT NULL AND lower(user_id) = lower(auth.jwt() ->> 'email'))
  );

DROP POLICY IF EXISTS agents_update_own ON public.agents;
CREATE POLICY agents_update_own ON public.agents
  FOR UPDATE
  TO authenticated
  USING (
    (owner_id IS NOT NULL AND owner_id = auth.uid())
    OR
    (user_id IS NOT NULL AND lower(user_id) = lower(auth.jwt() ->> 'email'))
  )
  WITH CHECK (
    (owner_id IS NOT NULL AND owner_id = auth.uid())
    OR
    (user_id IS NOT NULL AND lower(user_id) = lower(auth.jwt() ->> 'email'))
  );

DROP POLICY IF EXISTS agents_delete_own ON public.agents;
CREATE POLICY agents_delete_own ON public.agents
  FOR DELETE
  TO authenticated
  USING (
    (owner_id IS NOT NULL AND owner_id = auth.uid())
    OR
    (user_id IS NOT NULL AND lower(user_id) = lower(auth.jwt() ->> 'email'))
  );

-- 8. RLS POLICIES FOR memories (owner_id OR via agent fallback)
DROP POLICY IF EXISTS memories_select_own ON public.memories;
CREATE POLICY memories_select_own ON public.memories
  FOR SELECT
  TO authenticated
  USING (
    (owner_id IS NOT NULL AND owner_id = auth.uid())
    OR
    EXISTS (
      SELECT 1 FROM public.agents a
      WHERE a.id = public.memories.agent_id
        AND (
          (a.owner_id IS NOT NULL AND a.owner_id = auth.uid())
          OR
          (a.user_id IS NOT NULL AND lower(a.user_id) = lower(auth.jwt() ->> 'email'))
        )
    )
  );

DROP POLICY IF EXISTS memories_insert_own ON public.memories;
CREATE POLICY memories_insert_own ON public.memories
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (owner_id IS NOT NULL AND owner_id = auth.uid())
    OR
    EXISTS (
      SELECT 1 FROM public.agents a
      WHERE a.id = public.memories.agent_id
        AND (
          (a.owner_id IS NOT NULL AND a.owner_id = auth.uid())
          OR
          (a.user_id IS NOT NULL AND lower(a.user_id) = lower(auth.jwt() ->> 'email'))
        )
    )
  );

DROP POLICY IF EXISTS memories_update_own ON public.memories;
CREATE POLICY memories_update_own ON public.memories
  FOR UPDATE
  TO authenticated
  USING (
    (owner_id IS NOT NULL AND owner_id = auth.uid())
    OR
    EXISTS (
      SELECT 1 FROM public.agents a
      WHERE a.id = public.memories.agent_id
        AND (
          (a.owner_id IS NOT NULL AND a.owner_id = auth.uid())
          OR
          (a.user_id IS NOT NULL AND lower(a.user_id) = lower(auth.jwt() ->> 'email'))
        )
    )
  )
  WITH CHECK (
    (owner_id IS NOT NULL AND owner_id = auth.uid())
    OR
    EXISTS (
      SELECT 1 FROM public.agents a
      WHERE a.id = public.memories.agent_id
        AND (
          (a.owner_id IS NOT NULL AND a.owner_id = auth.uid())
          OR
          (a.user_id IS NOT NULL AND lower(a.user_id) = lower(auth.jwt() ->> 'email'))
        )
    )
  );

DROP POLICY IF EXISTS memories_delete_own ON public.memories;
CREATE POLICY memories_delete_own ON public.memories
  FOR DELETE
  TO authenticated
  USING (
    (owner_id IS NOT NULL AND owner_id = auth.uid())
    OR
    EXISTS (
      SELECT 1 FROM public.agents a
      WHERE a.id = public.memories.agent_id
        AND (
          (a.owner_id IS NOT NULL AND a.owner_id = auth.uid())
          OR
          (a.user_id IS NOT NULL AND lower(a.user_id) = lower(auth.jwt() ->> 'email'))
        )
    )
  );

-- ============================================================
-- DONE! Run this in Supabase SQL Editor.
-- No data deleted. Existing agents/memories preserved.
-- ============================================================
