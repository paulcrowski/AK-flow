alter table public.memories
  add column if not exists content_hash text,
  add column if not exists salience real default 0.5,
  add column if not exists valence_real real default 0,
  add column if not exists source text default 'USER',
  add column if not exists topic_tags text[] default '{}';

create unique index if not exists uq_memories_agent_hash
  on public.memories(agent_id, content_hash);

create index if not exists idx_memories_agent_created
  on public.memories(agent_id, created_at desc);

create index if not exists idx_memories_topic_tags
  on public.memories using gin (topic_tags);

create or replace function public.match_memories_for_agent(
  query_embedding vector,
  p_agent_id uuid,
  match_threshold real,
  match_count int
)
returns table (
  id uuid,
  raw_text text,
  neural_strength real,
  image_data text,
  is_visual_dream boolean
)
language sql stable as $$
  select
    m.id,
    m.raw_text,
    m.neural_strength,
    m.image_data,
    m.is_visual_dream
  from public.memories m
  where m.agent_id = p_agent_id
    and m.embedding is not null
    and (1 - (m.embedding <=> query_embedding)) >= match_threshold
  order by m.embedding <=> query_embedding asc
  limit match_count;
$$;
