import type { AgentTrajectory } from '../../kernel/types';

export type TrajectoryPatch = Partial<Omit<AgentTrajectory, 'updatedAt' | 'tickNumber'>>;

const createDefaultTrajectory = (): AgentTrajectory => ({
  nextStep: null,
  outcome: null,
  friction: null,
  retryPolicy: null,
  updatedAt: null,
  tickNumber: null
});

export const applyTrajectoryUpdate = (
  current: AgentTrajectory | null | undefined,
  patch: TrajectoryPatch,
  tickNumber: number,
  now: number = Date.now()
): AgentTrajectory => {
  const base = current ?? createDefaultTrajectory();
  return {
    ...base,
    ...patch,
    tickNumber,
    updatedAt: now
  };
};
