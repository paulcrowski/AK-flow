import type { KernelEvent, KernelOutput, KernelReducerResult, KernelState } from '../../types';

export function handleGoalFormed(state: KernelState, event: KernelEvent, outputs: KernelOutput[]): KernelReducerResult {
  const payload = event.payload as { goal: string; priority: number } | undefined;
  if (!payload?.goal) {
    return { nextState: state, outputs };
  }

  const newGoal = {
    id: `goal_${event.timestamp}`,
    description: payload.goal,
    priority: payload.priority ?? 0.5,
    progress: 0,
    source: 'user' as const,
    createdAt: event.timestamp
  };

  const nextState: KernelState = {
    ...state,
    goalState: {
      ...state.goalState,
      activeGoal: newGoal as any,
      goalsFormedTimestamps: [...state.goalState.goalsFormedTimestamps.slice(-9), event.timestamp],
      lastGoalFormedAt: event.timestamp,
      lastGoals: [...state.goalState.lastGoals.slice(-4), { description: payload.goal, timestamp: event.timestamp, source: 'kernel' }]
    }
  };

  outputs.push({
    type: 'LOG',
    payload: { message: `GOAL FORMED: ${payload.goal}` }
  });

  return { nextState, outputs };
}

export function handleGoalCompleted(state: KernelState, outputs: KernelOutput[]): KernelReducerResult {
  const completedGoal = state.goalState.activeGoal;

  const nextState: KernelState = {
    ...state,
    goalState: {
      ...state.goalState,
      activeGoal: null
    }
  };

  if (completedGoal) {
    outputs.push({
      type: 'LOG',
      payload: { message: `GOAL COMPLETED: ${completedGoal}` }
    });
  }

  return { nextState, outputs };
}
