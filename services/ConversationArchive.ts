/**
 * ConversationArchive - Archiwizuje wiadomości do bazy danych
 * 
 * Fire-and-forget - nie blokuje UI
 * Kernel trzyma 50 wiadomości, DB trzyma wszystko
 */

import { supabase } from './supabase';

export interface ConversationTurn {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
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
    const { error } = await supabase
      .from('conversation_archive')
      .upsert({
        id: message.id,
        agent_id: agentId,
        session_id: sessionId,
        role: message.role,
        content: message.content,
        timestamp: message.timestamp,
        metadata: message.metadata || {},
      }, {
        onConflict: 'id'
      });
    
    if (error) {
      console.error('[ConversationArchive] ARCHIVE_FAIL:', error.message);
      return;
    }
    
    console.log(`[ConversationArchive] ARCHIVE_OK id=${message.id}`);
  } catch (err) {
    console.error('[ConversationArchive] ARCHIVE_ERROR:', err);
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
