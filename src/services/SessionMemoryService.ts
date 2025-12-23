/**
 * SessionMemoryService - Source of Truth dla bieżącej sesji
 * 
 * ARCHITEKTURA:
 * Centralne źródło informacji o sesji:
 * - Ile razy rozmawialiśmy dzisiaj/w tym tygodniu
 * - Kiedy była ostatnia rozmowa
 * - Podsumowanie tematów z ostatnich sesji
 * 
 * UŻYCIE:
 * Agent może odpowiedzieć "rozmawialiśmy 3 razy dzisiaj" zamiast zgadywać.
 * 
 * @module services/SessionMemoryService
 */

import { supabase } from './supabase';
import { getCurrentAgentId } from './supabase';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface SessionStats {
  /** Liczba sesji dzisiaj */
  sessionsToday: number;
  /** Liczba sesji wczoraj */
  sessionsYesterday: number;
  /** Liczba sesji w tym tygodniu */
  sessionsThisWeek: number;
  /** Liczba wiadomości dzisiaj */
  messagesToday: number;
  /** Timestamp ostatniej interakcji */
  lastInteractionAt: string | null;
  /** Czas trwania ostatniej sesji (minuty) */
  lastSessionDurationMin: number;
  /** Główne tematy z ostatnich sesji */
  recentTopics: string[];
}

export interface SessionSummary {
  sessionId: string;
  startedAt: string;
  endedAt: string;
  messageCount: number;
  topicSummary: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const CACHE_TTL_MS = 60000; // 1 minute cache

// ═══════════════════════════════════════════════════════════════════════════
// CACHE
// ═══════════════════════════════════════════════════════════════════════════

let cachedStats: SessionStats | null = null;
let cacheTimestamp = 0;

// ═══════════════════════════════════════════════════════════════════════════
// SERVICE
// ═══════════════════════════════════════════════════════════════════════════

export const SessionMemoryService = {
  
  /**
   * Get session statistics for current agent.
   * Cached for 1 minute to avoid excessive DB calls.
   */
  async getSessionStats(): Promise<SessionStats> {
    const agentId = getCurrentAgentId();
    
    if (!agentId) {
      return this.getEmptyStats();
    }
    
    // Check cache
    if (cachedStats && Date.now() - cacheTimestamp < CACHE_TTL_MS) {
      return cachedStats;
    }
    
    try {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const yesterdayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).toISOString();
      
      // Query messages from today
      const { data: todayMessages, error: todayError } = await supabase
        .from('conversation_archive')
        .select('timestamp, session_id, content')
        .eq('agent_id', agentId)
        .gte('timestamp', Date.parse(todayStart))
        .order('timestamp', { ascending: false });
      
      if (todayError) {
        console.warn('[SessionMemory] Today query failed:', todayError.message);
        return this.getEmptyStats();
      }
      
      // Query messages from this week
      const { data: weekMessages, error: weekError } = await supabase
        .from('conversation_archive')
        .select('timestamp, session_id')
        .eq('agent_id', agentId)
        .gte('timestamp', Date.parse(weekStart))
        .order('timestamp', { ascending: false });
      
      if (weekError) {
        console.warn('[SessionMemory] Week query failed:', weekError.message);
      }
      
      // Calculate stats
      const todaySessions = new Set((todayMessages || []).map(m => m.session_id));
      const weekSessions = new Set((weekMessages || []).map(m => m.session_id));

      const yesterdayStartMs = Date.parse(yesterdayStart);
      const todayStartMs = Date.parse(todayStart);
      const yesterdaySessions = new Set(
        (weekMessages || [])
          .filter((m: any) => {
            const ts = Number(m?.timestamp);
            return Number.isFinite(ts) && ts >= yesterdayStartMs && ts < todayStartMs;
          })
          .map((m: any) => m.session_id)
      );
      
      // Extract recent topics (simple: first 5 words of last 3 user messages)
      const recentTopics = (todayMessages || [])
        .filter((m: any) => m.content?.startsWith('User:'))
        .slice(0, 3)
        .map((m: any) => {
          const text = m.content?.replace('User:', '').trim() || '';
          return text.split(' ').slice(0, 5).join(' ');
        })
        .filter((t: string) => t.length > 0);
      
      // Last interaction
      const lastMessage = (todayMessages || [])[0];
      const lastInteractionAt = lastMessage ? new Date(lastMessage.timestamp).toISOString() : null;
      
      // Last session duration (approximate)
      const lastSessionId = lastMessage?.session_id;
      const lastSessionMessages = (todayMessages || []).filter((m: any) => m.session_id === lastSessionId);
      let lastSessionDurationMin = 0;
      if (lastSessionMessages.length >= 2) {
        const first = lastSessionMessages[lastSessionMessages.length - 1].timestamp;
        const last = lastSessionMessages[0].timestamp;
        lastSessionDurationMin = Math.round((last - first) / 60000);
      }
      
      const stats: SessionStats = {
        sessionsToday: todaySessions.size,
        sessionsYesterday: yesterdaySessions.size,
        sessionsThisWeek: weekSessions.size,
        messagesToday: (todayMessages || []).length,
        lastInteractionAt,
        lastSessionDurationMin,
        recentTopics
      };
      
      // Update cache
      cachedStats = stats;
      cacheTimestamp = Date.now();
      
      return stats;
      
    } catch (err) {
      console.error('[SessionMemory] Error fetching stats:', err);
      return this.getEmptyStats();
    }
  },

  /**
   * Safe wrapper: never throws, always returns stats.
   */
  async getSessionStatsSafe(): Promise<SessionStats> {
    try {
      return await this.getSessionStats();
    } catch (err) {
      console.warn('[SessionMemory] Safe fallback triggered:', (err as Error)?.message || err);
      return this.getEmptyStats();
    }
  },
  
  /**
   * Get empty stats (fallback).
   */
  getEmptyStats(): SessionStats {
    return {
      sessionsToday: 0,
      sessionsYesterday: 0,
      sessionsThisWeek: 0,
      messagesToday: 0,
      lastInteractionAt: null,
      lastSessionDurationMin: 0,
      recentTopics: []
    };
  },
  
  /**
   * Format stats as human-readable string for LLM context.
   */
  formatForContext(stats: SessionStats): string {
    const lines: string[] = [];
    
    if (stats.sessionsToday > 0) {
      lines.push(`- Sessions today: ${stats.sessionsToday}`);
      lines.push(`- Messages today: ${stats.messagesToday}`);
    } else {
      lines.push('- This is the first conversation today');
    }
    
    if (stats.sessionsThisWeek > stats.sessionsToday) {
      lines.push(`- Sessions this week: ${stats.sessionsThisWeek}`);
    }

    if (stats.sessionsYesterday > 0) {
      lines.push(`- Sessions yesterday: ${stats.sessionsYesterday}`);
    } else {
      lines.push('- No sessions yesterday');
    }
    
    if (stats.lastInteractionAt) {
      const lastTime = new Date(stats.lastInteractionAt);
      const now = new Date();
      const diffMin = Math.round((now.getTime() - lastTime.getTime()) / 60000);
      
      if (diffMin < 60) {
        lines.push(`- Last interaction: ${diffMin} minutes ago`);
      } else if (diffMin < 1440) {
        lines.push(`- Last interaction: ${Math.round(diffMin / 60)} hours ago`);
      } else {
        lines.push(`- Last interaction: ${Math.round(diffMin / 1440)} days ago`);
      }
    }
    
    if (stats.recentTopics.length > 0) {
      lines.push(`- Recent topics: ${stats.recentTopics.join('; ')}`);
    }
    
    return lines.length > 0 ? lines.join('\n') : '- No prior session data';
  },
  
  /**
   * Invalidate cache (call after new messages).
   */
  invalidateCache(): void {
    cachedStats = null;
    cacheTimestamp = 0;
  },
  
  /**
   * Get session count for specific date range.
   */
  async getSessionCountForDateRange(
    startDate: Date,
    endDate: Date
  ): Promise<number> {
    const agentId = getCurrentAgentId();
    if (!agentId) return 0;
    
    try {
      const { data, error } = await supabase
        .from('conversation_archive')
        .select('session_id')
        .eq('agent_id', agentId)
        .gte('timestamp', startDate.getTime())
        .lte('timestamp', endDate.getTime());
      
      if (error) {
        console.warn('[SessionMemory] Date range query failed:', error.message);
        return 0;
      }
      
      const uniqueSessions = new Set((data || []).map(m => m.session_id));
      return uniqueSessions.size;
      
    } catch (err) {
      console.error('[SessionMemory] Error:', err);
      return 0;
    }
  }
};

export default SessionMemoryService;
