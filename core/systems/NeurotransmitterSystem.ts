import { SomaState } from '../../types';

export interface NeurotransmitterState {
  dopamine: number;      // 0-100
  serotonin: number;     // 0-100
  norepinephrine: number;// 0-100
}

export type ActivityType = 'IDLE' | 'SOCIAL' | 'CREATIVE' | 'REPETITIVE';

export interface NeuroContext {
  soma: SomaState;
  activity: ActivityType;
}

export const clampNeuro = (v: number) => Math.max(0, Math.min(100, v));

export const applyHomeostasis = (value: number, target = 50, rate = 0.05): number => {
  const delta = (target - value) * rate;
  return clampNeuro(value + delta);
};

export const NeurotransmitterSystem = {
  applyHomeostasis,

  updateNeuroState(prev: NeurotransmitterState, ctx: NeuroContext): NeurotransmitterState {
    let { dopamine, serotonin, norepinephrine } = prev;

    // Base homeostasis toward mid-levels (no punishments, only gentle pull to baseline)
    dopamine = applyHomeostasis(dopamine, 55);      // slight optimistic bias
    serotonin = applyHomeostasis(serotonin, 60);    // stable satisfaction baseline
    norepinephrine = applyHomeostasis(norepinephrine, 50);

    // Activity-based boosts (all non-negative, AGI-optimistic)
    const energy = ctx.soma.energy; // 0-100
    const energyFactor = Math.max(0.5, Math.min(1.5, energy / 50)); // 0.5 .. 1.5

    if (ctx.activity === 'SOCIAL') {
      dopamine += 2 * energyFactor;
      serotonin += 1.5 * energyFactor;
    } else if (ctx.activity === 'CREATIVE') {
      dopamine += 3 * energyFactor;
      norepinephrine += 2 * energyFactor;
    } else if (ctx.activity === 'REPETITIVE') {
      // Keep it neutral-to-slightly-positive, no boredom punishment
      serotonin += 0.5 * energyFactor;
    } else {
      // IDLE: very small gentle drift
      serotonin += 0.2;
    }

    return {
      dopamine: clampNeuro(dopamine),
      serotonin: clampNeuro(serotonin),
      norepinephrine: clampNeuro(norepinephrine)
    };
  }
};
