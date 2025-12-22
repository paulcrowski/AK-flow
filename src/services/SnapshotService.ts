/**
 * SnapshotService - Eksport na żądanie (conversation + runtime + logs)
 * 
 * NIE loguje ciągle - eksportuje tylko gdy user poprosi.
 * Zapobiega memory leak przez fire-and-forget do DB.
 */

import { supabase } from './supabase';
import { getConversationHistory } from './ConversationArchive';
import { 
  exportLogs, 
  exportStateSnapshots, 
  LogEntry, 
  StateSnapshot 
} from '../core/utils/RingBuffer';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface ConversationSnapshot {
  type: 'conversation';
  agentId: string;
  sessionId: string;
  messages: Array<{
    id: string;
    role: string;
    content: string;
    timestamp: number;
  }>;
  totalCount: number;
  exportedAt: number;
}

export interface RuntimeSnapshot {
  type: 'runtime';
  agentId: string;
  sessionId: string;
  recentMessages: Array<{
    id: string;
    role: string;
    content: string;
    timestamp: number;
  }>;
  currentState: {
    limbic: { fear: number; curiosity: number; frustration: number; satisfaction: number };
    chemistry: { dopamine: number; serotonin: number; norepinephrine: number };
    soma: { energy: number; cognitiveLoad: number; isSleeping: boolean };
    activeGoal?: string;
  };
  stateHistory: StateSnapshot[];
  exportedAt: number;
}

export interface LogSnapshot {
  type: 'logs';
  agentId: string;
  sessionId: string;
  logs: LogEntry[];
  bufferSize: number;
  exportedAt: number;
}

export interface FullSnapshot {
  version: string;
  agentId: string;
  sessionId: string;
  exportedAt: number;
  conversation: ConversationSnapshot;
  runtime: RuntimeSnapshot;
  logs: LogSnapshot;
}

// ═══════════════════════════════════════════════════════════════════════════
// SNAPSHOT FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Eksportuje pełną historię rozmów z DB
 */
export async function exportConversationSnapshot(
  agentId: string,
  sessionId: string,
  limit: number = 1000
): Promise<ConversationSnapshot> {
  const messages = await getConversationHistory(agentId, sessionId, limit);
  
  return {
    type: 'conversation',
    agentId,
    sessionId,
    messages: messages.map(m => ({
      id: m.id,
      role: m.role,
      content: m.content,
      timestamp: m.timestamp
    })),
    totalCount: messages.length,
    exportedAt: Date.now()
  };
}

/**
 * Eksportuje runtime snapshot (ostatnie 50 + stany z kernela)
 */
export function exportRuntimeSnapshot(
  agentId: string,
  sessionId: string,
  kernelState: {
    conversation: Array<{ id: string; role: string; content: string; timestamp: number }>;
    limbicState: { fear: number; curiosity: number; frustration: number; satisfaction: number };
    chemState: { dopamine: number; serotonin: number; norepinephrine: number };
    somaState: { energy: number; cognitiveLoad: number; isSleeping: boolean };
    activeGoal?: { description: string };
  }
): RuntimeSnapshot {
  const stateHistory = exportStateSnapshots();
  
  return {
    type: 'runtime',
    agentId,
    sessionId,
    recentMessages: kernelState.conversation.slice(-50).map(m => ({
      id: m.id,
      role: m.role,
      content: m.content,
      timestamp: m.timestamp
    })),
    currentState: {
      limbic: kernelState.limbicState,
      chemistry: kernelState.chemState,
      soma: kernelState.somaState,
      activeGoal: kernelState.activeGoal?.description
    },
    stateHistory,
    exportedAt: Date.now()
  };
}

/**
 * Eksportuje logi z ring buffera
 */
export function exportLogSnapshot(
  agentId: string,
  sessionId: string,
  lastN?: number
): LogSnapshot {
  const logs = exportLogs(lastN);
  
  return {
    type: 'logs',
    agentId,
    sessionId,
    logs,
    bufferSize: logs.length,
    exportedAt: Date.now()
  };
}

/**
 * Eksportuje PEŁNY snapshot (wszystko w jednym)
 */
export async function exportFullSnapshot(
  agentId: string,
  sessionId: string,
  kernelState: {
    conversation: Array<{ id: string; role: string; content: string; timestamp: number }>;
    limbicState: { fear: number; curiosity: number; frustration: number; satisfaction: number };
    chemState: { dopamine: number; serotonin: number; norepinephrine: number };
    somaState: { energy: number; cognitiveLoad: number; isSleeping: boolean };
    activeGoal?: { description: string };
  }
): Promise<FullSnapshot> {
  const [conversation] = await Promise.all([
    exportConversationSnapshot(agentId, sessionId)
  ]);
  
  const runtime = exportRuntimeSnapshot(agentId, sessionId, kernelState);
  const logs = exportLogSnapshot(agentId, sessionId);
  
  return {
    version: '1.0',
    agentId,
    sessionId,
    exportedAt: Date.now(),
    conversation,
    runtime,
    logs
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// DATABASE OPERATIONS (fire-and-forget)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Zapisuje snapshot do bazy danych
 * Fire-and-forget - nie blokuje UI
 */
export async function saveSnapshotToDb(snapshot: FullSnapshot): Promise<string | null> {
  if (!supabase) {
    console.warn('[SnapshotService] Supabase not configured');
    return null;
  }
  
  const snapshotId = `snap-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    const { error } = await supabase
      .from('cognitive_snapshots')
      .insert({
        id: snapshotId,
        agent_id: snapshot.agentId,
        session_id: snapshot.sessionId,
        version: snapshot.version,
        conversation_count: snapshot.conversation.totalCount,
        runtime_messages_count: snapshot.runtime.recentMessages.length,
        logs_count: snapshot.logs.bufferSize,
        current_state: snapshot.runtime.currentState,
        state_history: snapshot.runtime.stateHistory,
        exported_at: new Date(snapshot.exportedAt).toISOString(),
        full_data: snapshot
      });
    
    if (error) {
      console.error('[SnapshotService] SAVE_FAIL:', error.message);
      return null;
    }
    
    console.log(`[SnapshotService] SNAPSHOT_SAVED id=${snapshotId}`);
    return snapshotId;
  } catch (err) {
    console.error('[SnapshotService] SAVE_ERROR:', err);
    return null;
  }
}

/**
 * Pobiera snapshot z bazy
 */
export async function loadSnapshotFromDb(snapshotId: string): Promise<FullSnapshot | null> {
  if (!supabase) return null;
  
  try {
    const { data, error } = await supabase
      .from('cognitive_snapshots')
      .select('full_data')
      .eq('id', snapshotId)
      .single();
    
    if (error || !data) {
      console.error('[SnapshotService] LOAD_FAIL:', error?.message);
      return null;
    }
    
    return data.full_data as FullSnapshot;
  } catch (err) {
    console.error('[SnapshotService] LOAD_ERROR:', err);
    return null;
  }
}

/**
 * Lista wszystkich snapshotów dla agenta
 */
export async function listSnapshots(
  agentId: string,
  limit: number = 20
): Promise<Array<{ id: string; exportedAt: string; conversationCount: number; logsCount: number }>> {
  if (!supabase) return [];
  
  try {
    const { data, error } = await supabase
      .from('cognitive_snapshots')
      .select('id, exported_at, conversation_count, logs_count')
      .eq('agent_id', agentId)
      .order('exported_at', { ascending: false })
      .limit(limit);
    
    if (error) {
      console.error('[SnapshotService] LIST_FAIL:', error.message);
      return [];
    }
    
    return (data || []).map(row => ({
      id: row.id,
      exportedAt: row.exported_at,
      conversationCount: row.conversation_count,
      logsCount: row.logs_count
    }));
  } catch (err) {
    console.error('[SnapshotService] LIST_ERROR:', err);
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// DOWNLOAD (Local File)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Pobiera snapshot jako plik JSON
 */
export function downloadSnapshot(snapshot: FullSnapshot): void {
  const json = JSON.stringify(snapshot, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `ak-flow-snapshot-${snapshot.sessionId}-${snapshot.exportedAt}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  
  console.log('[SnapshotService] DOWNLOAD_COMPLETE');
}
