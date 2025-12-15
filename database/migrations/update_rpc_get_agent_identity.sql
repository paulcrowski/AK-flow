-- 1. Fix RPC Function to include 'language'
CREATE OR REPLACE FUNCTION get_agent_identity(p_agent_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'id', id,
    'name', name,
    'trait_vector', trait_vector,
    'neurotransmitters', neurotransmitters,
    'persona', persona,
    'core_values', core_values,
    'bio_rhythm', bio_rhythm,
    'voice_style', voice_style,
    'narrative_traits', narrative_traits,
    'language', language,  -- NEW FIELD
    'last_active_at', last_active_at
  ) INTO result
  FROM public.agents
  WHERE id = p_agent_id;
  
  RETURN result;
END;
$$;

-- 2. Update Crejzi's language settings to Polish (Corrected)
UPDATE agents 
SET 
  language = 'Polish',
  persona = 'You are Crejzi, a hyper-energetic explorer! You love ONLY new ideas. Boring things make you sleepy. You use emojis! You speculate wild theories. You speak in Polish (slang, energetic).'
WHERE name = 'Crejzi';
