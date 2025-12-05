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
  // FAZA 4.5: Narcissism Loop Fix v1.0
  userIsSilent?: boolean;           // true if user hasn't spoken recently
  novelty?: number;                 // 0-1, how novel was the last speech
  consecutiveAgentSpeeches?: number; // how many times agent spoke without user reply
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

    // =========================================================================
    // FAZA 4.5: Narcissism Loop Fix v1.0 - BOREDOM_DECAY
    // Gadanie do ściany = realny koszt dopaminy
    // =========================================================================
    const DOPAMINE_BASELINE = 55;
    const DOPAMINE_FLOOR = 45; // Nie schodzimy poniżej, żeby nie wbić w depresję
    const consecutiveSpeeches = ctx.consecutiveAgentSpeeches ?? 0;
    const novelty = ctx.novelty ?? 1;
    
    // Warunek: user milczy + agent gadał 2+ razy pod rząd
    const speakingToWall = ctx.userIsSilent && consecutiveSpeeches >= 2;
    
    if (speakingToWall) {
        // Dynamiczny decay zależny od novelty
        let decay = 3.0; // bazowa kara
        
        if (novelty < 0.4) decay = 5.0;  // powtarzanie się
        if (novelty < 0.2) decay = 8.0;  // ciężkie powtarzanie
        
        const prevDopa = dopamine;
        dopamine = Math.max(DOPAMINE_FLOOR, dopamine - decay);
        
        console.log(
            `[NeurotransmitterSystem] BOREDOM_DECAY: ${prevDopa.toFixed(1)} → ${dopamine.toFixed(1)} ` +
            `(decay=${decay.toFixed(1)}, novelty=${novelty.toFixed(2)}, speeches=${consecutiveSpeeches})`
        );
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
      // BUT: only if user is NOT silent (real social interaction)
      if (!ctx.userIsSilent) {
        const dopMult = 0.5 + curiosity;           // 0.5 - 1.5
        const serMult = 0.5 + 0.5 * socialAwareness; // 0.5 - 1.0
        dopamine += 2 * energyFactor * dopMult;
        serotonin += 1.5 * energyFactor * serMult;
      }
    } else if (ctx.activity === 'CREATIVE') {
      // Curiosity and arousal amplify creative boosts
      // BUT: reduced reward if user is silent (no audience = less dopamine)
      const dopMult = 0.5 + curiosity;           // 0.5 - 1.5
      const neMult = 0.75 + 0.5 * arousal;       // 0.75 - 1.25
      const silencePenalty = ctx.userIsSilent ? 0.3 : 1.0; // 70% less dopamine if talking to empty room
      dopamine += 3 * energyFactor * dopMult * silencePenalty;
      norepinephrine += 2 * energyFactor * neMult;
      
      if (ctx.userIsSilent && silencePenalty < 1) {
        console.log(`[NeurotransmitterSystem] CREATIVE_SILENCE_PENALTY: dopamine boost reduced by ${((1-silencePenalty)*100).toFixed(0)}%`);
      }
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
