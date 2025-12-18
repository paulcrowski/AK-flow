-- ============================================================
-- MIGRATION 009: RLS hardening - remove legacy public policies
-- Date: 2025-12-18
-- Purpose: Remove old permissive policies that bypass strict owner_id model.
-- ============================================================

-- Ensure RLS stays enabled
ALTER TABLE public.memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.narrative_self ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------
-- MEMORIES: remove legacy policies (public allow + user_id auth.uid checks)
-- -----------------------------------------------------------------
DROP POLICY IF EXISTS "Allow all access" ON public.memories;
DROP POLICY IF EXISTS "Allow public read" ON public.memories;
DROP POLICY IF EXISTS "Users can insert their own memories." ON public.memories;
DROP POLICY IF EXISTS "Users can view their own memories." ON public.memories;

-- -----------------------------------------------------------------
-- NARRATIVE_SELF: remove legacy permissive policy
-- -----------------------------------------------------------------
DROP POLICY IF EXISTS "Allow all operations on narrative_self" ON public.narrative_self;

-- ============================================================
-- DONE! Run this in Supabase SQL Editor.
-- Then verify pg_policies has NO 'public' policies for memories/narrative_self.
-- ============================================================
