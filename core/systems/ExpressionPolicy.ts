import { TraitVector, NeurotransmitterState, SomaState } from '../../types';

export interface ExpressionInput {
  internalThought?: string;
  responseText: string;
  goalAlignment: number; // 0-1
  noveltyScore: number;  // 0-1
  socialCost: number;    // 0-1 (higher = more cringe / repetition / self-focus)
  context?: 'GOAL_EXECUTED' | 'USER_REPLY'; // FAZA 4.2
  userIsSilent?: boolean; // FAZA 4.5: true if user hasn't spoken recently
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

export function decideExpression(
  input: ExpressionInput,
  traits: TraitVector,
  soma: SomaState,
  neuro: NeurotransmitterState,
  shadowMode: boolean = false
): ExpressionDecision {
  let { responseText, goalAlignment, noveltyScore, socialCost, context } = input;

  // FAZA 4.3: Filtr Narcystyczny (obniżony próg, miękka modulacja)
  if (context === 'GOAL_EXECUTED') {
    const narcissism = calculateNarcissismScore(responseText);
    
    // Próg obniżony z 25% do 15% - agent ma poczuć, że self-talk jest "nudny"
    if (narcissism > 0.15) {
         // Skalowana kara: im więcej narcyzmu, tym większa kara
         const penalty = Math.min(0.5, (narcissism - 0.15) * 2); // 0-0.5
         socialCost += penalty;
         noveltyScore -= penalty * 0.5; // Self-talk rzadko wnosi nowość
         
         console.log(`[ExpressionPolicy] Narcissism detected: ${(narcissism * 100).toFixed(1)}% → socialCost +${penalty.toFixed(2)}`);
    }
  }

  // Base weights modulated by temperament
  const wGoal = 0.4 + 0.4 * clamp01(traits.conscientiousness); // 0.4-0.8
  const wNovelty = 0.2 + 0.5 * clamp01(traits.curiosity);       // 0.2-0.7
  const wSocial = 0.1 + 0.5 * clamp01(traits.socialAwareness);  // 0.1-0.6

  let baseScore =
    wGoal * clamp01(goalAlignment) +
    wNovelty * clamp01(noveltyScore) -
    wSocial * clamp01(socialCost);

  // Energy and arousal shift speaking threshold
  const energyFactor = soma.energy / 100; // 0-1
  const arousal = clamp01(traits.arousal);

  // Higher arousal lowers the threshold a bit, low energy raises it
  const baseThreshold = shadowMode ? 0.9 : 0.3; // SHADOW: almost everything passes
  const threshold = baseThreshold + (0.2 * (1 - energyFactor)) - (0.1 * arousal);

  let say = baseScore > threshold;
  let text = responseText;

  // FAZA 4.3: Reguły Autonarracji + Dopamine Breaker
  if (context === 'GOAL_EXECUTED' && !shadowMode) {
       // Krok 5: Reguła Autonarracji (max 1-2 zdania defaultowo)
       text = shortenToFirstSentences(responseText, 2);

       // Krok 2: Miękka kara za niską novelty
       if (noveltyScore < 0.8) {
            text = shortenToFirstSentences(text, 1); // Jeszcze krócej
       }
       if (noveltyScore < 0.6) {
            // Duża szansa na mute, chyba że cel bardzo ważny
            if (goalAlignment < 0.8 && Math.random() > 0.3) say = false;
       }
       if (noveltyScore < 0.4) {
            say = false; // Hard mute for low novelty autonomy
       }

       // FAZA 4.3: Dopamine Breaker
       // Przy dopaminie 100 + niskiej novelty = agent jest "naćpany" i się zapętla
       // Hamujemy, ale z szansą na przebicie jeśli goalAlignment jest wysoki
       if (neuro.dopamine >= 95 && noveltyScore < 0.5) {
            const breakChance = 0.8 - (goalAlignment * 0.5); // 0.3-0.8 szans na mute
            if (Math.random() < breakChance) {
                say = false;
                console.log(`[ExpressionPolicy] DOPAMINE BREAKER: dopamine=${neuro.dopamine.toFixed(0)}, novelty=${noveltyScore.toFixed(2)} → muting`);
            }
       }
  }

  // FAZA 4.5: Dopamine Breaker dla ciszy (USER_REPLY + userIsSilent)
  // Rozszerzamy hamulec na przypadek: agent odpowiada na ciszę, nie na nowy input
  const isAutonomousSpeech = context === 'GOAL_EXECUTED' || (context === 'USER_REPLY' && input.userIsSilent);
  
  if (isAutonomousSpeech && !shadowMode) {
       if (neuro.dopamine >= 95 && noveltyScore < 0.5) {
            // Najpierw limit długości (1-2 zdania)
            text = shortenToFirstSentences(text, 2);
            
            // Jeśli novelty bardzo niska → jeszcze krócej lub mute
            if (noveltyScore < 0.3) {
                text = shortenToFirstSentences(text, 1);
            }
            if (noveltyScore < 0.2) {
                say = false;
                console.log(`[ExpressionPolicy] SILENCE_BREAKER: dopamine=${neuro.dopamine.toFixed(0)}, novelty=${noveltyScore.toFixed(2)}, userSilent=${input.userIsSilent} → muting (DEEP_WORK)`);
            }
       }
  }

  // Energy-aware clipping (SHADOW MODE: only extreme fatigue triggers)
  if (!shadowMode && soma.energy < 40) {
    text = shortenToFirstSentences(text, Math.max(1, Math.floor(soma.energy / 30)));
  }
  if (!shadowMode && soma.energy < 30) {
    // Only high goalAlignment passes, rest goes to internal thought
    if (goalAlignment < 0.7) {
      say = false;
    } else {
      text = shortenToFirstSentences(text, 1);
    }
  }

  // In shadow mode, only shorten extreme repetitions, never mute
  if (shadowMode && noveltyScore < 0.2 && socialCost > 0.6) {
    text = shortenToFirstSentences(text, 1);
  }

  // Aggressive shortening for low-novelty content when socially aware (production mode only)
  if (!shadowMode && say && noveltyScore < 0.3 && traits.socialAwareness > 0.5) {
    text = shortenToFirstSentences(text, 1);
  }

  // In extreme low-energy states, prefer silence or very short speech (production mode only)
  if (!shadowMode && soma.energy < 20 && traits.conscientiousness > 0.5) {
    if (baseScore < threshold + 0.1) {
      say = false;
    } else {
      text = shortenToFirstSentences(text, 1);
    }
  }

  // Shadow mode always speaks (logs decision but never blocks)
  if (shadowMode) {
    say = true;
  }

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
