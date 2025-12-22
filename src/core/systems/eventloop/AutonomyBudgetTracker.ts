export type AutonomyBudgetTracker = {
  checkBudget: (limit: number) => boolean;
  consume: () => void;
  peekCount: () => number;
};

export function createAutonomyBudgetTracker(deps?: {
  now?: () => number;
  onExhausted?: () => void;
}): AutonomyBudgetTracker {
  const nowFn = deps?.now ?? (() => Date.now());

  let autonomousOpsThisMinute = 0;
  let lastBudgetReset = nowFn();

  function checkBudget(limit: number): boolean {
    const now = nowFn();
    if (now - lastBudgetReset > 60000) {
      autonomousOpsThisMinute = 0;
      lastBudgetReset = now;
    }
    if (autonomousOpsThisMinute >= limit) {
      deps?.onExhausted?.();
      return false;
    }
    return true;
  }

  function consume(): void {
    autonomousOpsThisMinute++;
  }

  function peekCount(): number {
    return autonomousOpsThisMinute;
  }

  return { checkBudget, consume, peekCount };
}
