create table if not exists public.session_chunks (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null,
  session_id text not null,
  start_time timestamptz,
  end_time timestamptz,
  summary_json jsonb not null,
  summary_text text not null,
  topics text[] not null default '{}',
  strength int not null default 50,
  created_at timestamptz not null default now()
);

create index if not exists idx_chunks_agent_time
  on public.session_chunks(agent_id, created_at desc);

create index if not exists idx_chunks_agent_session
  on public.session_chunks(agent_id, session_id);

create index if not exists idx_chunks_topics
  on public.session_chunks using gin (topics);
