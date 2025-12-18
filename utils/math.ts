export function clampRange(v: number, min: number, max: number): number {
  if (Number.isNaN(v)) return min;
  return Math.min(max, Math.max(min, v));
}

export function clamp01(v: number): number {
  return clampRange(v, 0, 1);
}

export function clamp100(v: number): number {
  return clampRange(v, 0, 100);
}
