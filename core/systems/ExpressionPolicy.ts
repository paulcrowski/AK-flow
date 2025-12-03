import { TraitVector, NeurotransmitterState, SomaState } from '../../types';

export interface ExpressionInput {
  internalThought?: string;
  responseText: string;
  goalAlignment: number; // 0-1
  noveltyScore: number;  // 0-1
  socialCost: number;    // 0-1 (higher = more cringe / repetition / self-focus)
}

export interface ExpressionDecision {
  say: boolean;
  text: string;
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
  neuro: NeurotransmitterState
): ExpressionDecision {
  const { responseText, goalAlignment, noveltyScore, socialCost } = input;

  // Base weights modulated by temperament
  const wGoal = 0.4 + 0.4 * clamp01(traits.conscientiousness); // 0.4-0.8
  const wNovelty = 0.2 + 0.5 * clamp01(traits.curiosity);       // 0.2-0.7
  const wSocial = 0.1 + 0.5 * clamp01(traits.socialAwareness);  // 0.1-0.6

  const baseScore =
    wGoal * clamp01(goalAlignment) +
    wNovelty * clamp01(noveltyScore) -
    wSocial * clamp01(socialCost);

  // Energy and arousal shift speaking threshold
  const energyFactor = soma.energy / 100; // 0-1
  const arousal = clamp01(traits.arousal);

  // Higher arousal lowers the threshold a bit, low energy raises it
  const baseThreshold = 0.3; // neutral
  const threshold = baseThreshold + (0.2 * (1 - energyFactor)) - (0.1 * arousal);

  let say = baseScore > threshold;
  let text = responseText;

  // Aggressive shortening for low-novelty content when socially aware
  if (say && noveltyScore < 0.3 && traits.socialAwareness > 0.5) {
    text = shortenToFirstSentences(responseText, 1);
  }

  // In extreme low-energy states, prefer silence or very short speech
  if (soma.energy < 20 && traits.conscientiousness > 0.5) {
    if (baseScore < threshold + 0.1) {
      say = false;
    } else {
      text = shortenToFirstSentences(responseText, 1);
    }
  }

  return { say, text };
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
