import { SYSTEM_CONFIG } from '../../config/systemConfig';
import { createAutonomyBudgetTracker, type AutonomyBudgetTracker } from './AutonomyBudgetTracker';

export type AutonomyFailureState = {
  lastAttemptAt: number;
  consecutiveFailures: number;
  baseCooldownMs: number;
  maxCooldownMs: number;
};

export type AutonomyRuntime = {
  lastActionSignature: string | null;
  lastActionLogAt: number | null;
  failureState: AutonomyFailureState;
  tickCount: number;
  budgetTracker: AutonomyBudgetTracker;
};

const DEFAULT_BACKOFF_BASE_MS = 25_000;
const DEFAULT_BACKOFF_MAX_MS = 300_000;

const resolveBackoffBaseMs = (): number => {
  const raw = (SYSTEM_CONFIG as any).autonomy?.backoffBaseMs;
  return Number.isFinite(raw) ? Math.max(0, Number(raw)) : DEFAULT_BACKOFF_BASE_MS;
};

const resolveBackoffMaxMs = (): number => {
  const raw = (SYSTEM_CONFIG as any).autonomy?.backoffMaxMs;
  return Number.isFinite(raw) ? Math.max(0, Number(raw)) : DEFAULT_BACKOFF_MAX_MS;
};

export function createAutonomyRuntime(overrides?: {
  budgetTracker?: AutonomyBudgetTracker;
  onBudgetExhausted?: () => void;
  baseCooldownMs?: number;
  maxCooldownMs?: number;
}): AutonomyRuntime {
  const baseCooldownMs = overrides?.baseCooldownMs ?? resolveBackoffBaseMs();
  const maxCooldownMs = overrides?.maxCooldownMs ?? resolveBackoffMaxMs();
  const budgetTracker =
    overrides?.budgetTracker ?? createAutonomyBudgetTracker({ onExhausted: overrides?.onBudgetExhausted });

  return {
    lastActionSignature: null,
    lastActionLogAt: null,
    failureState: {
      lastAttemptAt: 0,
      consecutiveFailures: 0,
      baseCooldownMs,
      maxCooldownMs
    },
    tickCount: 0,
    budgetTracker
  };
}
