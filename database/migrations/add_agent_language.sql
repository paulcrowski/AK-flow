-- ═══════════════════════════════════════════════════════════════════════════
-- ADD LANGUAGE FIELD TO AGENTS
-- Language determines speech_content language (e.g., 'English', 'Polish')
-- Default: 'English' - all agents speak English unless specified otherwise
-- ═══════════════════════════════════════════════════════════════════════════

-- Add language column to agents table
ALTER TABLE agents
ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'English';

-- Update Crejzi to Polish for testing
UPDATE agents 
SET language = 'Polish' 
WHERE name = 'Crejzi';

-- Comment
COMMENT ON COLUMN agents.language IS 'Language for speech_content (e.g., English, Polish). Default: English';
