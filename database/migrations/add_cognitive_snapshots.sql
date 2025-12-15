-- ═══════════════════════════════════════════════════════════════════════════
-- COGNITIVE SNAPSHOTS TABLE
-- Przechowuje pełne snapshoty stanu kognitywnego agenta
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS cognitive_snapshots (
  id TEXT PRIMARY KEY,
  agent_id UUID NOT NULL,
  session_id TEXT NOT NULL,
  version TEXT NOT NULL DEFAULT '1.0',
  
  -- Metadata
  conversation_count INTEGER NOT NULL DEFAULT 0,
  runtime_messages_count INTEGER NOT NULL DEFAULT 0,
  logs_count INTEGER NOT NULL DEFAULT 0,
  
  -- Current state at snapshot time
  current_state JSONB NOT NULL DEFAULT '{}',
  
  -- State history (ring buffer export)
  state_history JSONB NOT NULL DEFAULT '[]',
  
  -- Full snapshot data (conversation + runtime + logs)
  full_data JSONB NOT NULL,
  
  -- Timestamps
  exported_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Foreign key (optional - agent may not exist)
  CONSTRAINT fk_snapshot_agent FOREIGN KEY (agent_id) 
    REFERENCES agents(id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_snapshots_agent ON cognitive_snapshots(agent_id);
CREATE INDEX IF NOT EXISTS idx_snapshots_session ON cognitive_snapshots(session_id);
CREATE INDEX IF NOT EXISTS idx_snapshots_exported ON cognitive_snapshots(exported_at DESC);

-- ═══════════════════════════════════════════════════════════════════════════
-- CONVERSATION ARCHIVE TABLE (jeśli nie istnieje)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS conversation_archive (
  id UUID PRIMARY KEY,
  agent_id UUID NOT NULL,
  session_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  timestamp BIGINT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT fk_archive_agent FOREIGN KEY (agent_id) 
    REFERENCES agents(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_archive_agent ON conversation_archive(agent_id);
CREATE INDEX IF NOT EXISTS idx_archive_session ON conversation_archive(session_id);
CREATE INDEX IF NOT EXISTS idx_archive_timestamp ON conversation_archive(timestamp DESC);

-- ═══════════════════════════════════════════════════════════════════════════
-- STATE TELEMETRY TABLE (periodic state saves - optional)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS state_telemetry (
  id SERIAL PRIMARY KEY,
  agent_id UUID NOT NULL,
  session_id TEXT NOT NULL,
  
  -- Limbic state
  fear REAL NOT NULL,
  curiosity REAL NOT NULL,
  frustration REAL NOT NULL,
  satisfaction REAL NOT NULL,
  
  -- Chemistry state
  dopamine REAL NOT NULL,
  serotonin REAL NOT NULL,
  norepinephrine REAL NOT NULL,
  
  -- Soma state
  energy REAL NOT NULL,
  cognitive_load REAL NOT NULL,
  is_sleeping BOOLEAN NOT NULL DEFAULT FALSE,
  
  -- Context
  active_goal TEXT,
  conversation_length INTEGER NOT NULL DEFAULT 0,
  
  -- Timestamp
  recorded_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT fk_telemetry_agent FOREIGN KEY (agent_id) 
    REFERENCES agents(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_telemetry_agent ON state_telemetry(agent_id);
CREATE INDEX IF NOT EXISTS idx_telemetry_session ON state_telemetry(session_id);
CREATE INDEX IF NOT EXISTS idx_telemetry_time ON state_telemetry(recorded_at DESC);

-- ═══════════════════════════════════════════════════════════════════════════
-- COMMENTS
-- ═══════════════════════════════════════════════════════════════════════════

COMMENT ON TABLE cognitive_snapshots IS 'Full cognitive state snapshots exported on demand';
COMMENT ON TABLE conversation_archive IS 'Full conversation history (beyond kernel limit)';
COMMENT ON TABLE state_telemetry IS 'Periodic state recordings for analysis';
