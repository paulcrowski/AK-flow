CREATE TABLE IF NOT EXISTS public.library_documents (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  owner_id uuid DEFAULT auth.uid(),
  agent_id uuid,
  original_name text NOT NULL,
  storage_bucket text NOT NULL DEFAULT 'ak_library',
  storage_path text NOT NULL,
  mime_type text NOT NULL,
  byte_size bigint NOT NULL DEFAULT 0,
  doc_type text NOT NULL DEFAULT 'text',
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  reason text NOT NULL DEFAULT '',
  global_summary text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'uploaded',
  created_at timestamptz NOT NULL DEFAULT now(),
  ingested_at timestamptz,
  CONSTRAINT library_documents_pkey PRIMARY KEY (id),
  CONSTRAINT library_documents_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE SET NULL
);

ALTER TABLE public.library_documents
  ADD COLUMN IF NOT EXISTS owner_id uuid,
  ADD COLUMN IF NOT EXISTS user_id text;

CREATE INDEX IF NOT EXISTS idx_library_documents_owner_id ON public.library_documents(owner_id);
CREATE INDEX IF NOT EXISTS idx_library_documents_agent_id ON public.library_documents(agent_id);
CREATE INDEX IF NOT EXISTS idx_library_documents_created_at ON public.library_documents(created_at DESC);

CREATE TABLE IF NOT EXISTS public.library_chunks (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL,
  owner_id uuid DEFAULT auth.uid(),
  chunk_index integer NOT NULL,
  start_offset integer NOT NULL DEFAULT 0,
  end_offset integer NOT NULL DEFAULT 0,
  content text,
  summary text,
  token_count integer,
  chunk_summary text NOT NULL DEFAULT '',
  keywords text[] NOT NULL DEFAULT '{}'::text[],
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT library_chunks_pkey PRIMARY KEY (id),
  CONSTRAINT library_chunks_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.library_documents(id) ON DELETE CASCADE,
  CONSTRAINT library_chunks_unique_doc_chunk UNIQUE (document_id, chunk_index)
);

ALTER TABLE public.library_chunks
  ADD COLUMN IF NOT EXISTS owner_id uuid,
  ADD COLUMN IF NOT EXISTS content text,
  ADD COLUMN IF NOT EXISTS summary text,
  ADD COLUMN IF NOT EXISTS token_count integer;

CREATE INDEX IF NOT EXISTS idx_library_chunks_owner_id ON public.library_chunks(owner_id);
CREATE INDEX IF NOT EXISTS idx_library_chunks_document_id ON public.library_chunks(document_id);

ALTER TABLE public.library_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.library_chunks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS library_documents_select_own ON public.library_documents;
CREATE POLICY library_documents_select_own ON public.library_documents
  FOR SELECT
  TO authenticated
  USING (
    (owner_id IS NOT NULL AND owner_id = auth.uid())
    OR
    (user_id IS NOT NULL AND user_id = (auth.jwt() ->> 'email'))
  );

DROP POLICY IF EXISTS library_documents_insert_own ON public.library_documents;
CREATE POLICY library_documents_insert_own ON public.library_documents
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (owner_id IS NOT NULL AND owner_id = auth.uid())
    OR
    (user_id IS NOT NULL AND user_id = (auth.jwt() ->> 'email'))
  );

DROP POLICY IF EXISTS library_documents_update_own ON public.library_documents;
CREATE POLICY library_documents_update_own ON public.library_documents
  FOR UPDATE
  TO authenticated
  USING (
    (owner_id IS NOT NULL AND owner_id = auth.uid())
    OR
    (user_id IS NOT NULL AND user_id = (auth.jwt() ->> 'email'))
  )
  WITH CHECK (
    (owner_id IS NOT NULL AND owner_id = auth.uid())
    OR
    (user_id IS NOT NULL AND user_id = (auth.jwt() ->> 'email'))
  );

DROP POLICY IF EXISTS library_documents_delete_own ON public.library_documents;
CREATE POLICY library_documents_delete_own ON public.library_documents
  FOR DELETE
  TO authenticated
  USING (
    (owner_id IS NOT NULL AND owner_id = auth.uid())
    OR
    (user_id IS NOT NULL AND user_id = (auth.jwt() ->> 'email'))
  );

DROP POLICY IF EXISTS library_chunks_select_own ON public.library_chunks;
CREATE POLICY library_chunks_select_own ON public.library_chunks
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.library_documents d
      WHERE d.id = public.library_chunks.document_id
        AND (
          (d.owner_id IS NOT NULL AND d.owner_id = auth.uid())
          OR
          (d.user_id IS NOT NULL AND d.user_id = (auth.jwt() ->> 'email'))
        )
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
        AND (
          (d.owner_id IS NOT NULL AND d.owner_id = auth.uid())
          OR
          (d.user_id IS NOT NULL AND d.user_id = (auth.jwt() ->> 'email'))
        )
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
        AND (
          (d.owner_id IS NOT NULL AND d.owner_id = auth.uid())
          OR
          (d.user_id IS NOT NULL AND d.user_id = (auth.jwt() ->> 'email'))
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.library_documents d
      WHERE d.id = public.library_chunks.document_id
        AND (
          (d.owner_id IS NOT NULL AND d.owner_id = auth.uid())
          OR
          (d.user_id IS NOT NULL AND d.user_id = (auth.jwt() ->> 'email'))
        )
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
        AND (
          (d.owner_id IS NOT NULL AND d.owner_id = auth.uid())
          OR
          (d.user_id IS NOT NULL AND d.user_id = (auth.jwt() ->> 'email'))
        )
    )
  );
