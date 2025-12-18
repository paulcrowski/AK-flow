export type SplitItem = {
  id?: string;
  content?: string;
  priority?: string;
  type?: string;
  isCompleted?: boolean;
  completed?: boolean;
  subtasks?: { id?: string; content?: string; completed?: boolean; isCompleted?: boolean }[];
};

export type SplitResult = {
  now: SplitItem[];
  next: SplitItem[];
  later: SplitItem[];
};

function asArray<T = any>(v: any): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

export function safeParseJson(raw: string): any | null {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function splitTodo3(state: any): SplitResult {
  const tasks = asArray<SplitItem>(state?.tasks);
  const hasTypeBuckets = tasks.some((t) => String(t?.type || '').trim() !== '');

  const byType = (type: string) => tasks.filter((t) => String(t?.type || '').toUpperCase() === type);

  if (hasTypeBuckets) {
    const now = byType('TODAY');
    const next = byType('TOMORROW');
    const later = byType('BACKLOG');

    const remainder = tasks.filter(
      (t) => !now.includes(t) && !next.includes(t) && !later.includes(t)
    );

    return {
      now,
      next: [...next, ...remainder.filter((t) => String(t?.priority || '').toUpperCase() === 'MEDIUM')],
      later: [...later, ...remainder.filter((t) => String(t?.priority || '').toUpperCase() !== 'MEDIUM')]
    };
  }

  const score = (p: string) => {
    const up = String(p || '').toUpperCase();
    if (up === 'CRITICAL') return 3;
    if (up === 'HIGH') return 2;
    if (up === 'MEDIUM') return 1;
    if (up === 'LOW') return 0;
    return -1;
  };

  const now: SplitItem[] = [];
  const next: SplitItem[] = [];
  const later: SplitItem[] = [];

  for (const t of tasks) {
    const s = score(String(t?.priority || ''));
    if (s >= 2) now.push(t);
    else if (s === 1) next.push(t);
    else later.push(t);
  }

  if (now.length === 0 && next.length === 0 && later.length === 0) {
    return { now: [], next: [], later: [] };
  }

  return { now, next, later };
}
