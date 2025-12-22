import type { DetectedIntent } from '../../types';
import { extractJsonBlock, repairJsonMinimal } from '../../utils/AIResponseParser';

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
    const block = extractJsonBlock(input);
    if (!block) return null;
    if (!block.trim().startsWith('{')) return null;
    return block;
}

/**
 * Attempt to repair common JSON errors from LLM output:
 * - Unquoted property names
 * - Single quotes instead of double quotes
 * - Trailing commas
 */
function repairJSON(input: string): string {
    return repairJsonMinimal(input);
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
        try {
            parsed = JSON.parse(repairJSON(jsonObj));
        } catch {
            return { ok: false, value: safeDefault, reason: 'PARSE_ERROR' };
        }
    }

    const style = parsed?.style;
    const command = parsed?.command;
    const urgency = parsed?.urgency;

    if (!STYLE.has(style) || !COMMAND.has(command) || !URGENCY.has(urgency)) {
        return { ok: false, value: safeDefault, reason: 'VALIDATION_FAILED' };
    }

    return { ok: true, value: { style, command, urgency } };
}
