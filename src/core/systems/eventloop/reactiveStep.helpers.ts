import { eventBus } from '../../EventBus';
import { AgentType, PacketType } from '../../../types';
import { generateUUID } from '../../../utils/uuid';
import { detectFuzzyMismatch } from '../../utils/fuzzyMatch';

type ActionFirstResult = {
  // No intent uses null at the detector level (not { handled: false }).
  handled: boolean;
  action?: 'CREATE' | 'READ' | 'APPEND' | 'REPLACE';
  target?: string;
  payload?: string;
  assumption?: string;
};

type IntentInput = {
  raw: string;
  trimmed: string;
  normalized: string;
};

// FIX-2: Multilingual verb patterns - Polish with diacritics + English
const CREATE_VERBS_PL = '(?:stworz|utworz|zapisz|tw[o\\u00f3]rz|utw[o\\u00f3]rz|stw[o\\u00f3]rz)';
const CREATE_VERBS_EN = '(?:create|make|write|save)';
const CREATE_VERBS = `(?:${CREATE_VERBS_PL}|${CREATE_VERBS_EN})`;

const APPEND_VERBS_PL = '(?:dopisz|dodaj|do\\u0142\\u0105cz|dolacz)';
const APPEND_VERBS_EN = '(?:append|add)';
const APPEND_VERBS = `(?:${APPEND_VERBS_PL}|${APPEND_VERBS_EN})`;

const EDIT_VERBS_PL = '(?:edytuj|eydtuj|modyfikuj|zmien|zmie\\u0144)';
const EDIT_VERBS_EN = '(?:edit|modify|change)';
const EDIT_VERBS = `(?:${EDIT_VERBS_PL}|${EDIT_VERBS_EN})`;

const READ_VERBS_PL = '(?:pokaz|poka\\u017c|otw[o\\u00f3]rz|wyswietl|wy\\u015bwietl|przeczytaj)';
const READ_VERBS_EN = '(?:show|open|display|read)';
const READ_VERBS = `(?:${READ_VERBS_PL}|${READ_VERBS_EN})`;

const FILE_WORD = '(?:plik|file)';
const CONTENT_KEYWORD =
  '(?:trescia|tre(?:s|\\u015b)ci(?:a|\\u0105)|tekstem|zawartoscia|zawarto(?:s|\\u015b)ci(?:a|\\u0105)|content|text)';
const CONTENT_COLON_KEYWORD = '(?:tresc|tre(?:s|\\u015b)(?:c|\\u0107)|content)';

const CREATE_NO_NAME_COLON_REGEX = new RegExp(
  `${CREATE_VERBS}\\s+(?:${FILE_WORD}\\s+)?${CONTENT_COLON_KEYWORD}\\s*:\\s*([\\s\\S]+)`,
  'i'
);
const CREATE_WITH_NAME_COLON_REGEX = new RegExp(
  `${CREATE_VERBS}\\s+(?:${FILE_WORD}\\s+)?(?:o\\s+nazwie\\s+|named\\s+)?(.+?)\\s+${CONTENT_COLON_KEYWORD}\\s*:\\s*([\\s\\S]+)`,
  'i'
);
const CREATE_NO_NAME_REGEX = new RegExp(
  `${CREATE_VERBS}\\s+(?:${FILE_WORD}\\s+)?z\\s+${CONTENT_KEYWORD}\\s+([\\s\\S]+)`,
  'i'
);
const CREATE_WITH_NAME_REGEX = new RegExp(
  `${CREATE_VERBS}\\s+(?:${FILE_WORD}\\s+)?(?:o\\s+nazwie\\s+|named\\s+)?(.+?)\\s+z\\s+${CONTENT_KEYWORD}\\s+([\\s\\S]+)`,
  'i'
);
// FIX-2: Support "tworz plik X a w nim Y" / "create file X with Y"
const CREATE_WITH_CONTENT_REGEX = new RegExp(
  `${CREATE_VERBS}\\s+(?:${FILE_WORD}\\s+)?(?:o\\s+nazwie\\s+|named\\s+)?(.+?)\\s+(?:a\\s+w\\s+nim|with|containing)\\s+([\\s\\S]+)`,
  'i'
);
const CREATE_SIMPLE_REGEX = new RegExp(`${CREATE_VERBS}\\s+(?:${FILE_WORD}\\s+)?(.+)`, 'i');

const EDIT_APPEND_REGEX = new RegExp(
  `${EDIT_VERBS}\\s+(?:${FILE_WORD}\\s+)?([^\\s:]+)\\s+${APPEND_VERBS}\\s+(?:tresc|tekst|content|text)?\\s*:?\\s*([\\s\\S]+)`,
  'i'
);
const APPEND_REGEX = new RegExp(`${APPEND_VERBS}\\s+(?:do|to)\\s+([^\\s]+)(?:\\s+(.*))?`, 'i');
const APPEND_INLINE_REGEX = new RegExp(
  `${APPEND_VERBS}\\s+(?:tresc|tekst|content|text)?\\s*(?:do|to)\\s+([^\\s:]+)\\s+([\\s\\S]+)`,
  'i'
);
const EDIT_REPLACE_REGEX = new RegExp(
  `${EDIT_VERBS}\\s+(?:${FILE_WORD}\\s+)?([^\\s:]+)\\s*:\\s*([\\s\\S]+)`,
  'i'
);
const REPLACE_REGEX = /(?:zamien|zamie\u0144|zastap|zast\u0105p|replace)\s+(?:w|w\s+pliku|in|in\s+file)\s+(.+)/i;
const READ_REGEX = new RegExp(`${READ_VERBS}\\s+([^\\s,]+)`, 'i');

function normalizeIntentInput(input: string): IntentInput {
  const raw = String(input || '');
  const trimmed = raw.trim();
  const normalized = trimmed
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  return { raw, trimmed, normalized };
}

function shouldIgnoreActionIntent(input: IntentInput): boolean {
  return (
    input.raw.includes('?') ||
    input.normalized.startsWith('czy ') ||
    input.normalized.includes('umiesz') ||
    input.normalized.includes('mozesz') ||
    input.normalized.includes('potrafisz')
  );
}

function splitTargetAndPayload(input: string): { target: string; payload: string } {
  const idx = input.indexOf(':');
  if (idx < 0) return { target: input.trim(), payload: '' };
  return {
    target: input.slice(0, idx).trim(),
    payload: input.slice(idx + 1).trim()
  };
}

export function isRecognizableTarget(target: string): boolean {
  const raw = String(target || '').trim();
  if (!raw) return false;
  return raw.startsWith('art-') || /^[a-z0-9_-]{1,60}\.(md|txt|json|ts|js|tsx|jsx|css|html)$/i.test(raw);
}

export function isImplicitReference(target: string): boolean {
  const normalized = String(target || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
  return /\btego pliku\b/.test(normalized) ||
    /\bdo tego\b/.test(normalized) ||
    /\bten plik\b/.test(normalized) ||
    /\bostatni\b/.test(normalized) ||
    normalized === 'to';
}

function slugifyTarget(input: string): string {
  const raw = String(input || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/^o\s+/, '')
    .replace(/[^a-z0-9]+/g, '-');
  const collapsed = raw.replace(/-+/g, '-').replace(/^-|-$/g, '');
  return collapsed.slice(0, 48);
}

function deriveCreateTarget(rawTarget: string, opts?: { preferPhrase?: boolean }): string {
  const t = String(rawTarget || '').trim();
  if (!t) return 'artifact.md';
  const preferPhrase = Boolean(opts?.preferPhrase);
  const first = t.split(/\s+/)[0];
  const looksLikeFilename = !preferPhrase && (first.includes('.') || first.length >= 3);
  if (looksLikeFilename && !first.includes('/') && !first.includes('\\\\')) {
    if (first.toLowerCase().endsWith('.md')) return first;
    if (first.includes('.')) return first;
    return `${first}.md`;
  }
  const slug = slugifyTarget(t);
  return `${slug || 'artifact'}.md`;
}

function sanitizeFilename(raw: string): string {
  let name = String(raw || '')
    .replace(/["':]/g, '')
    .replace(/\s+/g, '-')
    .trim();

  if (!name || name === '.md' || name === '-.md') {
    name = `note-${Date.now().toString(36)}.md`;
  }

  if (!/\.[a-z]{2,4}$/i.test(name)) {
    name = `${name}.md`;
  }

  return name;
}

function extractFilenameFromText(raw: string): string {
  const match = String(raw || '').match(/[a-z0-9_-]{1,60}\.(md|txt|json|ts|js|tsx|jsx|css|html)/i);
  return match ? sanitizeFilename(match[0]) : '';
}

function detectCreateIntent(ctx: IntentInput): ActionFirstResult | null {
  const candidates = [
    { match: ctx.raw.match(CREATE_NO_NAME_COLON_REGEX), payloadIndex: 1, preferPhrase: true },
    { match: ctx.raw.match(CREATE_WITH_NAME_COLON_REGEX), nameIndex: 1, payloadIndex: 2 },
    { match: ctx.raw.match(CREATE_NO_NAME_REGEX), payloadIndex: 1, preferPhrase: true },
    { match: ctx.raw.match(CREATE_WITH_NAME_REGEX), nameIndex: 1, payloadIndex: 2 },
    // FIX-2: "tworz plik X a w nim Y" / "create file X with Y"
    { match: ctx.raw.match(CREATE_WITH_CONTENT_REGEX), nameIndex: 1, payloadIndex: 2 }
  ];

  for (const candidate of candidates) {
    if (!candidate.match) continue;
    const payload = String(candidate.match[candidate.payloadIndex] || '').trim();
    if (!payload) continue;
    const name = candidate.nameIndex ? String(candidate.match[candidate.nameIndex] || '').trim() : '';
    const preferPhrase = candidate.preferPhrase ?? !name;
    const sanitizedName = name ? sanitizeFilename(name) : '';
    const target = sanitizedName || deriveCreateTarget(name || payload, { preferPhrase });
    return { handled: true, action: 'CREATE', target, payload };
  }

  const createMatch = ctx.normalized.match(CREATE_SIMPLE_REGEX);
  if (createMatch) {
    const rawTarget = String(createMatch[1] || '').trim();
    const explicitTarget = extractFilenameFromText(rawTarget);
    return { handled: true, action: 'CREATE', target: explicitTarget || deriveCreateTarget(rawTarget) };
  }
  return null;
}

function detectAppendIntent(ctx: IntentInput): ActionFirstResult | null {
  const editAppendMatch = ctx.raw.match(EDIT_APPEND_REGEX);
  if (editAppendMatch) {
    const target = String(editAppendMatch[1] || '').trim();
    const payload = String(editAppendMatch[2] || '').trim();
    if (target && payload) return { handled: true, action: 'APPEND', target, payload };
  }

  const appendMatch = ctx.raw.match(APPEND_REGEX);
  if (appendMatch) {
    let target = String(appendMatch[1] || '').trim();
    let payload = String(appendMatch[2] || '').trim();

    if (target) {
      const split = splitTargetAndPayload(target);
      target = split.target;
      payload = [split.payload, payload].filter(Boolean).join(' ').trim();
    }

    if (payload) {
      const payloadParts = payload.split(/\s+/);
      const maybeImplicit = `${target} ${payloadParts[0] || ''}`.trim();
      if (isImplicitReference(maybeImplicit)) {
        target = maybeImplicit;
        payload = payloadParts.slice(1).join(' ').trim();
      }
    }

    if (target.includes(' ') && !isImplicitReference(target)) {
      const parts = target.split(/\s+/);
      const firstToken = parts[0];
      const rest = parts.slice(1).join(' ');
      target = firstToken;
      payload = `${rest}${payload ? ` ${payload}` : ''}`.trim();
    }

    if (target && payload) return { handled: true, action: 'APPEND', target, payload };
    if (target && !payload) {
      const parts = target.split(/\s+/);
      const candidateTarget = parts[0] || '';
      const restPayload = parts.slice(1).join(' ').trim();
      if (restPayload && isRecognizableTarget(candidateTarget)) {
        return { handled: true, action: 'APPEND', target: candidateTarget, payload: restPayload };
      }
      if (isRecognizableTarget(target) || isImplicitReference(target)) {
        return { handled: true, action: 'APPEND', target };
      }
    }
  }

  const appendInlineMatch = ctx.raw.match(APPEND_INLINE_REGEX);
  if (appendInlineMatch) {
    const target = String(appendInlineMatch[1] || '').trim();
    const payload = String(appendInlineMatch[2] || '').trim();
    if (payload && (target.startsWith('art-') || target.includes('.'))) {
      return { handled: true, action: 'APPEND', target, payload };
    }
  }

  const appendFallbackMatch = ctx.normalized.match(new RegExp(`^${APPEND_VERBS}\\b\\s*(.*)$`, 'i'));
  if (appendFallbackMatch) {
    const payload = String(appendFallbackMatch[1] || '').trim();
    return payload
      ? { handled: true, action: 'APPEND', payload }
      : { handled: true, action: 'APPEND' };
  }

  return null;
}

function detectReplaceIntent(ctx: IntentInput): ActionFirstResult | null {
  const editReplaceMatch = ctx.raw.match(EDIT_REPLACE_REGEX);
  if (editReplaceMatch) {
    const target = String(editReplaceMatch[1] || '').trim();
    const payload = String(editReplaceMatch[2] || '').trim();
    if (target && payload) return { handled: true, action: 'REPLACE', target, payload };
  }

  const replaceMatch = ctx.normalized.match(REPLACE_REGEX);
  if (replaceMatch) {
    const { target, payload } = splitTargetAndPayload(String(replaceMatch[1] || ''));
    if (target) return { handled: true, action: 'REPLACE', target, payload };
  }

  const replaceFallbackMatch = ctx.normalized.match(/^(?:zamien|zastap|replace)\b\s*(.*)$/i);
  if (replaceFallbackMatch) {
    const payload = String(replaceFallbackMatch[1] || '').trim();
    return payload
      ? { handled: true, action: 'REPLACE', payload }
      : { handled: true, action: 'REPLACE' };
  }

  return null;
}

function detectReadIntent(ctx: IntentInput): ActionFirstResult | null {
  const readMatch = ctx.normalized.match(READ_REGEX);
  if (readMatch) return { handled: true, action: 'READ', target: readMatch[1] };
  return null;
}

function detectFileIntent(text: string): ActionFirstResult | null {
  const ctx = normalizeIntentInput(text);
  // Contract: null means no actionable intent (including ignored inputs).
  if (shouldIgnoreActionIntent(ctx)) return null;

  const regexResult =
    detectCreateIntent(ctx) ??
    detectAppendIntent(ctx) ??
    detectReplaceIntent(ctx) ??
    detectReadIntent(ctx);

  const { fuzzyCategory, regexMissed } = detectFuzzyMismatch(text, regexResult);
  if (regexMissed && fuzzyCategory) {
    eventBus.publish({
      id: generateUUID(),
      timestamp: Date.now(),
      source: AgentType.CORTEX_FLOW,
      type: PacketType.PREDICTION_ERROR,
      payload: {
        metric: 'FUZZY_REGEX_MISMATCH',
        fuzzyCategory,
        inputPreview: text.slice(0, 100)
      },
      priority: 0.4
    });

    const isDev = typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production';
    if (isDev) {
      console.log(`[FUZZY_MISMATCH] Detected ${fuzzyCategory}, regex missed. Input: "${text.slice(0, 60)}..."`);
    }
  }

  return regexResult;
}

function detectSearchIntent(_text: string): ActionFirstResult | null {
  return null;
}

function detectVisualizeIntent(_text: string): ActionFirstResult | null {
  return null;
}

function detectResearchIntent(_text: string): ActionFirstResult | null {
  return null;
}

export function detectActionableIntent(input: string): ActionFirstResult {
  return (
    detectFileIntent(input) ??
    detectSearchIntent(input) ??
    detectVisualizeIntent(input) ??
    detectResearchIntent(input) ??
    { handled: false }
  );
}

export function detectActionableIntentForTesting(input: string): ActionFirstResult {
  return detectActionableIntent(input);
}

export function detectFileIntentForTesting(input: string): ActionFirstResult | null {
  return detectFileIntent(input);
}
