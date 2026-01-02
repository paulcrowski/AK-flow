export type PendingActionType = 'APPEND_CONTENT' | 'REPLACE_CONTENT';

export interface PendingAction {
  type: PendingActionType;
  targetId: string;
  targetName?: string;
  createdAt: number;
  expiresAt: number;
  originalUserInput: string;
}

export const PENDING_ACTION_TTL_MS = 2 * 60 * 1000;

export type PendingActionEvent = 'SET' | 'USED' | 'EXPIRED' | 'SUPERSEDED' | 'CANCELLED' | 'ERROR';

export interface PendingResolveResult {
  handled: boolean;
  syntheticCommand?: string;
  action?: 'expired' | 'cancelled' | 'cancelled_no_pending' | 'executed' | 'superseded';
}

export type EmitPendingTelemetryFn = (
  event: PendingActionEvent,
  action: PendingAction,
  extra?: Record<string, unknown>
) => void;
