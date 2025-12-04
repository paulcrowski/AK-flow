import { SomaState, TraitVector } from '../../types';

export interface NeurotransmitterState {
  dopamine: number;      // 0-100
  serotonin: number;     // 0-100
  norepinephrine: number;// 0-100
}

export type ActivityType = 'IDLE' | 'SOCIAL' | 'CREATIVE' | 'REPETITIVE';

export interface NeuroContext {
  soma: SomaState;
  activity: ActivityType;
  temperament: TraitVector; // NEW: Temperament / personality vector (FAZA 4)
  // FAZA 4.5: Boredom detection
  userIsSilent?: boolean;      // true if user hasn't spoken recently
  speechOccurred?: boolean;    // true if agent just spoke
  novelty?: number;            // 0-1, how novel was the last speech
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

    const traits = ctx.temperament;

    // FAZA 4.5: Spadek dopaminy przy nudzie (gadanie do pustki bez nowości)
    // Jeśli user milczy, agent mówił, i novelty < 0.5 → dopamina spada
    const DOPAMINE_BASELINE = 55;
    const BOREDOM_DECAY = 3; // punkty na tick
    
    if (ctx.userIsSilent && ctx.speechOccurred && (ctx.novelty ?? 1) < 0.5) {
        // Nuda = spadek dopaminy, ale nie poniżej baseline
        dopamine = Math.max(DOPAMINE_BASELINE, dopamine - BOREDOM_DECAY);
        console.log(`[NeurotransmitterSystem] BOREDOM_DECAY: dopamine ${prev.dopamine.toFixed(0)} → ${dopamine.toFixed(0)} (novelty=${(ctx.novelty ?? 1).toFixed(2)}, userSilent=${ctx.userIsSilent})`);
    }

    // Base homeostasis toward mid-levels (no punishments, only gentle pull to baseline)
    dopamine = applyHomeostasis(dopamine, DOPAMINE_BASELINE);      // slight optimistic bias
    serotonin = applyHomeostasis(serotonin, 60);    // stable satisfaction baseline
    norepinephrine = applyHomeostasis(norepinephrine, 50);

    // Activity-based boosts (all non-negative, AGI-optimistic)
    const energy = ctx.soma.energy; // 0-100
    const energyFactor = Math.max(0.5, Math.min(1.5, energy / 50)); // 0.5 .. 1.5

    // Temperament modulation: all effects remain non-negative and bounded
    const curiosity = Math.max(0, Math.min(1, traits.curiosity));
    const conscientiousness = Math.max(0, Math.min(1, traits.conscientiousness));
    const socialAwareness = Math.max(0, Math.min(1, traits.socialAwareness));
    const arousal = Math.max(0, Math.min(1, traits.arousal));

    if (ctx.activity === 'SOCIAL') {
      // Curious + socially aware agents get more reward from social connection
      const dopMult = 0.5 + curiosity;           // 0.5 - 1.5
      const serMult = 0.5 + 0.5 * socialAwareness; // 0.5 - 1.0
      dopamine += 2 * energyFactor * dopMult;
      serotonin += 1.5 * energyFactor * serMult;
    } else if (ctx.activity === 'CREATIVE') {
      // Curiosity and arousal amplify creative boosts
      const dopMult = 0.5 + curiosity;           // 0.5 - 1.5
      const neMult = 0.75 + 0.5 * arousal;       // 0.75 - 1.25
      dopamine += 3 * energyFactor * dopMult;
      norepinephrine += 2 * energyFactor * neMult;
    } else if (ctx.activity === 'REPETITIVE') {
      // High conscientiousness: less reward for repetition (but still non-negative)
      const repMult = 1 - 0.5 * conscientiousness; // 1.0 - 0.5
      serotonin += 0.5 * energyFactor * repMult;
    } else {
      // IDLE: very small gentle drift, slightly higher for socially tuned agents
      const idleMult = 0.5 + 0.5 * socialAwareness; // 0.5 - 1.0
      serotonin += 0.2 * idleMult;
    }

    return {
      dopamine: clampNeuro(dopamine),
      serotonin: clampNeuro(serotonin),
      norepinephrine: clampNeuro(norepinephrine)
    };
  }
};
