-- Migration: Add style_prefs column to agents table
-- Date: 2025-12-15
-- Purpose: Store agent-specific style preferences (emoji, length, tone)
-- Part of: FAZA 6 - Soft Homeostasis / StyleGuard integration

-- Add style_prefs JSONB column with default empty object
ALTER TABLE agents 
ADD COLUMN IF NOT EXISTS style_prefs JSONB DEFAULT '{}';

-- Add comment for documentation
COMMENT ON COLUMN agents.style_prefs IS 
  'Style preferences as part of agent personality. Keys: noEmoji (bool), maxLength (int), noExclamation (bool), formalTone (bool)';

-- Example: Set Crezji as expressive (no style restrictions)
-- UPDATE agents SET style_prefs = '{"noEmoji": false, "formalTone": false}' WHERE name = 'Crezji';

-- Example: Set professional agent as formal
-- UPDATE agents SET style_prefs = '{"noEmoji": true, "formalTone": true, "maxLength": 300}' WHERE name = 'Professional';

-- Index for potential queries (optional)
-- CREATE INDEX IF NOT EXISTS idx_agents_style_prefs ON agents USING GIN (style_prefs);
