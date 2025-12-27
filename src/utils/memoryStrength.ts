import type { LimbicState } from '../types';

export function computeNeuralStrength(limbic: LimbicState, floor: number = 5): number {
  const intensity = Math.max(
    limbic?.fear ?? 0,
    limbic?.curiosity ?? 0,
    limbic?.frustration ?? 0,
    limbic?.satisfaction ?? 0
  );
  const scaled = Math.round(intensity * 100);
  return Math.min(100, Math.max(floor, scaled));
}
