import { clamp } from '@utils/math';
import type { ChunkRef, Tension, WitnessFrame } from '../types/WitnessTypes';
import { PRIORITY_WEIGHTS, type CoreBeliefKey } from './CoreBeliefs';

const MAX_CHUNKS = 5;

export function buildWitnessFrame(input: {
  energyBudget: number;
  contextPressure: number;
  beliefViolation: { belief: CoreBeliefKey; severity: number } | null;
  tensions: Tension[];
  evidenceCount: number;
  chunkCandidates: ChunkRef[];
}): WitnessFrame {
  const activeChunks = [...input.chunkCandidates]
    .sort((a, b) => b.relevance - a.relevance)
    .slice(0, MAX_CHUNKS);

  const dominantTension = [...input.tensions]
    .sort((a, b) => b.severity - a.severity)[0] || null;

  const weightedDrive = input.tensions.reduce<{ belief: CoreBeliefKey; score: number } | null>(
    (best, tension) => {
      const weight = PRIORITY_WEIGHTS[tension.belief] ?? 1;
      const score = tension.severity * weight;
      if (!best || score > best.score) {
        return { belief: tension.belief, score };
      }
      return best;
    },
    null
  );
  const dominantDrive = weightedDrive?.belief || dominantTension?.belief || 'growth';

  const tensionSeverity = dominantTension?.severity || 0;
  const readinessToAct = clamp(
    0.4 * (input.energyBudget / 100) +
      0.35 * tensionSeverity +
      0.25 * (1 - input.contextPressure),
    0,
    1
  );

  return {
    activeChunks,
    dominantTension,
    dominantDrive,
    energyBudget: input.energyBudget,
    contextPressure: input.contextPressure,
    readinessToAct,
    timestamp: Date.now()
  };
}
