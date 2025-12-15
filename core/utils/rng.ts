/**
 * Deterministyczny RNG dla reprodukowalnych testów
 * 
 * Użycie:
 *   const rng = createRng('my-seed');  // deterministyczny
 *   const rng = createRng();           // Math.random fallback
 */

export function createRng(seed?: string | null): () => number {
  if (!seed) {
    return Math.random;
  }
  
  let state = hashString(seed);
  
  return () => {
    // Linear congruential generator
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    return state / 0x7fffffff;
  };
}

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) || 1;
}

export type RngFunction = () => number;
