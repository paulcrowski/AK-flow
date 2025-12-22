/**
 * ConversationArchive - Archiwizuje wiadomości do bazy danych
 * 
 * Fire-and-forget - nie blokuje UI
 * Kernel trzyma 50 wiadomości, DB trzyma wszystko
 */

import { supabase } from './supabase';
import { eventBus } from '../core/EventBus';
import { AgentType, PacketType } from '../types';
import { generateUUID } from '../utils/uuid';

 const sanitizeJson = (input: unknown): Record<string, any> => {
   if (!input || typeof input !== 'object') return {};
   try {
     return JSON.parse(JSON.stringify(input)) as Record<string, any>;
   } catch {
     return {};
   }
 };

export interface ConversationTurn {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export interface ConversationSessionSummary {
  sessionId: string;
  lastTimestamp: number;
  messageCount: number;
  preview?: string;
}

/**
 * Archiwizuje wiadomość do bazy danych
 * Fire-and-forget — nie blokuje UI
 */
export async function archiveMessage(
  message: ConversationTurn,
  agentId: string,
  sessionId: string
): Promise<void> {
  if (!supabase) {
    console.warn('[ConversationArchive] Supabase not configured, skipping');
    return;
  }
  
  try {
    const wantsMetadata = Boolean(
      message.metadata &&
        typeof message.metadata === 'object' &&
        Object.keys(message.metadata as any).length > 0
    );

    const basePayload = {
      id: message.id,
      agent_id: agentId,
      session_id: sessionId,
      role: message.role,
      content: message.content,
      timestamp: message.timestamp
    };

    const payloadWithMetadata = wantsMetadata
      ? { ...basePayload, metadata: sanitizeJson(message.metadata) }
      : { ...basePayload, metadata: {} };

    const attempt1 = await supabase
      .from('conversation_archive')
      .upsert(payloadWithMetadata, {
        onConflict: 'id'
      });

    let error = attempt1.error;

    if (error && wantsMetadata) {
      const attempt2 = await supabase
        .from('conversation_archive')
        .upsert(basePayload, {
          onConflict: 'id'
        });
      error = attempt2.error;
    }
    
    if (error) {
      console.error('[ConversationArchive] ARCHIVE_FAIL:', error.message);

      eventBus.publish({
        id: generateUUID(),
        timestamp: Date.now(),
        source: AgentType.CORTEX_FLOW,
        type: PacketType.SYSTEM_ALERT,
        payload: {
          event: 'CONV_ARCHIVE_FAIL',
          agentId,
          sessionId,
          error: String(error.message || error)
        },
        priority: 0.2
      });
      return;
    }
    
    console.log(`[ConversationArchive] ARCHIVE_OK id=${message.id}`);

    eventBus.publish({
      id: generateUUID(),
      timestamp: Date.now(),
      source: AgentType.CORTEX_FLOW,
      type: PacketType.SYSTEM_ALERT,
      payload: {
        event: 'CONV_ARCHIVE_OK',
        agentId,
        sessionId,
        role: message.role
      },
      priority: 0.05
    });
  } catch (err) {
    console.error('[ConversationArchive] ARCHIVE_ERROR:', err);

    eventBus.publish({
      id: generateUUID(),
      timestamp: Date.now(),
      source: AgentType.CORTEX_FLOW,
      type: PacketType.SYSTEM_ALERT,
      payload: {
        event: 'CONV_ARCHIVE_ERROR',
        agentId,
        sessionId,
        error: String((err as any)?.message ?? err)
      },
      priority: 0.2
    });
  }
}

/**
 * Pobiera historię z bazy (dla badań)
 */
export async function getConversationHistory(
  agentId: string,
  sessionId?: string,
  limit: number = 100
): Promise<ConversationTurn[]> {
  if (!supabase) {
    console.warn('[ConversationArchive] Supabase not configured');
    return [];
  }
  
  try {
    let query = supabase
      .from('conversation_archive')
      .select('*')
      .eq('agent_id', agentId)
      .order('timestamp', { ascending: false })
      .limit(limit);
    
    if (sessionId) {
      query = query.eq('session_id', sessionId);
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error('[ConversationArchive] Fetch failed:', error.message);
      return [];
    }
    
    return (data || []).map(row => ({
      id: row.id,
      role: row.role,
      content: row.content,
      timestamp: row.timestamp,
      metadata: row.metadata
    }));
  } catch (err) {
    console.error('[ConversationArchive] FETCH_ERROR:', err);
    return [];
  }
}

/**
 * Pobiera liczbę wiadomości w archiwum
 */
export async function getArchiveCount(agentId: string): Promise<number> {
  if (!supabase) return 0;
  
  try {
    const { count, error } = await supabase
      .from('conversation_archive')
      .select('*', { count: 'exact', head: true })
      .eq('agent_id', agentId);
    
    if (error) {
      console.error('[ConversationArchive] Count failed:', error.message);
      return 0;
    }
    
    return count || 0;
  } catch (err) {
    console.error('[ConversationArchive] COUNT_ERROR:', err);
    return 0;
  }
}

export async function getRecentSessions(
  agentId: string,
  opts?: { limitSessions?: number; scanLimit?: number }
): Promise<ConversationSessionSummary[]> {
  if (!supabase) {
    console.warn('[ConversationArchive] Supabase not configured');
    return [];
  }

  const limitSessions = opts?.limitSessions ?? 25;
  const scanLimit = opts?.scanLimit ?? 500;

  try {
    const { data, error } = await supabase
      .from('conversation_archive')
      .select('session_id,timestamp,content')
      .eq('agent_id', agentId)
      .order('timestamp', { ascending: false })
      .limit(scanLimit);

    if (error) {
      console.error('[ConversationArchive] Sessions fetch failed:', error.message);
      return [];
    }

    const bySession = new Map<string, ConversationSessionSummary>();

    for (const row of data || []) {
      const sessionId = String((row as any).session_id || '');
      const ts = Number((row as any).timestamp);
      const content = String((row as any).content || '');

      if (!sessionId || !Number.isFinite(ts)) continue;

      const existing = bySession.get(sessionId);
      if (!existing) {
        bySession.set(sessionId, {
          sessionId,
          lastTimestamp: ts,
          messageCount: 1,
          preview: content ? content.slice(0, 120) : undefined
        });
        continue;
      }

      existing.messageCount += 1;
      if (ts > existing.lastTimestamp) {
        existing.lastTimestamp = ts;
        existing.preview = content ? content.slice(0, 120) : existing.preview;
      }
    }

    return Array.from(bySession.values())
      .sort((a, b) => b.lastTimestamp - a.lastTimestamp)
      .slice(0, limitSessions);
  } catch (err) {
    console.error('[ConversationArchive] SESSIONS_ERROR:', err);
    return [];
  }
}
