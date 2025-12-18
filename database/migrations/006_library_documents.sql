CREATE TABLE IF NOT EXISTS public.library_documents (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  agent_id uuid,
  bucket text NOT NULL DEFAULT 'ak_library',
  storage_path text NOT NULL,
  filename text NOT NULL,
  mime_type text,
  size_bytes bigint,
  sha256 text,
  status text NOT NULL DEFAULT 'uploaded',
  error text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  ingested_at timestamptz,
  CONSTRAINT library_documents_pkey PRIMARY KEY (id),
  CONSTRAINT library_documents_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_library_documents_owner_id ON public.library_documents(owner_id);
CREATE INDEX IF NOT EXISTS idx_library_documents_agent_id ON public.library_documents(agent_id);
CREATE INDEX IF NOT EXISTS idx_library_documents_uploaded_at ON public.library_documents(uploaded_at DESC);

CREATE TABLE IF NOT EXISTS public.library_chunks (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL,
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  chunk_index integer NOT NULL,
  content text NOT NULL,
  summary text,
  token_count integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT library_chunks_pkey PRIMARY KEY (id),
  CONSTRAINT library_chunks_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.library_documents(id) ON DELETE CASCADE,
  CONSTRAINT library_chunks_unique_doc_chunk UNIQUE (document_id, chunk_index)
);

CREATE INDEX IF NOT EXISTS idx_library_chunks_owner_id ON public.library_chunks(owner_id);
CREATE INDEX IF NOT EXISTS idx_library_chunks_document_id ON public.library_chunks(document_id);

ALTER TABLE public.library_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.library_chunks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS library_documents_select_own ON public.library_documents;
CREATE POLICY library_documents_select_own ON public.library_documents
  FOR SELECT
  TO authenticated
  USING (owner_id = auth.uid());

DROP POLICY IF EXISTS library_documents_insert_own ON public.library_documents;
CREATE POLICY library_documents_insert_own ON public.library_documents
  FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS library_documents_update_own ON public.library_documents;
CREATE POLICY library_documents_update_own ON public.library_documents
  FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS library_documents_delete_own ON public.library_documents;
CREATE POLICY library_documents_delete_own ON public.library_documents
  FOR DELETE
  TO authenticated
  USING (owner_id = auth.uid());

DROP POLICY IF EXISTS library_chunks_select_own ON public.library_chunks;
CREATE POLICY library_chunks_select_own ON public.library_chunks
  FOR SELECT
  TO authenticated
  USING (owner_id = auth.uid());

DROP POLICY IF EXISTS library_chunks_insert_own ON public.library_chunks;
CREATE POLICY library_chunks_insert_own ON public.library_chunks
  FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS library_chunks_update_own ON public.library_chunks;
CREATE POLICY library_chunks_update_own ON public.library_chunks
  FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS library_chunks_delete_own ON public.library_chunks;
CREATE POLICY library_chunks_delete_own ON public.library_chunks
  FOR DELETE
  TO authenticated
  USING (owner_id = auth.uid());
