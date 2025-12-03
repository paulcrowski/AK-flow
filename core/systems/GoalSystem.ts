// GoalSystem.ts - FAZA 3: Goal Formation (11/10)

import { LimbicState, SomaState, NeurotransmitterState, Goal, GoalState } from '../../types';

export interface GoalContext {
  now: number;
  lastUserInteractionAt: number;
  soma: SomaState;
  neuro: NeurotransmitterState;
  limbic: LimbicState;
}

const GOAL_SYSTEM_ENABLED = true;
const GOAL_MIN_SILENCE_MS = 60_000;
const GOAL_MAX_PER_HOUR = 5;

export function shouldConsiderGoal(ctx: GoalContext, goalState: GoalState): boolean {
  if (!GOAL_SYSTEM_ENABLED) return false;

  const silenceMs = ctx.now - ctx.lastUserInteractionAt;

  const enoughSilence = silenceMs > GOAL_MIN_SILENCE_MS;
  const enoughEnergy = ctx.soma.energy > 30;
  const notOverwhelmed = ctx.limbic.frustration < 0.8 && ctx.limbic.fear < 0.9;
  const cutoff = ctx.now - 60 * 60 * 1000;
  const recentGoals = (goalState.goalsFormedTimestamps || []).filter(t => t >= cutoff);
  const underHourlyLimit = recentGoals.length < GOAL_MAX_PER_HOUR;

  return enoughSilence && enoughEnergy && notOverwhelmed && underHourlyLimit;
}

export async function formGoal(ctx: GoalContext, goalState: GoalState): Promise<Goal | null> {
  if (!shouldConsiderGoal(ctx, goalState)) return null;

  const highFearOrFrustration = ctx.limbic.fear > 0.6 || ctx.limbic.frustration > 0.6;

  const source: Goal['source'] = highFearOrFrustration ? 'empathy' : 'curiosity';

  const description =
    source === 'empathy'
      ? 'Sprawdź, jak czuje się użytkownik i odnieś się do wcześniejszej rozmowy.'
      : 'Zaproponuj nowy wątek do eksploracji, powiązany z ostatnimi tematami.';

  const priority = source === 'empathy' ? 0.9 : 0.6;

  return {
    id: `goal-${ctx.now}`,
    description,
    priority,
    progress: 0,
    source,
    createdAt: ctx.now,
  };
}
