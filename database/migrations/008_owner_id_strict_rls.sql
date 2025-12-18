-- ============================================================
-- MIGRATION 008: Strict owner_id RLS (Option B)
-- Date: 2025-12-18
-- Purpose: Remove email fallback. Enforce auth.uid() ownership.
-- ============================================================

-- Ensure RLS is enabled
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.library_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.library_chunks ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------
-- AGENTS: owner_id only
-- -----------------------------------------------------------------
DROP POLICY IF EXISTS agents_select_own ON public.agents;
CREATE POLICY agents_select_own ON public.agents
  FOR SELECT
  TO authenticated
  USING (owner_id IS NOT NULL AND owner_id = auth.uid());

DROP POLICY IF EXISTS agents_insert_own ON public.agents;
CREATE POLICY agents_insert_own ON public.agents
  FOR INSERT
  TO authenticated
  WITH CHECK (owner_id IS NOT NULL AND owner_id = auth.uid());

DROP POLICY IF EXISTS agents_update_own ON public.agents;
CREATE POLICY agents_update_own ON public.agents
  FOR UPDATE
  TO authenticated
  USING (owner_id IS NOT NULL AND owner_id = auth.uid())
  WITH CHECK (owner_id IS NOT NULL AND owner_id = auth.uid());

DROP POLICY IF EXISTS agents_delete_own ON public.agents;
CREATE POLICY agents_delete_own ON public.agents
  FOR DELETE
  TO authenticated
  USING (owner_id IS NOT NULL AND owner_id = auth.uid());

-- -----------------------------------------------------------------
-- MEMORIES: owner_id only (or via owning agent)
-- -----------------------------------------------------------------
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
        AND a.owner_id IS NOT NULL
        AND a.owner_id = auth.uid()
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
        AND a.owner_id IS NOT NULL
        AND a.owner_id = auth.uid()
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
        AND a.owner_id IS NOT NULL
        AND a.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    (owner_id IS NOT NULL AND owner_id = auth.uid())
    OR
    EXISTS (
      SELECT 1 FROM public.agents a
      WHERE a.id = public.memories.agent_id
        AND a.owner_id IS NOT NULL
        AND a.owner_id = auth.uid()
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
        AND a.owner_id IS NOT NULL
        AND a.owner_id = auth.uid()
    )
  );

-- -----------------------------------------------------------------
-- LIBRARY DOCUMENTS: owner_id only
-- -----------------------------------------------------------------
DROP POLICY IF EXISTS library_documents_select_own ON public.library_documents;
CREATE POLICY library_documents_select_own ON public.library_documents
  FOR SELECT
  TO authenticated
  USING (owner_id IS NOT NULL AND owner_id = auth.uid());

DROP POLICY IF EXISTS library_documents_insert_own ON public.library_documents;
CREATE POLICY library_documents_insert_own ON public.library_documents
  FOR INSERT
  TO authenticated
  WITH CHECK (owner_id IS NOT NULL AND owner_id = auth.uid());

DROP POLICY IF EXISTS library_documents_update_own ON public.library_documents;
CREATE POLICY library_documents_update_own ON public.library_documents
  FOR UPDATE
  TO authenticated
  USING (owner_id IS NOT NULL AND owner_id = auth.uid())
  WITH CHECK (owner_id IS NOT NULL AND owner_id = auth.uid());

DROP POLICY IF EXISTS library_documents_delete_own ON public.library_documents;
CREATE POLICY library_documents_delete_own ON public.library_documents
  FOR DELETE
  TO authenticated
  USING (owner_id IS NOT NULL AND owner_id = auth.uid());

-- -----------------------------------------------------------------
-- LIBRARY CHUNKS: via owning document
-- -----------------------------------------------------------------
DROP POLICY IF EXISTS library_chunks_select_own ON public.library_chunks;
CREATE POLICY library_chunks_select_own ON public.library_chunks
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.library_documents d
      WHERE d.id = public.library_chunks.document_id
        AND d.owner_id IS NOT NULL
        AND d.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS library_chunks_insert_own ON public.library_chunks;
CREATE POLICY library_chunks_insert_own ON public.library_chunks
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.library_documents d
      WHERE d.id = public.library_chunks.document_id
        AND d.owner_id IS NOT NULL
        AND d.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS library_chunks_update_own ON public.library_chunks;
CREATE POLICY library_chunks_update_own ON public.library_chunks
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.library_documents d
      WHERE d.id = public.library_chunks.document_id
        AND d.owner_id IS NOT NULL
        AND d.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.library_documents d
      WHERE d.id = public.library_chunks.document_id
        AND d.owner_id IS NOT NULL
        AND d.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS library_chunks_delete_own ON public.library_chunks;
CREATE POLICY library_chunks_delete_own ON public.library_chunks
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.library_documents d
      WHERE d.id = public.library_chunks.document_id
        AND d.owner_id IS NOT NULL
        AND d.owner_id = auth.uid()
    )
  );

-- -----------------------------------------------------------------
-- IDENTITY TABLES (from 002_persona_less_cortex.sql): switch policies to owner_id
-- -----------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.core_identity') IS NOT NULL THEN
    ALTER TABLE public.core_identity ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Users can view own agents core_identity" ON public.core_identity;
    CREATE POLICY "Users can view own agents core_identity" ON public.core_identity
      FOR SELECT
      TO authenticated
      USING (agent_id IN (SELECT id FROM public.agents WHERE owner_id = auth.uid()));

    DROP POLICY IF EXISTS "Users can update own agents core_identity" ON public.core_identity;
    CREATE POLICY "Users can update own agents core_identity" ON public.core_identity
      FOR UPDATE
      TO authenticated
      USING (agent_id IN (SELECT id FROM public.agents WHERE owner_id = auth.uid()));

    DROP POLICY IF EXISTS "Users can insert own agents core_identity" ON public.core_identity;
    CREATE POLICY "Users can insert own agents core_identity" ON public.core_identity
      FOR INSERT
      TO authenticated
      WITH CHECK (agent_id IN (SELECT id FROM public.agents WHERE owner_id = auth.uid()));
  END IF;

  IF to_regclass('public.narrative_self') IS NOT NULL THEN
    ALTER TABLE public.narrative_self ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Users can view own agents narrative_self" ON public.narrative_self;
    CREATE POLICY "Users can view own agents narrative_self" ON public.narrative_self
      FOR SELECT
      TO authenticated
      USING (agent_id IN (SELECT id FROM public.agents WHERE owner_id = auth.uid()));

    DROP POLICY IF EXISTS "Users can update own agents narrative_self" ON public.narrative_self;
    CREATE POLICY "Users can update own agents narrative_self" ON public.narrative_self
      FOR UPDATE
      TO authenticated
      USING (agent_id IN (SELECT id FROM public.agents WHERE owner_id = auth.uid()));

    DROP POLICY IF EXISTS "Users can insert own agents narrative_self" ON public.narrative_self;
    CREATE POLICY "Users can insert own agents narrative_self" ON public.narrative_self
      FOR INSERT
      TO authenticated
      WITH CHECK (agent_id IN (SELECT id FROM public.agents WHERE owner_id = auth.uid()));
  END IF;

  IF to_regclass('public.identity_shards') IS NOT NULL THEN
    ALTER TABLE public.identity_shards ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Users can view own agents identity_shards" ON public.identity_shards;
    CREATE POLICY "Users can view own agents identity_shards" ON public.identity_shards
      FOR SELECT
      TO authenticated
      USING (agent_id IN (SELECT id FROM public.agents WHERE owner_id = auth.uid()));

    DROP POLICY IF EXISTS "Users can manage own agents identity_shards" ON public.identity_shards;
    CREATE POLICY "Users can manage own agents identity_shards" ON public.identity_shards
      FOR ALL
      TO authenticated
      USING (agent_id IN (SELECT id FROM public.agents WHERE owner_id = auth.uid()));
  END IF;
END $$;

-- ============================================================
-- DONE! Run this in Supabase SQL Editor AFTER migration 007.
-- ============================================================
