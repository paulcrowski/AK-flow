import { supabase, getCurrentAgentId } from './supabase';
import { CortexService } from '../llm/gemini';

export interface SessionChunkSummaryJson {
  goal?: string;
  decisions?: string[];
  conflicts?: string[];
  outcome?: string;
  errors?: string[];
  lessons?: string[];
  topics?: string[];
}

export interface SessionChunk {
  id?: string;
  agentId: string;
  sessionId: string;
  startTime?: string;
  endTime?: string;
  summary_json: SessionChunkSummaryJson;
  summary_text: string;
  topics: string[];
  strength?: number;
}

function toIsoTimestamp(value: unknown): string | null {
  const num = typeof value === 'number' ? value : Number(value);
  if (Number.isFinite(num)) return new Date(num).toISOString();
  const asDate = new Date(String(value || ''));
  if (!Number.isNaN(asDate.getTime())) return asDate.toISOString();
  return null;
}

export const SessionChunkService = {
  async buildAndStoreLatestSessionChunk(agentName: string): Promise<boolean> {
    const agentId = getCurrentAgentId();
    if (!agentId) return false;

    const last = await supabase
      .from('conversation_archive')
      .select('session_id,timestamp')
      .eq('agent_id', agentId)
      .order('timestamp', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (last.error || !last.data?.session_id) return false;
    const sessionId = String(last.data.session_id);

    const turns = await supabase
      .from('conversation_archive')
      .select('role,content,timestamp')
      .eq('agent_id', agentId)
      .eq('session_id', sessionId)
      .order('timestamp', { ascending: true })
      .limit(200);

    if (turns.error || !turns.data?.length) return false;

    const transcript = turns.data
      .slice(-120)
      .map((t) => `${t.role}: ${String(t.content).slice(0, 500)}`)
      .join('\n');

    const schema = {
      type: 'OBJECT',
      properties: {
        goal: { type: 'STRING' },
        decisions: { type: 'ARRAY', items: { type: 'STRING' } },
        conflicts: { type: 'ARRAY', items: { type: 'STRING' } },
        outcome: { type: 'STRING' },
        errors: { type: 'ARRAY', items: { type: 'STRING' } },
        lessons: { type: 'ARRAY', items: { type: 'STRING' } },
        topics: { type: 'ARRAY', items: { type: 'STRING' } }
      },
      required: ['topics']
    };

    const prompt = `You are ${agentName}. Summarize the session into a compact model.
Return JSON only.

TRANSCRIPT:
${transcript}
`;

    const parsed = await CortexService.generateJSON<SessionChunkSummaryJson>(prompt, schema, { topics: [] });

    const summaryText = [
      parsed.goal ? `Goal: ${parsed.goal}` : '',
      Array.isArray(parsed.decisions) ? `Decisions: ${parsed.decisions.slice(0, 6).join(' | ')}` : '',
      Array.isArray(parsed.lessons) ? `Lessons: ${parsed.lessons.slice(0, 6).join(' | ')}` : ''
    ]
      .filter(Boolean)
      .join('\n');

    const startTime = toIsoTimestamp(turns.data[0].timestamp) || undefined;
    const endTime = toIsoTimestamp(turns.data[turns.data.length - 1].timestamp) || undefined;

    const ins = await supabase.from('session_chunks').insert({
      agent_id: agentId,
      session_id: sessionId,
      start_time: startTime,
      end_time: endTime,
      summary_json: parsed,
      summary_text: summaryText || 'session summary',
      topics: Array.isArray(parsed.topics) ? parsed.topics.slice(0, 12) : [],
      strength: 50
    });

    return !ins.error;
  },

  async fetchRecentSessionChunks(agentId: string, limit: number = 6): Promise<SessionChunk[]> {
    const { data, error } = await supabase
      .from('session_chunks')
      .select('id, session_id, start_time, end_time, summary_json, summary_text, topics, strength')
      .eq('agent_id', agentId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error || !data) return [];

    return data.map((row: any) => ({
      id: row.id,
      agentId,
      sessionId: String(row.session_id || ''),
      startTime: row.start_time || undefined,
      endTime: row.end_time || undefined,
      summary_json: row.summary_json || {},
      summary_text: String(row.summary_text || ''),
      topics: Array.isArray(row.topics) ? row.topics : [],
      strength: typeof row.strength === 'number' ? row.strength : undefined
    }));
  },

  async fetchSessionChunksInRange(
    agentId: string,
    rangeStartMs: number,
    rangeEndMs: number,
    limit: number = 12
  ): Promise<SessionChunk[]> {
    const startIso = new Date(rangeStartMs).toISOString();
    const endIso = new Date(rangeEndMs).toISOString();

    const { data, error } = await supabase
      .from('session_chunks')
      .select('id, session_id, start_time, end_time, summary_json, summary_text, topics, strength, created_at')
      .eq('agent_id', agentId)
      .gte('created_at', startIso)
      .lte('created_at', endIso)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error || !data) return [];

    return data.map((row: any) => ({
      id: row.id,
      agentId,
      sessionId: String(row.session_id || ''),
      startTime: row.start_time || undefined,
      endTime: row.end_time || undefined,
      summary_json: row.summary_json || {},
      summary_text: String(row.summary_text || ''),
      topics: Array.isArray(row.topics) ? row.topics : [],
      strength: typeof row.strength === 'number' ? row.strength : undefined
    }));
  }
};
