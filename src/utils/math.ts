export function clampRange(v: number, min: number, max: number): number {
  if (Number.isNaN(v)) return min;
  return Math.min(max, Math.max(min, v));
}

export function clamp(v: number, min: number, max: number): number {
  return clampRange(v, min, max);
}

export function clampInt(v: number, min: number, max: number): number {
  if (!Number.isFinite(v)) return min;
  return clampRange(Math.trunc(v), min, max);
}

export function normalize01(v: number, min: number, max: number): number {
  if (!Number.isFinite(v)) return 0;
  if (max === min) return 0;
  const raw = (v - min) / (max - min);
  return clampRange(raw, 0, 1);
}

export function sigmoid(x: number, k: number = 1): number {
  if (!Number.isFinite(x)) return 0.5;
  const z = -k * x;
  if (z > 60) return 0;
  if (z < -60) return 1;
  return 1 / (1 + Math.exp(z));
}

export function clamp01(v: number): number {
  return clampRange(v, 0, 1);
}

export function clamp100(v: number): number {
  return clampRange(v, 0, 100);
}
