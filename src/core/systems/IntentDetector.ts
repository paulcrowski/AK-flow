export type IntentType = 'NOW' | 'HISTORY' | 'RECALL' | 'OPINION' | 'WORK';
export type TimeGranularity = 'daily' | 'weekly' | 'monthly' | 'yearly';

export type IntentResult = {
  intent: IntentType;
  rangeStart?: number;
  rangeEnd?: number;
  granularityHint?: TimeGranularity;
};

const RECALL = ['przypomnij sobie', 'co wiesz o', 'wszystko o', 'pelna historia', 'calosc'];
const HISTORY = ['wczoraj', 'ostatnio', 'przypomnij', 'pamietasz', 'rozmawialismy', 'wrocmy'];
const OPINION = ['co sadzisz', 'twoje zdanie', 'opinia', 'jak oceniasz', 'rekomendujesz'];
const WORK = ['wdroz', 'napraw', 'patch', 'test plan', 'sql', 'schema', 'implementuj', 'kod'];

type HistoryRange = {
  rangeStart: number;
  rangeEnd: number;
  granularityHint: TimeGranularity;
};

function normalizeInput(input: string): string {
  return String(input || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day + 6) % 7;
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfWeek(date: Date): Date {
  const start = startOfWeek(date);
  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  end.setMilliseconds(-1);
  return end;
}

function startOfMonth(date: Date): Date {
  const d = new Date(date);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfMonth(date: Date): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + 1, 0);
  d.setHours(23, 59, 59, 999);
  return d;
}

function startOfYear(date: Date): Date {
  const d = new Date(date);
  d.setMonth(0, 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfYear(date: Date): Date {
  const d = new Date(date);
  d.setMonth(11, 31);
  d.setHours(23, 59, 59, 999);
  return d;
}

function addWeeks(date: Date, delta: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + delta * 7);
  return d;
}

function addMonths(date: Date, delta: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + delta);
  return d;
}

function addYears(date: Date, delta: number): Date {
  const d = new Date(date);
  d.setFullYear(d.getFullYear() + delta);
  return d;
}

function detectHistoryRange(normalized: string, now: Date = new Date()): HistoryRange | null {
  if (normalized.includes('w tym tygodniu')) {
    return { rangeStart: startOfWeek(now).getTime(), rangeEnd: now.getTime(), granularityHint: 'weekly' };
  }
  if (/(w\s+zeszlym\s+tygodniu|zeszly\s+tydzien)/.test(normalized)) {
    const ref = addWeeks(now, -1);
    return { rangeStart: startOfWeek(ref).getTime(), rangeEnd: endOfWeek(ref).getTime(), granularityHint: 'weekly' };
  }
  if (/(tydzien|tygodniu)\s+temu/.test(normalized)) {
    return { rangeStart: addWeeks(now, -1).getTime(), rangeEnd: now.getTime(), granularityHint: 'weekly' };
  }

  if (normalized.includes('w tym miesiacu')) {
    return { rangeStart: startOfMonth(now).getTime(), rangeEnd: now.getTime(), granularityHint: 'monthly' };
  }
  if (/(w\s+zeszlym\s+miesiacu|zeszly\s+miesiac)/.test(normalized)) {
    const ref = addMonths(now, -1);
    return { rangeStart: startOfMonth(ref).getTime(), rangeEnd: endOfMonth(ref).getTime(), granularityHint: 'monthly' };
  }
  if (/(miesiac|miesiacu)\s+temu/.test(normalized)) {
    return { rangeStart: addMonths(now, -1).getTime(), rangeEnd: now.getTime(), granularityHint: 'monthly' };
  }

  if (normalized.includes('w tym roku')) {
    return { rangeStart: startOfYear(now).getTime(), rangeEnd: now.getTime(), granularityHint: 'yearly' };
  }
  if (normalized.includes('w zeszlym roku')) {
    const ref = addYears(now, -1);
    return { rangeStart: startOfYear(ref).getTime(), rangeEnd: endOfYear(ref).getTime(), granularityHint: 'yearly' };
  }
  if (/(rok|roku)\s+temu/.test(normalized)) {
    return { rangeStart: addYears(now, -1).getTime(), rangeEnd: now.getTime(), granularityHint: 'yearly' };
  }

  return null;
}

export function detectIntent(input: string): IntentResult {
  const t = normalizeInput(input);
  const historyRange = detectHistoryRange(t);
  if (historyRange) return { intent: 'HISTORY', ...historyRange };
  if (RECALL.some((x) => t.includes(x))) return { intent: 'RECALL' };
  if (HISTORY.some((x) => t.includes(x))) return { intent: 'HISTORY' };
  if (OPINION.some((x) => t.includes(x))) return { intent: 'OPINION' };
  if (WORK.some((x) => t.includes(x))) return { intent: 'WORK' };
  return { intent: 'NOW' };
}

export function getIntentType(intent: IntentType | IntentResult): IntentType {
  return typeof intent === 'string' ? intent : intent.intent;
}

export function getRetrievalLimit(intent: IntentType | IntentResult): number {
  switch (getIntentType(intent)) {
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

export function formatHistoryRange(rangeStart?: number, rangeEnd?: number): string | null {
  if (!Number.isFinite(rangeStart) || !Number.isFinite(rangeEnd)) return null;
  const start = new Date(rangeStart as number).toISOString().slice(0, 10);
  const end = new Date(rangeEnd as number).toISOString().slice(0, 10);
  return `${start} - ${end}`;
}
