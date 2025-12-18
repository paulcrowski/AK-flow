/**
 * StorageService - Unified localStorage wrapper
 * 
 * Jedna klasa, jedno miejsce dla wszystkich operacji localStorage.
 * Eliminuje rozsiane try/catch i localStorage.getItem/setItem.
 * 
 * @module services/StorageService
 */

const PREFIX = 'ak-flow:';

function safeGet(key: string): string | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string): boolean {
  try {
    if (typeof localStorage === 'undefined') return false;
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function safeRemove(key: string): boolean {
  try {
    if (typeof localStorage === 'undefined') return false;
    localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

export const StorageService = {
  // Session management
  getActiveSession(agentId: string): string | null {
    return safeGet(`${PREFIX}activeSession:${agentId}`);
  },

  setActiveSession(agentId: string, sessionId: string): boolean {
    return safeSet(`${PREFIX}activeSession:${agentId}`, sessionId);
  },

  // Pinned sessions
  getPinnedSessions(): string[] {
    const raw = safeGet('ak_pinned_sessions');
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  },

  setPinnedSessions(sessionIds: string[]): boolean {
    return safeSet('ak_pinned_sessions', JSON.stringify(sessionIds));
  },

  // Generic JSON storage
  getJSON<T>(key: string, fallback: T): T {
    const raw = safeGet(`${PREFIX}${key}`);
    if (!raw) return fallback;
    try {
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  },

  setJSON<T>(key: string, value: T): boolean {
    return safeSet(`${PREFIX}${key}`, JSON.stringify(value));
  },

  // Raw string storage
  get(key: string): string | null {
    return safeGet(`${PREFIX}${key}`);
  },

  set(key: string, value: string): boolean {
    return safeSet(`${PREFIX}${key}`, value);
  },

  remove(key: string): boolean {
    return safeRemove(`${PREFIX}${key}`);
  }
};

export default StorageService;
