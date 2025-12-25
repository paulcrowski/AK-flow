export type IntentType = 'NOW' | 'HISTORY' | 'RECALL' | 'OPINION' | 'WORK';

const RECALL = ['przypomnij sobie', 'co wiesz o', 'wszystko o', 'pelna historia', 'calosc'];
const HISTORY = ['wczoraj', 'ostatnio', 'przypomnij', 'pamietasz', 'rozmawialismy', 'wrocmy'];
const OPINION = ['co sadzisz', 'twoje zdanie', 'opinia', 'jak oceniasz', 'rekomendujesz'];
const WORK = ['wdroz', 'napraw', 'patch', 'test plan', 'sql', 'schema', 'implementuj', 'kod'];

function normalizeInput(input: string): string {
  return String(input || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export function detectIntent(input: string): IntentType {
  const t = normalizeInput(input);
  if (RECALL.some((x) => t.includes(x))) return 'RECALL';
  if (HISTORY.some((x) => t.includes(x))) return 'HISTORY';
  if (OPINION.some((x) => t.includes(x))) return 'OPINION';
  if (WORK.some((x) => t.includes(x))) return 'WORK';
  return 'NOW';
}

export function getRetrievalLimit(intent: IntentType): number {
  switch (intent) {
    case 'RECALL':
      return 40;
    case 'HISTORY':
      return 30;
    case 'WORK':
      return 25;
    case 'OPINION':
      return 20;
    default:
      return 12;
  }
}
