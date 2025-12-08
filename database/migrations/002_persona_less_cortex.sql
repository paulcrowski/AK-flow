-- ═══════════════════════════════════════════════════════════════
-- PERSONA-LESS CORTEX ARCHITECTURE - Database Schema
-- Version: 1.0
-- Date: 2025-12-08
-- ═══════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════
-- 1. CORE IDENTITY – stabilne, rzadko zmieniane (max 1x/miesiąc)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS core_identity (
  agent_id uuid PRIMARY KEY REFERENCES agents(id) ON DELETE CASCADE,
  name text NOT NULL,
  core_values text[] NOT NULL DEFAULT '{}',
  constitutional_constraints text[] NOT NULL DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  last_reviewed_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_core_identity_agent 
  ON core_identity(agent_id);

COMMENT ON TABLE core_identity IS 'Stabilna tożsamość agenta. Zmieniana tylko z potwierdzeniem użytkownika.';
COMMENT ON COLUMN core_identity.name IS 'Niezmienna nazwa agenta (np. Alberto, CREJZI-EXPLORER)';
COMMENT ON COLUMN core_identity.core_values IS 'Fundamentalne wartości (max 5), zmieniane max 1x/miesiąc';
COMMENT ON COLUMN core_identity.constitutional_constraints IS 'Niezmienne ograniczenia behawioralne';

-- ═══════════════════════════════════════════════════════════════
-- 2. NARRATIVE SELF – dynamiczne, aktualizowane w DreamConsolidation
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS narrative_self (
  agent_id uuid PRIMARY KEY REFERENCES agents(id) ON DELETE CASCADE,
  self_summary text,
  persona_tags text[] DEFAULT '{}',
  current_mood_narrative text,
  last_updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_narrative_self_agent 
  ON narrative_self(agent_id);

COMMENT ON TABLE narrative_self IS 'Dynamiczny obraz siebie. Aktualizowany co noc przez DreamConsolidation.';
COMMENT ON COLUMN narrative_self.self_summary IS 'Jedno-dwuzdaniowy opis siebie generowany z epizodów';
COMMENT ON COLUMN narrative_self.persona_tags IS 'Tagi osobowości (np. mentor, researcher), max 5';
COMMENT ON COLUMN narrative_self.current_mood_narrative IS 'Aktualny nastrój w formie narracji (zmienia się co godzinę)';

-- ═══════════════════════════════════════════════════════════════
-- 3. IDENTITY SHARDS – atomowe przekonania/preferencje/ograniczenia
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS identity_shards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('belief', 'preference', 'constraint')),
  content text NOT NULL,
  strength integer NOT NULL DEFAULT 50 CHECK (strength >= 1 AND strength <= 100),
  is_core boolean DEFAULT false,
  last_reinforced_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_identity_shards_agent 
  ON identity_shards(agent_id);
CREATE INDEX IF NOT EXISTS idx_identity_shards_strength 
  ON identity_shards(agent_id, strength DESC);
CREATE INDEX IF NOT EXISTS idx_identity_shards_core 
  ON identity_shards(agent_id) WHERE is_core = true;

COMMENT ON TABLE identity_shards IS 'Atomowe fragmenty tożsamości. Powstają i ewoluują w DreamConsolidation.';
COMMENT ON COLUMN identity_shards.kind IS 'Typ: belief (przekonanie), preference (preferencja), constraint (ograniczenie)';
COMMENT ON COLUMN identity_shards.strength IS 'Siła 1-100. Core shards nie spadają poniżej 50.';
COMMENT ON COLUMN identity_shards.is_core IS 'Core Anchor – chroni przed dryfem tożsamości';

-- ═══════════════════════════════════════════════════════════════
-- 4. ROZSZERZENIE MEMORIES – emocjonalne tagowanie dla style_examples
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE memories 
ADD COLUMN IF NOT EXISTS emotional_valence integer CHECK (emotional_valence >= -100 AND emotional_valence <= 100),
ADD COLUMN IF NOT EXISTS arousal_level integer CHECK (arousal_level >= 0 AND arousal_level <= 100),
ADD COLUMN IF NOT EXISTS tagged_emotions text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS style_rating numeric(3,1) CHECK (style_rating >= 0 AND style_rating <= 10),
ADD COLUMN IF NOT EXISTS interaction_context text,
ADD COLUMN IF NOT EXISTS memory_type text;

-- Index for style_examples query (high-rated SELF_SPEECH)
-- Note: memory_type column added above for categorization
CREATE INDEX IF NOT EXISTS idx_memories_style_examples 
  ON memories(agent_id, style_rating DESC NULLS LAST) 
  WHERE style_rating IS NOT NULL;

COMMENT ON COLUMN memories.emotional_valence IS 'Wartościowość emocjonalna (-100 negatywne, 0 neutralne, +100 pozytywne)';
COMMENT ON COLUMN memories.arousal_level IS 'Poziom pobudzenia (0 spokój, 100 ekscytacja)';
COMMENT ON COLUMN memories.tagged_emotions IS 'Tagi emocji (frustration, pride, curiosity, etc.)';
COMMENT ON COLUMN memories.style_rating IS 'Ocena jakości wypowiedzi 0-10, używana dla style_examples';
COMMENT ON COLUMN memories.interaction_context IS 'Kontekst: teaching, design_review, casual, research, debugging';
COMMENT ON COLUMN memories.memory_type IS 'Typ pamięci: SELF_SPEECH, USER_INPUT, EPISODE, etc.';

-- ═══════════════════════════════════════════════════════════════
-- 5. RELATIONSHIP – śledzenie relacji agent-user
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS agent_relationships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trust_level numeric(3,2) DEFAULT 0.50 CHECK (trust_level >= 0 AND trust_level <= 1),
  stage text DEFAULT 'new' CHECK (stage IN ('new', 'building', 'established', 'deep')),
  positive_signals integer DEFAULT 0,
  negative_signals integer DEFAULT 0,
  last_interaction_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  UNIQUE(agent_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_relationships_agent_user 
  ON agent_relationships(agent_id, user_id);

COMMENT ON TABLE agent_relationships IS 'Śledzenie relacji i zaufania między agentem a użytkownikiem';
COMMENT ON COLUMN agent_relationships.trust_level IS 'Poziom zaufania 0.00-1.00, aktualizowany przez SuccessSignalService';
COMMENT ON COLUMN agent_relationships.stage IS 'Etap relacji: new → building → established → deep';

-- ═══════════════════════════════════════════════════════════════
-- 6. ROW LEVEL SECURITY
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE core_identity ENABLE ROW LEVEL SECURITY;
ALTER TABLE narrative_self ENABLE ROW LEVEL SECURITY;
ALTER TABLE identity_shards ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_relationships ENABLE ROW LEVEL SECURITY;

-- Policies for core_identity
DROP POLICY IF EXISTS "Users can view own agents core_identity" ON core_identity;
CREATE POLICY "Users can view own agents core_identity" ON core_identity
  FOR SELECT USING (
    agent_id IN (SELECT id FROM agents WHERE user_id = auth.uid()::text)
  );

DROP POLICY IF EXISTS "Users can update own agents core_identity" ON core_identity;
CREATE POLICY "Users can update own agents core_identity" ON core_identity
  FOR UPDATE USING (
    agent_id IN (SELECT id FROM agents WHERE user_id = auth.uid()::text)
  );

DROP POLICY IF EXISTS "Users can insert own agents core_identity" ON core_identity;
CREATE POLICY "Users can insert own agents core_identity" ON core_identity
  FOR INSERT WITH CHECK (
    agent_id IN (SELECT id FROM agents WHERE user_id = auth.uid()::text)
  );

-- Policies for narrative_self
DROP POLICY IF EXISTS "Users can view own agents narrative_self" ON narrative_self;
CREATE POLICY "Users can view own agents narrative_self" ON narrative_self
  FOR SELECT USING (
    agent_id IN (SELECT id FROM agents WHERE user_id = auth.uid()::text)
  );

DROP POLICY IF EXISTS "Users can update own agents narrative_self" ON narrative_self;
CREATE POLICY "Users can update own agents narrative_self" ON narrative_self
  FOR UPDATE USING (
    agent_id IN (SELECT id FROM agents WHERE user_id = auth.uid()::text)
  );

DROP POLICY IF EXISTS "Users can insert own agents narrative_self" ON narrative_self;
CREATE POLICY "Users can insert own agents narrative_self" ON narrative_self
  FOR INSERT WITH CHECK (
    agent_id IN (SELECT id FROM agents WHERE user_id = auth.uid()::text)
  );

-- Policies for identity_shards
DROP POLICY IF EXISTS "Users can view own agents identity_shards" ON identity_shards;
CREATE POLICY "Users can view own agents identity_shards" ON identity_shards
  FOR SELECT USING (
    agent_id IN (SELECT id FROM agents WHERE user_id = auth.uid()::text)
  );

DROP POLICY IF EXISTS "Users can manage own agents identity_shards" ON identity_shards;
CREATE POLICY "Users can manage own agents identity_shards" ON identity_shards
  FOR ALL USING (
    agent_id IN (SELECT id FROM agents WHERE user_id = auth.uid()::text)
  );

-- Policies for agent_relationships
DROP POLICY IF EXISTS "Users can view own relationships" ON agent_relationships;
CREATE POLICY "Users can view own relationships" ON agent_relationships
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can manage own relationships" ON agent_relationships;
CREATE POLICY "Users can manage own relationships" ON agent_relationships
  FOR ALL USING (user_id = auth.uid());

-- ═══════════════════════════════════════════════════════════════
-- 7. SEED DATA – zainicjuj tożsamość dla istniejących agentów
-- ═══════════════════════════════════════════════════════════════
INSERT INTO core_identity (agent_id, name, core_values, constitutional_constraints)
SELECT 
  id,
  name,
  ARRAY['helpfulness', 'accuracy', 'clarity'],
  ARRAY['do not hallucinate', 'admit uncertainty']
FROM agents
WHERE id NOT IN (SELECT agent_id FROM core_identity)
ON CONFLICT (agent_id) DO NOTHING;

INSERT INTO narrative_self (agent_id, self_summary, persona_tags)
SELECT 
  id,
  'I am a cognitive assistant focused on helping with complex tasks.',
  ARRAY['assistant', 'analytical']
FROM agents
WHERE id NOT IN (SELECT agent_id FROM narrative_self)
ON CONFLICT (agent_id) DO NOTHING;

-- Utwórz domyślne core shardy
INSERT INTO identity_shards (agent_id, kind, content, strength, is_core)
SELECT 
  id,
  'belief',
  'I value accuracy and clarity in my responses.',
  70,
  true
FROM agents
WHERE id NOT IN (SELECT DISTINCT agent_id FROM identity_shards WHERE is_core = true);
