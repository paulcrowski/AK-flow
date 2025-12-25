alter table public.identity_shards
  add column if not exists contradiction_count int default 0,
  add column if not exists evidence_refs uuid[] default '{}',
  add column if not exists last_updated timestamptz default now();

create or replace function public.increment_contradiction_count(
  p_shard_id uuid
)
returns int
language sql
as $$
update public.identity_shards
set
  contradiction_count = coalesce(contradiction_count, 0) + 1,
  last_updated = now()
where id = p_shard_id
returning contradiction_count;
$$;
