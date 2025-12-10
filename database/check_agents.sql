-- ============================================================
-- SQL INSPECTION: Check Agent States
-- Run this to view current agent personalities/traits
-- ============================================================

SELECT 
    name, 
    user_id,
    left(persona, 60) || '...' as persona_preview,
    trait_vector,
    bio_rhythm
FROM agents
ORDER BY created_at;
