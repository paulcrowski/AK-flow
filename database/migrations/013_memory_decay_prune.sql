create or replace function public.decay_memories_v1(p_agent_id uuid)
returns void
language sql
as $$
  update public.memories
  set neural_strength = greatest(1, neural_strength * 0.95)
  where agent_id = p_agent_id
    and coalesce(is_core_memory, false) = false
    and (last_accessed_at is null or last_accessed_at < now() - interval '7 days')
    and neural_strength >= 5;
$$;

create or replace function public.prune_memories_v1(p_agent_id uuid)
returns void
language sql
as $$
  delete from public.memories
  where agent_id = p_agent_id
    and coalesce(is_core_memory, false) = false
    and coalesce(salience, 0.5) < 0.2
    and neural_strength < 3
    and created_at < now() - interval '30 days';
$$;
