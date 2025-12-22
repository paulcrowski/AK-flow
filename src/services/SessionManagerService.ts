import { StorageService } from './StorageService';

export const SessionManagerService = {
  createSessionId(): string {
    return `sess_${Date.now()}`;
  },

  getActiveSessionId(agentId: string): string | null {
    const raw = StorageService.getActiveSession(agentId);
    const trimmed = (raw || '').trim();
    return trimmed ? trimmed : null;
  },

  getOrCreateActiveSessionId(agentId: string): string {
    const existing = SessionManagerService.getActiveSessionId(agentId);
    if (existing) return existing;

    const next = SessionManagerService.createSessionId();
    StorageService.setActiveSession(agentId, next);
    return next;
  },

  setActiveSessionId(agentId: string, sessionId: string): void {
    const trimmed = (sessionId || '').trim();
    if (!trimmed) return;
    StorageService.setActiveSession(agentId, trimmed);
  }
};

export default SessionManagerService;
