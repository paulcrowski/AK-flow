export type ConversationSnapshotTurn = {
  role: string;
  text: string;
  type?: 'thought' | 'speech' | 'visual' | 'intel' | 'action' | 'tool_result';
  knowledgeSource?: 'memory' | 'tool' | 'llm' | 'mixed' | 'system';
  evidenceSource?: 'memory' | 'tool' | 'system';
  evidenceDetail?: string;
  generator?: 'llm' | 'system';
};

function sanitizeText(input: string, maxLen: number): string {
  return input
    .slice(0, maxLen)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim();
}

const ALLOWED_TYPES = new Set([
  'thought',
  'speech',
  'visual',
  'intel',
  'action',
  'tool_result'
]);

export function parseConversationSnapshot(raw: string | null | undefined, opts?: {
  maxTurns?: number;
  maxTextLen?: number;
}): ConversationSnapshotTurn[] {
  const maxTurns = opts?.maxTurns ?? 50;
  const maxTextLen = opts?.maxTextLen ?? 2000;

  if (!raw) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }

  if (!Array.isArray(parsed)) return [];

  const out: ConversationSnapshotTurn[] = [];
  for (const item of parsed) {
    if (!item || typeof item !== 'object') continue;
    const role = sanitizeText((item as any).role ?? '', 32);
    const text = sanitizeText((item as any).text ?? '', maxTextLen);
    if (!role || !text) continue;

    const rawType = (item as any).type;
    const type = typeof rawType === 'string' && ALLOWED_TYPES.has(rawType) ? (rawType as any) : 'speech';

    const rawKnowledgeSource = (item as any).knowledgeSource;
    const knowledgeSource =
      rawKnowledgeSource === 'memory' ||
      rawKnowledgeSource === 'tool' ||
      rawKnowledgeSource === 'llm' ||
      rawKnowledgeSource === 'mixed' ||
      rawKnowledgeSource === 'system'
        ? (rawKnowledgeSource as ConversationSnapshotTurn['knowledgeSource'])
        : undefined;

    const rawEvidenceSource = (item as any).evidenceSource;
    const evidenceSource =
      rawEvidenceSource === 'memory' ||
      rawEvidenceSource === 'tool' ||
      rawEvidenceSource === 'system'
        ? (rawEvidenceSource as ConversationSnapshotTurn['evidenceSource'])
        : undefined;

    const rawEvidenceDetail = (item as any).evidenceDetail;
    const evidenceDetail = typeof rawEvidenceDetail === 'string' && rawEvidenceDetail.trim()
      ? sanitizeText(rawEvidenceDetail, 64)
      : undefined;

    const rawGenerator = (item as any).generator;
    const generator =
      rawGenerator === 'llm' || rawGenerator === 'system'
        ? (rawGenerator as ConversationSnapshotTurn['generator'])
        : undefined;

    out.push({
      role,
      text,
      type,
      ...(knowledgeSource ? { knowledgeSource } : {}),
      ...(evidenceSource ? { evidenceSource } : {}),
      ...(evidenceDetail ? { evidenceDetail } : {}),
      ...(generator ? { generator } : {})
    });
    if (out.length >= maxTurns) break;
  }

  return out;
}

export function serializeConversationSnapshot(
  turns: ConversationSnapshotTurn[],
  opts?: { maxTurns?: number; maxTextLen?: number }
): string {
  const maxTurns = opts?.maxTurns ?? 50;
  const maxTextLen = opts?.maxTextLen ?? 2000;

  const cleaned = (turns || [])
    .slice(-maxTurns)
    .map((t) => ({
      role: sanitizeText(String(t.role ?? ''), 32),
      text: sanitizeText(String(t.text ?? ''), maxTextLen),
      type: typeof t.type === 'string' && ALLOWED_TYPES.has(t.type) ? t.type : 'speech',
      ...(t.knowledgeSource ? { knowledgeSource: t.knowledgeSource } : {}),
      ...(t.evidenceSource ? { evidenceSource: t.evidenceSource } : {}),
      ...(t.evidenceDetail ? { evidenceDetail: sanitizeText(String(t.evidenceDetail), 64) } : {}),
      ...(t.generator ? { generator: t.generator } : {})
    }))
    .filter((t) => t.role && t.text);

  return JSON.stringify(cleaned);
}

export function getConversationSnapshotStorageKey(agentId: string): string {
  return `ak-flow:conversation:${agentId}`;
}

export function loadConversationSnapshot(agentId: string): ConversationSnapshotTurn[] {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(getConversationSnapshotStorageKey(agentId));
    return parseConversationSnapshot(raw);
  } catch {
    return [];
  }
}

export function saveConversationSnapshot(agentId: string, turns: ConversationSnapshotTurn[]): void {
  try {
    if (typeof localStorage === 'undefined') return;
    const key = getConversationSnapshotStorageKey(agentId);
    localStorage.setItem(key, serializeConversationSnapshot(turns));
  } catch {
    // ignore
  }
}
