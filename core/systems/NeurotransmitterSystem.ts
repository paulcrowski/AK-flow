import { SomaState, TraitVector } from '../../types';
import { clamp01, clamp100, clampRange } from '../../utils/math';

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
  // FAZA 5.1: RPE (Reward Prediction Error) based decay
  hadExternalReward?: boolean;      // true if user replied, tool succeeded, or goal completed
  ticksSinceLastReward?: number;    // how many ticks since last external reward
}

export const clampNeuro = (v: number) => clamp100(v);

/**
 * Asymmetric homeostasis - faster decay when ABOVE baseline.
 * Rationale: Dopamine should drop faster without external rewards.
 * At dopamine=100, baseline=55: delta = (55-100) * 0.15 = -6.75/tick
 * At dopamine=30, baseline=55: delta = (55-30) * 0.05 = +1.25/tick
 */
export const applyHomeostasis = (value: number, target = 50, rate = 0.05): number => {
  const distance = target - value;
  // 3x faster decay when above baseline (prevents dopamine ceiling)
  const effectiveRate = value > target ? rate * 3 : rate;
  const delta = distance * effectiveRate;
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
    
    // =========================================================================
    // FAZA 5.1: RPE (Reward Prediction Error) - "talking to yourself is not rewarding"
    // If no external reward (user reply, tool success, goal completion) for N ticks,
    // dopamine decays progressively. This is biological: no feedback = no reward signal.
    // =========================================================================
    const ticksSinceReward = ctx.ticksSinceLastReward ?? 0;
    const hadReward = ctx.hadExternalReward ?? false;
    
    if (!hadReward && ticksSinceReward > 2) {
        // Progressive RPE decay: the longer without reward, the faster decay
        // tick 3: decay 2, tick 4: decay 3, tick 5+: decay 4
        const rpeDecay = Math.min(4, ticksSinceReward - 1);
        const prevDopa = dopamine;
        dopamine = Math.max(DOPAMINE_FLOOR, dopamine - rpeDecay);
        
        if (rpeDecay > 0 && prevDopa !== dopamine) {
            console.log(
                `[NeurotransmitterSystem] RPE_DECAY: ${prevDopa.toFixed(1)} → ${dopamine.toFixed(1)} ` +
                `(ticks_since_reward=${ticksSinceReward}, decay=${rpeDecay})`
            );
        }
    }
    
    // TELEMETRY: DOPAMINE_DECAY_TICK (ChatGPT suggestion for debugging)
    // Always log dopamine changes for observability
    const dopaAfterDecay = dopamine;
    console.log(
        `[NeurotransmitterSystem] DOPAMINE_TICK: prev=${prev.dopamine.toFixed(1)}, ` +
        `afterDecay=${dopaAfterDecay.toFixed(1)}, ` +
        `hadReward=${hadReward}, ticksSinceReward=${ticksSinceReward}, ` +
        `activity=${ctx.activity}, userSilent=${ctx.userIsSilent}`
    );

    // Base homeostasis toward mid-levels (no punishments, only gentle pull to baseline)
    dopamine = applyHomeostasis(dopamine, DOPAMINE_BASELINE);      // slight optimistic bias
    serotonin = applyHomeostasis(serotonin, 60);    // stable satisfaction baseline
    norepinephrine = applyHomeostasis(norepinephrine, 50);

    // Activity-based boosts (all non-negative, AGI-optimistic)
    const energy = ctx.soma.energy; // 0-100
    const energyFactor = clampRange(energy / 50, 0.5, 1.5); // 0.5 .. 1.5

    // Temperament modulation: all effects remain non-negative and bounded
    const curiosity = clamp01(traits.curiosity);
    const conscientiousness = clamp01(traits.conscientiousness);
    const socialAwareness = clamp01(traits.socialAwareness);
    const arousal = clamp01(traits.arousal);

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
      // FAZA 5.1: CREATIVE = exploration = COST, not reward!
      // ChatGPT/Karpathy insight: "Dopamine rewards being useful to the world, not being smart to yourself"
      // CREATIVE activity raises arousal/norepinephrine (alertness), but does NOT give dopamine.
      // Dopamine only comes from EXTERNAL confirmation (user reply, tool success).
      
      const neMult = 0.75 + 0.5 * arousal;       // 0.75 - 1.25
      norepinephrine += 2 * energyFactor * neMult;
      
      // Only give dopamine if user is NOT silent (external audience = real reward)
      if (!ctx.userIsSilent) {
        const dopMult = 0.5 + curiosity;         // 0.5 - 1.5
        dopamine += 2 * energyFactor * dopMult;  // Reduced from 3 to 2
        console.log(`[NeurotransmitterSystem] CREATIVE_WITH_AUDIENCE: dopamine boost +${(2 * energyFactor * dopMult).toFixed(1)}`);
      } else {
        // No dopamine for talking to yourself!
        console.log(`[NeurotransmitterSystem] CREATIVE_NO_AUDIENCE: NO dopamine boost (user silent)`);
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
