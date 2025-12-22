export type ThinkMode = 'reactive' | 'goal_driven' | 'autonomous' | 'idle';

export const ThinkModeSelector = {
  select(input: string | null, autonomousMode: boolean, hasActiveGoal: boolean): ThinkMode {
    if (input) return 'reactive';
    if (!autonomousMode) return 'idle';
    if (hasActiveGoal) return 'goal_driven';
    return 'autonomous';
  }
};
