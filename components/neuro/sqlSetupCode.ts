export const SQL_SETUP_CODE = `-- AK - FLOW V3.1 SQL
--Adds Visual Memory support(11 / 10 Upgrade)

--1. Ensure extension for Vectors
create extension if not exists vector;

--2. Create / Update Memories Table
create table if not exists memories(
    id uuid primary key default gen_random_uuid(),
    user_id uuid default auth.uid(),
    raw_text text,
    embedding vector(768),
    created_at timestamptz default now(),
    neural_strength int default 1,
    is_core_memory boolean default false,
    last_accessed_at timestamptz default now(),
    --NEW V3.1 COLUMNS:
    image_data text, --Stores Compressed Base64
  is_visual_dream boolean default false
);

--3. Match Function(Biological Search)
create or replace function match_memories(
    query_embedding vector(768),
        match_threshold float,
            match_count int
)
returns table(
                id uuid,
                raw_text text,
                neural_strength int,
                is_core_memory boolean,
                similarity float,
                image_data text, --Return images
  is_visual_dream boolean
            )
language sql stable
as $$
select
id,
    raw_text,
    neural_strength,
    is_core_memory,
    1 - (memories.embedding <=> query_embedding) as similarity,
    image_data,
    is_visual_dream
  from memories
  where 1 - (memories.embedding <=> query_embedding) > match_threshold
  order by similarity desc
  limit match_count;
$$;

--4. Reinforce Function(Hebbian)
create or replace function reinforce_memory(row_id uuid, amount int)
returns void language plpgsql as $$
begin
  update memories
  set neural_strength = neural_strength + amount,
    last_accessed_at = now()
  where id = row_id;
end;
$$; `;
