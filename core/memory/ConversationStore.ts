/**
 * ConversationStore - Unified Conversation Memory Layer
 * 
 * ARCHITEKTURA:
 * ┌─────────────────────────────────────────────────────────────────┐
 * │                    ConversationStore                            │
 * │  (unified API - save/load/clear conversation)                   │
 * └────────────────────┬────────────────────┬───────────────────────┘
 *                      │                    │
 *          ┌───────────▼──────────┐ ┌───────▼──────────┐
 *          │   localStorage       │ │    Supabase      │
 *          │   (cache/fallback)   │ │    (primary)     │
 *          └──────────────────────┘ └──────────────────┘
 * 
 * ZASADY:
 * 1. localStorage = szybki cache + offline fallback
 * 2. Supabase = trwały storage cross-device
 * 3. Zapis: do obu jednocześnie (fire-and-forget Supabase)
 * 4. Odczyt: localStorage first, Supabase fallback gdy pusty
 * 
 * @module core/memory/ConversationStore
 */

import type { ConversationSnapshotTurn } from '../utils/conversationSnapshot';
import {
  loadConversationSnapshot,
  saveConversationSnapshot,
  parseConversationSnapshot
} from '../utils/conversationSnapshot';
import { getConversationHistory } from '../../services/ConversationArchive';
import { isMemorySubEnabled } from '../config/featureFlags';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface ConversationTurn {
  id?: string;
  role: string;
  text: string;
  type?: 'thought' | 'speech' | 'visual' | 'intel' | 'action' | 'tool_result';
  knowledgeSource?: 'memory' | 'tool' | 'llm' | 'mixed' | 'system';
  evidenceSource?: 'memory' | 'tool' | 'system';
  evidenceDetail?: string;
  generator?: 'llm' | 'system';
  timestamp?: number;
}

export interface LoadResult {
  turns: ConversationTurn[];
  source: 'localStorage' | 'supabase' | 'empty';
}

// ═══════════════════════════════════════════════════════════════════════════
// CONVERSION HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function snapshotToTurn(snap: ConversationSnapshotTurn): ConversationTurn {
  return {
    role: snap.role,
    text: snap.text,
    type: snap.type,
    knowledgeSource: snap.knowledgeSource,
    evidenceSource: snap.evidenceSource,
    evidenceDetail: snap.evidenceDetail,
    generator: snap.generator
  };
}

function turnToSnapshot(turn: ConversationTurn): ConversationSnapshotTurn {
  return {
    role: turn.role,
    text: turn.text,
    type: turn.type,
    knowledgeSource: turn.knowledgeSource,
    evidenceSource: turn.evidenceSource,
    evidenceDetail: turn.evidenceDetail,
    generator: turn.generator
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN API
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Ładuje konwersację z cache (localStorage) lub DB (Supabase fallback)
 * 
 * @param agentId - ID agenta
 * @param sessionId - ID sesji (dla Supabase fallback)
 * @returns LoadResult z turns i źródłem
 */
export async function loadConversation(
  agentId: string,
  sessionId?: string
): Promise<LoadResult> {
  // 1. Try localStorage first (fast, offline-capable)
  const localSnap = loadConversationSnapshot(agentId);
  if (localSnap.length > 0) {
    return {
      turns: localSnap.map(snapshotToTurn),
      source: 'localStorage'
    };
  }

  // 2. If localStorage empty and Supabase fallback enabled, try DB
  if (sessionId && isMemorySubEnabled('supabaseFallback')) {
    try {
      const dbHistory = await getConversationHistory(agentId, sessionId, 50);
      if (dbHistory.length > 0) {
        const turns: ConversationTurn[] = dbHistory.map(msg => ({
          id: msg.id,
          role: msg.role,
          text: msg.content,
          type: 'speech' as const,
          timestamp: msg.timestamp
        }));

        // Cache to localStorage for next time
        saveConversationSnapshot(agentId, turns.map(turnToSnapshot));

        return {
          turns,
          source: 'supabase'
        };
      }
    } catch (err) {
      console.warn('[ConversationStore] Supabase fallback failed:', err);
    }
  }

  // 3. Empty
  return {
    turns: [],
    source: 'empty'
  };
}

/**
 * Zapisuje konwersację do localStorage (sync) + Supabase archive jest osobno
 * 
 * NOTE: Supabase archiving dzieje się przez ConversationArchive.archiveMessage()
 * wywoływane w useCognitiveKernelLite po każdej wiadomości.
 * Tu zapisujemy tylko localStorage cache dla szybkiego hydrate.
 * 
 * @param agentId - ID agenta
 * @param turns - Tablica turnów do zapisania
 */
export function saveConversation(agentId: string, turns: ConversationTurn[]): void {
  saveConversationSnapshot(agentId, turns.map(turnToSnapshot));
}

/**
 * Czyści konwersację w localStorage
 * 
 * @param agentId - ID agenta
 */
export function clearConversation(agentId: string): void {
  saveConversationSnapshot(agentId, []);
}

/**
 * Parsuje raw JSON do turnów (dla importu/testów)
 */
export function parseConversation(raw: string): ConversationTurn[] {
  const snaps = parseConversationSnapshot(raw);
  return snaps.map(snapshotToTurn);
}

// ═══════════════════════════════════════════════════════════════════════════
// SYNC HELPERS (for React state)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Synchronizuje React state → localStorage
 * Wywołuj w useEffect gdy conversation się zmienia
 */
export function syncToLocalStorage(
  agentId: string | undefined,
  conversation: Array<{ role: string; text: string; type?: string; [key: string]: unknown }>
): void {
  if (!agentId) return;

  const turns: ConversationTurn[] = conversation.map(c => ({
    role: c.role,
    text: c.text,
    type: c.type as ConversationTurn['type'],
    knowledgeSource: c.knowledgeSource as ConversationTurn['knowledgeSource'],
    evidenceSource: c.evidenceSource as ConversationTurn['evidenceSource'],
    evidenceDetail: c.evidenceDetail as string | undefined,
    generator: c.generator as ConversationTurn['generator']
  }));

  saveConversation(agentId, turns);
}
