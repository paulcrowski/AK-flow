create or replace function public.boost_memory_strength(
  p_memory_id uuid,
  p_delta int,
  p_set_core boolean default false
)
returns void
language sql
as $$
  update public.memories
  set
    neural_strength = least(100, greatest(1, neural_strength + p_delta)),
    is_core_memory = case
      when p_set_core then true
      else is_core_memory
    end,
    last_accessed_at = now()
  where id = p_memory_id;
$$;
