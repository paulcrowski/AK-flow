import type { DetectedIntent } from '../../types';

export interface IntentParseResult {
    ok: boolean;
    value: DetectedIntent;
    reason?: 'EMPTY' | 'NO_JSON' | 'PARSE_ERROR' | 'VALIDATION_FAILED';
}

const STYLE = new Set<DetectedIntent['style']>(['POETIC', 'SIMPLE', 'ACADEMIC', 'NEUTRAL']);
const COMMAND = new Set<DetectedIntent['command']>(['NONE', 'SEARCH', 'VISUALIZE', 'SYSTEM_CONTROL']);
const URGENCY = new Set<DetectedIntent['urgency']>(['LOW', 'MEDIUM', 'HIGH']);

function sanitizeText(input: string, maxLen: number): string {
    return input
        .slice(0, maxLen)
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
}

function extractJSONObject(input: string): string | null {
    const start = input.indexOf('{');
    if (start === -1) return null;

    const end = input.lastIndexOf('}');
    if (end === -1) return input.slice(start);
    if (end <= start) return null;
    return input.slice(start, end + 1);
}

export function parseDetectedIntent(
    text: string | undefined,
    safeDefault: DetectedIntent,
    opts?: { maxLen?: number }
): IntentParseResult {
    if (!text) return { ok: false, value: safeDefault, reason: 'EMPTY' };

    const sanitized = sanitizeText(text, opts?.maxLen ?? 4000);
    const jsonObj = extractJSONObject(sanitized);
    if (!jsonObj) return { ok: false, value: safeDefault, reason: 'NO_JSON' };

    let parsed: any;
    try {
        parsed = JSON.parse(jsonObj);
    } catch {
        return { ok: false, value: safeDefault, reason: 'PARSE_ERROR' };
    }

    const style = parsed?.style;
    const command = parsed?.command;
    const urgency = parsed?.urgency;

    if (!STYLE.has(style) || !COMMAND.has(command) || !URGENCY.has(urgency)) {
        return { ok: false, value: safeDefault, reason: 'VALIDATION_FAILED' };
    }

    return { ok: true, value: { style, command, urgency } };
}
