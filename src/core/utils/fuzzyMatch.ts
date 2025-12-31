export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const d: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) d[i][0] = i;
  for (let j = 0; j <= n; j++) d[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
    }
  }
  return d[m][n];
}

export function normalizeForFuzzy(text: string): string {
  return String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

const VERB_CATEGORIES = {
  CREATE: ['utworz', 'stworz', 'zapisz', 'tworz', 'zrob', 'create', 'make', 'write', 'save'],
  APPEND: ['dodaj', 'dopisz', 'dolacz', 'append', 'add'],
  REPLACE: ['zamien', 'zastap', 'replace', 'podmien'],
  READ: ['pokaz', 'otworz', 'wyswietl', 'przeczytaj', 'show', 'open', 'display', 'read']
} as const;

export type IntentCategory = keyof typeof VERB_CATEGORIES | null;

export function classifyIntentFuzzy(input: string, maxDistance: number = 1): IntentCategory {
  const normalized = normalizeForFuzzy(input);
  const words = normalized.split(/\s+/).slice(0, 5);

  for (const word of words) {
    if (word.length < 3) continue;

    for (const [category, verbs] of Object.entries(VERB_CATEGORIES)) {
      for (const verb of verbs) {
        if (levenshtein(word, verb) <= maxDistance) {
          return category as IntentCategory;
        }
      }
    }
  }

  return null;
}

export function detectFuzzyMismatch(
  input: string,
  regexResult: { handled: boolean; action?: string } | null
): { fuzzyCategory: IntentCategory; regexMissed: boolean } {
  const fuzzyCategory = classifyIntentFuzzy(input);
  const regexMissed = fuzzyCategory !== null && (!regexResult || !regexResult.handled);
  return { fuzzyCategory, regexMissed };
}
