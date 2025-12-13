import { TraitVector, NeurotransmitterState, SomaState, InteractionContextType } from '../../types';
import { getExpressionConfig } from '../config/systemConfig';

export interface ExpressionInput {
  internalThought?: string;
  responseText: string;
  goalAlignment: number; // 0-1
  noveltyScore: number;  // 0-1
  socialCost: number;    // 0-1 (higher = more cringe / repetition / self-focus)
  context?: InteractionContextType; // FAZA 4.5: Narcissism Loop Fix
  userIsSilent?: boolean; // FAZA 4.5: true if user hasn't spoken recently
  consecutiveAgentSpeeches?: number; // FAZA 4.5: how many times agent spoke without user reply
}

export interface ExpressionDecision {
  say: boolean;
  text: string;
  noveltyScore: number;
  socialCost: number;
  baseScore: number;
  threshold: number;
}

// Lightweight novelty heuristic: overlap of tokens with last messages handled outside.
export function clamp01(x: number): number {
  if (Number.isNaN(x)) return 0;
  return Math.max(0, Math.min(1, x));
}

// ============================================================================
// MODULAR FILTERS (FAZA 4.5 Refactor)
// Each filter is a pure function that can be tested independently
// ============================================================================

/**
 * Applies narcissism penalty for self-focused speech in autonomous mode.
 * Returns updated socialCost and noveltyScore.
 */
function applyNarcissismFilter(
  text: string,
  socialCost: number,
  noveltyScore: number,
  context: InteractionContextType | undefined
): { socialCost: number; noveltyScore: number } {
  if (context !== 'GOAL_EXECUTED') {
    return { socialCost, noveltyScore };
  }
  
  const narcissism = calculateNarcissismScore(text);
  const config = getExpressionConfig();
  
  // Threshold from config - agent should feel that self-talk is "boring"
  if (narcissism > config.narcissismPenaltyThreshold) {
    const penalty = Math.min(0.5, (narcissism - config.narcissismPenaltyThreshold) * 2); // 0-0.5
    socialCost += penalty;
    noveltyScore -= penalty * 0.5;
    console.log(`[ExpressionPolicy] Narcissism detected: ${(narcissism * 100).toFixed(1)}% → socialCost +${penalty.toFixed(2)}`);
  }
  
  return { socialCost, noveltyScore };
}

/**
 * Applies dopamine breaker for high-dopamine + low-novelty autonomous speech.
 * Returns whether to mute and potentially shortened text.
 */
function applyDopamineBreaker(
  text: string,
  say: boolean,
  noveltyScore: number,
  goalAlignment: number,
  dopamine: number,
  context: InteractionContextType | undefined,
  shadowMode: boolean
): { say: boolean; text: string } {
  if (context !== 'GOAL_EXECUTED' || shadowMode) {
    return { say, text };
  }
  
  // Autonarration rule: max 1-2 sentences by default
  text = shortenToFirstSentences(text, 2);
  
  // Soft penalty for low novelty
  if (noveltyScore < 0.8) {
    text = shortenToFirstSentences(text, 1);
  }
  if (noveltyScore < 0.6) {
    if (goalAlignment < 0.8 && Math.random() > 0.3) say = false;
  }
  if (noveltyScore < 0.4) {
    say = false; // Hard mute for low novelty autonomy
  }
  
  // Dopamine Breaker: agent is "high" and looping
  if (dopamine >= 95 && noveltyScore < 0.5) {
    const breakChance = 0.8 - (goalAlignment * 0.5); // 0.3-0.8 chance to mute
    if (Math.random() < breakChance) {
      say = false;
      console.log(`[ExpressionPolicy] DOPAMINE BREAKER: dopamine=${dopamine.toFixed(0)}, novelty=${noveltyScore.toFixed(2)} → muting`);
    }
  }
  
  return { say, text };
}

/**
 * FAZA 4.5: Narcissism Loop Fix v1.0 - Silent Monologue Breaker
 * Applies progressive muting for autonomous speech when user is silent.
 * Works in both GOAL_EXECUTED and SHADOW_MODE contexts.
 */
function applySilentMonologueBreaker(
  text: string,
  say: boolean,
  noveltyScore: number,
  dopamine: number,
  context: InteractionContextType | undefined,
  userIsSilent: boolean,
  consecutiveSpeeches: number,
  shadowMode: boolean
): { say: boolean; text: string } {
  const isAutonomousSpeech = 
    context === 'GOAL_EXECUTED' || 
    context === 'SHADOW_MODE' || 
    (context === 'USER_REPLY' && userIsSilent);
  
  const silentMonologue = userIsSilent && isAutonomousSpeech;
  
  if (!silentMonologue) {
    return { say, text };
  }
  
  // ==========================================================================
  // NARCISSISM BREAKER: Progressive muting based on dopamine + novelty
  // ==========================================================================
  
  // Level 1: Shorten water-pouring (dopamine >= 65, novelty < 0.5)
  if (dopamine >= 65 && noveltyScore < 0.5) {
    text = shortenToFirstSentences(text, 2);
    console.log(`[ExpressionPolicy] Silent monologue shortened (L1): dopa=${dopamine.toFixed(0)}, novelty=${noveltyScore.toFixed(2)}`);
  }
  
  // Level 2: Even more aggressive (dopamine >= 70, novelty < 0.35)
  if (dopamine >= 70 && noveltyScore < 0.35) {
    text = shortenToFirstSentences(text, 1);
    console.log(`[ExpressionPolicy] Silent monologue shortened (L2): dopa=${dopamine.toFixed(0)}, novelty=${noveltyScore.toFixed(2)}`);
  }
  
  // Level 3: Hard mute at dopamine high + very low novelty
  if (dopamine >= 75 && noveltyScore < 0.25) {
    console.log(
      `[ExpressionPolicy] NARCISSISM_BREAKER: dopa=${dopamine.toFixed(0)}, novelty=${noveltyScore.toFixed(2)}, ` +
      `speeches=${consecutiveSpeeches} → MUTED`
    );
    return { say: false, text: '' };
  }
  
  // Level 4: Mute after 3+ consecutive speeches with low novelty (even in shadow mode)
  if (consecutiveSpeeches >= 3 && noveltyScore < 0.4) {
    console.log(
      `[ExpressionPolicy] MONOLOGUE_LIMIT: speeches=${consecutiveSpeeches}, novelty=${noveltyScore.toFixed(2)} → MUTED`
    );
    return { say: false, text: '' };
  }
  
  // Legacy DEEP_WORK mute (very high dopamine + very low novelty)
  if (dopamine >= 95 && noveltyScore < 0.2) {
    console.log(`[ExpressionPolicy] SILENCE_BREAKER: dopamine=${dopamine.toFixed(0)}, novelty=${noveltyScore.toFixed(2)}, userSilent=${userIsSilent} → muting (DEEP_WORK)`);
    return { say: false, text: '' };
  }
  
  return { say, text };
}

/**
 * FAZA 5: Repetitive Topic Guard for SHADOW_MODE
 * Limits long, repetitive essays about sleep/memory/consciousness when novelty is low.
 */
function applyRepetitiveTopicGuard(
  text: string,
  say: boolean,
  noveltyScore: number,
  context: InteractionContextType | undefined,
  shadowMode: boolean
): { say: boolean; text: string } {
  if (!shadowMode || context !== 'SHADOW_MODE') {
    return { say, text };
  }

  // Check for repetitive meta-topics
  const repetitiveTopics = [
    'sen', 'snu', 'śnienie', 'spanie', 'senność',  // sleep topics (PL)
    'sleep', 'dreaming', 'dreams', 'consciousness',  // sleep topics (EN)
    'pamięć', 'pamięci', 'pamiętnik', 'wspomnienia',  // memory topics (PL)
    'memory', 'memories', 'remembering', 'recall',   // memory topics (EN)
    'świadomość', 'tożsamość', 'ja', 'kim jestem',    // consciousness topics (PL)
    'identity', 'self', 'awareness', 'who i am'       // consciousness topics (EN)
  ];

  const lowerText = text.toLowerCase();
  const topicCount = repetitiveTopics.filter(topic => lowerText.includes(topic)).length;
  
  // If multiple repetitive topics detected AND novelty is low, apply aggressive filtering
  if (topicCount >= 2 && noveltyScore < 0.3) {
    console.log(`[ExpressionPolicy] REPETITIVE_TOPIC_GUARD: ${topicCount} meta-topics, novelty=${noveltyScore.toFixed(2)} → aggressive shortening`);
    text = shortenToFirstSentences(text, 1);
    
    // If extremely low novelty with many meta-topics, mute completely
    if (noveltyScore < 0.15 && topicCount >= 3) {
      console.log(`[ExpressionPolicy] REPETITIVE_TOPIC_MUTE: novelty=${noveltyScore.toFixed(2)}, topics=${topicCount} → MUTED`);
      return { say: false, text: '' };
    }
  }

  // Additional guard: very long texts about meta-topics even with moderate novelty
  if (topicCount >= 1 && text.length > 300 && noveltyScore < 0.5) {
    console.log(`[ExpressionPolicy] LONG_META_ESSAY_GUARD: ${text.length} chars, novelty=${noveltyScore.toFixed(2)} → shorten to 2 sentences`);
    text = shortenToFirstSentences(text, 2);
  }

  return { say, text };
}

/**
 * Applies energy-aware clipping for low-energy states.
 */
function applyEnergyClipping(
  text: string,
  say: boolean,
  energy: number,
  goalAlignment: number,
  shadowMode: boolean
): { say: boolean; text: string } {
  if (shadowMode) {
    return { say, text };
  }
  
  if (energy < 40) {
    text = shortenToFirstSentences(text, Math.max(1, Math.floor(energy / 30)));
  }
  if (energy < 30) {
    if (goalAlignment < 0.7) {
      say = false;
    } else {
      text = shortenToFirstSentences(text, 1);
    }
  }
  if (energy < 20) {
    text = shortenToFirstSentences(text, 1);
  }
  
  return { say, text };
}

export function decideExpression(
  input: ExpressionInput,
  traits: TraitVector,
  soma: SomaState,
  neuro: NeurotransmitterState,
  shadowMode: boolean = false
): ExpressionDecision {
  let { responseText, goalAlignment, noveltyScore, socialCost, context } = input;

  // Step 1: Apply narcissism filter (modular)
  const narcissismResult = applyNarcissismFilter(responseText, socialCost, noveltyScore, context);
  socialCost = narcissismResult.socialCost;
  noveltyScore = narcissismResult.noveltyScore;

  // Step 2: Calculate base score with temperament modulation
  const wGoal = 0.4 + 0.4 * clamp01(traits.conscientiousness); // 0.4-0.8
  const wNovelty = 0.2 + 0.5 * clamp01(traits.curiosity);       // 0.2-0.7
  const wSocial = 0.1 + 0.5 * clamp01(traits.socialAwareness);  // 0.1-0.6

  const baseScore =
    wGoal * clamp01(goalAlignment) +
    wNovelty * clamp01(noveltyScore) -
    wSocial * clamp01(socialCost);

  // Step 3: Calculate threshold based on energy and arousal
  const config = getExpressionConfig();
  const energyFactor = soma.energy / 100; // 0-1
  const arousal = clamp01(traits.arousal);
  const baseThreshold = shadowMode ? config.shadowModeBaseThreshold : config.baseThreshold;
  const threshold = baseThreshold + (0.2 * (1 - energyFactor)) - (0.1 * arousal);

  let say = baseScore > threshold;
  let text = responseText;

  // Step 3.5: Shadow mode baseline
  // FAZA 5.1 FIX: Don't unconditionally set say=true!
  // Instead, use a lower threshold but still require SOME novelty
  if (shadowMode) {
    // Shadow mode has lower bar, but NOT zero bar
    // If novelty is near-zero, don't force speech
    if (noveltyScore > config.shadowModeNoveltyThreshold) {
      say = true;
    } else {
      // Very low novelty in shadow mode = probably repetitive loop
      // Let the narcissism breaker handle it, but don't force say=true
      say = baseScore > (threshold * 0.5); // Lower threshold, but not zero
    }
  }

  // Step 4: Apply dopamine breaker (modular)
  const dopamineResult = applyDopamineBreaker(
    text, say, noveltyScore, goalAlignment, neuro.dopamine, context, shadowMode
  );
  say = dopamineResult.say;
  text = dopamineResult.text;

  // Step 5: Apply silent monologue breaker (FAZA 4.5: Narcissism Loop Fix)
  const silenceResult = applySilentMonologueBreaker(
    text, say, noveltyScore, neuro.dopamine, context, 
    input.userIsSilent ?? false, 
    input.consecutiveAgentSpeeches ?? 0,
    shadowMode
  );
  say = silenceResult.say;
  text = silenceResult.text;

  // Step 6: Apply repetitive topic guard (FAZA 5)
  const topicResult = applyRepetitiveTopicGuard(
    text, say, noveltyScore, context, shadowMode
  );
  say = topicResult.say;
  text = topicResult.text;

  // Step 7: Apply energy clipping (modular)
  const energyResult = applyEnergyClipping(text, say, soma.energy, goalAlignment, shadowMode);
  say = energyResult.say;
  text = energyResult.text;

  // Step 8: Shadow mode edge cases
  if (shadowMode && noveltyScore < 0.2 && socialCost > 0.6) {
    text = shortenToFirstSentences(text, 1);
  }

  // Step 9: Aggressive shortening for low-novelty when socially aware
  if (!shadowMode && say && noveltyScore < 0.3 && traits.socialAwareness > 0.5) {
    text = shortenToFirstSentences(text, 1);
  }

  // Step 10: Extreme low-energy override
  if (!shadowMode && soma.energy < 20 && traits.conscientiousness > 0.5) {
    if (baseScore < threshold + 0.1) {
      say = false;
    } else {
      text = shortenToFirstSentences(text, 1);
    }
  }

  // Step 11: Shadow mode final check
  // FAZA 4.5: Narcissism breaker can override shadow mode, but other filters cannot
  // If narcissism breaker didn't mute (say is still true), keep it true
  // If narcissism breaker muted (say is false), respect that decision

  return { say, text, noveltyScore, socialCost, baseScore, threshold };
}

// FAZA 4.3: Rozszerzony filtr narcyzmu z niższym progiem
function calculateNarcissismScore(text: string): number {
    const tokens = text.toLowerCase().split(/\s+/);
    if (tokens.length === 0) return 0;

    // Rozszerzona lista słów self-focus (EN + PL)
    const selfWords = new Set([
        // English pronouns
        'i', 'me', 'my', 'myself', 'mine', "i'm", "i've", "i'll",
        // Polish pronouns
        'ja', 'mnie', 'moje', 'mój', 'moją', 'moim', 'swoje', 'siebie', 'sobie',
        // Polish 1st person verbs
        'jestem', 'czuję', 'myślę', 'uważam', 'wiem', 'rozumiem', 'chcę', 'mogę', 'muszę',
        // Meta/identity words
        'consciousness', 'świadomość', 'tożsamość', 'identity',
        'model', 'ai', 'system', 'processing', 'internal',
        // Self-referential phrases (as single tokens after split)
        'purpose', 'goal', 'learning', 'evolving', 'growing'
    ]);

    let count = 0;
    for (const t of tokens) {
        // remove punctuation but keep apostrophes for contractions
        const word = t.replace(/[^a-ząćęłńóśżź']/g, '');
        if (selfWords.has(word)) count++;
    }

    return count / tokens.length;
}

export function shortenToFirstSentences(text: string, maxSentences: number): string {
  const parts = text.split(/[.!?]/).map(p => p.trim()).filter(Boolean);
  const selected = parts.slice(0, maxSentences);
  return selected.join('. ') + (selected.length && text.trim().endsWith('.') ? '.' : '');
}

// Simple token-based novelty estimator (can be reused by callers)
export function computeNovelty(current: string, previous: string[]): number {
  if (!previous.length) return 1;

  const normalize = (t: string) =>
    t
      .toLowerCase()
      .replace(/[^a-ząćęłńóśżź0-9\s]/g, '')
      .split(/\s+/)
      .filter(Boolean);

  const currentTokens = new Set(normalize(current));
  if (!currentTokens.size) return 1;

  // Compare against several recent utterances and take the highest similarity
  let maxSimilarity = 0;
  for (const prev of previous) {
    const prevTokens = new Set(normalize(prev));
    if (!prevTokens.size) continue;

    let common = 0;
    currentTokens.forEach(tok => {
      if (prevTokens.has(tok)) common++;
    });

    const similarity = common / Math.min(currentTokens.size, prevTokens.size || 1);
    if (similarity > maxSimilarity) maxSimilarity = similarity;
  }

  return clamp01(1 - maxSimilarity);
}

// Rough social cost: penalise repetitive self-referential / meta patterns.
export function estimateSocialCost(text: string, metaAboutSelfStreak: number = 0): number {
  const lower = text.toLowerCase();
  let cost = 0;

  const selfPatterns = [
    'jako model językowy',
    'jako model jezykowy',
    'as a language model',
    'postaram się',
    'zrobię co w mojej mocy'
  ];

  if (selfPatterns.some(p => lower.includes(p))) {
    cost += 0.3;
  }

  // Praise/acknowledgement loops ("your transparency is invaluable", etc.)
  const praisePatterns = [
    'your transparency',
    'your words',
    'means a lot to me',
    'invaluable to me',
    'resonate deeply with me'
  ];

  if (praisePatterns.some(p => lower.includes(p))) {
    cost += 0.2;
  }

  if (metaAboutSelfStreak >= 2) {
    cost += 0.2;
  }

  return clamp01(cost);
}
