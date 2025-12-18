const KEYWORDS = [
  'zrób',
  'zrob',
  'napraw',
  'dodaj',
  'refactor',
  'refaktoryzuj',
  'implementuj',
  'wdroż',
  'wdroz',
  'przerób',
  'przerob',
  'zbuduj'
];

function normalize(text: string): string {
  return String(text || '').trim();
}

function splitSentences(text: string): string[] {
  const t = normalize(text);
  if (!t) return [];
  return t
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(Boolean);
}

function hasKeyword(text: string): boolean {
  const t = normalize(text).toLowerCase();
  return KEYWORDS.some(k => t.includes(k));
}

export function shouldAutoCreateWorkingSetFromUserInput(text: string): boolean {
  const sentences = splitSentences(text);
  if (sentences.length < 2) return false;
  return hasKeyword(text);
}

export function shouldClearWorkingSetFromUserInput(text: string): boolean {
  const t = normalize(text).toLowerCase();
  return (
    t.includes('wyczyść plan') ||
    t.includes('wyczysc plan') ||
    t.includes('reset plan') ||
    t.includes('clear plan') ||
    t.includes('zapomnij plan')
  );
}

export function deriveWorkingSetFromUserInput(text: string): { title?: string; steps: string[] } {
  const sentences = splitSentences(text);
  const candidates = sentences.filter(s => hasKeyword(s));
  const steps = (candidates.length > 0 ? candidates : sentences).slice(0, 6);
  const title = steps[0] ? steps[0].slice(0, 80) : undefined;
  return { title, steps };
}
