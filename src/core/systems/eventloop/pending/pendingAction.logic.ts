import type {
  PendingAction,
  PendingResolveResult,
  EmitPendingTelemetryFn
} from './pendingAction.types';
import { PENDING_ACTION_TTL_MS } from './pendingAction.types';
import { isPendingActionExpired, isCancelCommand } from './pendingAction.helpers';

export function clearPendingAction(
  ctx: any,
  reason: 'timeout' | 'executed' | 'superseded' | 'cancelled' | 'error',
  emitTelemetry: EmitPendingTelemetryFn,
  extra?: Record<string, unknown>
): void {
  const old = ctx.pendingAction as PendingAction | null;
  ctx.pendingAction = null;
  if (old) {
    const eventType = reason === 'timeout'
      ? 'EXPIRED'
      : reason === 'executed'
        ? 'USED'
        : reason === 'cancelled'
          ? 'CANCELLED'
          : reason === 'superseded'
            ? 'SUPERSEDED'
            : 'ERROR';
    emitTelemetry(eventType, old, { reason, ...extra });
  }
}

export function setPendingAction(
  ctx: any,
  action: PendingAction,
  emitTelemetry: EmitPendingTelemetryFn
): void {
  if (ctx.pendingAction) {
    emitTelemetry('SUPERSEDED', ctx.pendingAction as PendingAction);
  }
  ctx.pendingAction = action;
  emitTelemetry('SET', action);
}

export function createPendingAction(
  type: PendingAction['type'],
  targetId: string,
  targetName: string,
  originalUserInput: string,
  ttlMs: number = PENDING_ACTION_TTL_MS
): PendingAction {
  return {
    type,
    targetId,
    targetName,
    createdAt: Date.now(),
    expiresAt: Date.now() + ttlMs,
    originalUserInput
  };
}

export interface ResolveDependencies {
  detectActionableIntent: (input: string) => { handled: boolean; action?: string; target?: string };
  isRecognizableTarget: (target: string) => boolean;
  isImplicitReference: (target: string) => boolean;
  emitTelemetry: EmitPendingTelemetryFn;
}

export function tryResolvePendingAction(
  ctx: any,
  userInput: string,
  deps: ResolveDependencies
): PendingResolveResult {
  const pending = ctx.pendingAction as PendingAction | null;
  if (!pending) return { handled: false };

  const { detectActionableIntent, isRecognizableTarget, isImplicitReference, emitTelemetry } = deps;

  if (isPendingActionExpired(pending)) {
    clearPendingAction(ctx, 'timeout', emitTelemetry);
    return { handled: true, action: 'expired' };
  }

  if (isCancelCommand(userInput)) {
    clearPendingAction(ctx, 'cancelled', emitTelemetry, { reason: 'user_cancel' });
    return { handled: true, action: 'cancelled' };
  }

  const newIntent = detectActionableIntent(userInput);
  if (newIntent.handled && newIntent.action && newIntent.target) {
    const target = String(newIntent.target || '').trim();
    if (isRecognizableTarget(target) && !isImplicitReference(target)) {
      clearPendingAction(ctx, 'superseded', emitTelemetry);
      return { handled: false, action: 'superseded' };
    }
  }

  const payload = userInput.trim();
  if (!payload) return { handled: false };

  let syntheticCommand = '';
  if (pending.type === 'APPEND_CONTENT') {
    syntheticCommand = `dopisz do ${pending.targetId} ${payload}`;
  } else if (pending.type === 'REPLACE_CONTENT') {
    syntheticCommand = `edytuj ${pending.targetId}: ${payload}`;
  } else {
    return { handled: false };
  }

  const testIntent = detectActionableIntent(syntheticCommand);
  const testTarget = String(testIntent.target || '').trim();
  if (!testIntent.handled || !testIntent.action || !testTarget || !isRecognizableTarget(testTarget)) {
    clearPendingAction(ctx, 'error', emitTelemetry, {
      errorType: 'synthetic_mismatch',
      syntheticCommand: syntheticCommand.slice(0, 100)
    });
    return { handled: false };
  }

  clearPendingAction(ctx, 'executed', emitTelemetry);
  return { handled: true, syntheticCommand, action: 'executed' };
}
