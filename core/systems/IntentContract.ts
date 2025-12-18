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

    let inString = false;
    let escape = false;
    let depth = 0;

    for (let i = start; i < input.length; i++) {
        const ch = input[i];

        if (inString) {
            if (escape) {
                escape = false;
                continue;
            }
            if (ch === '\\') {
                escape = true;
                continue;
            }
            if (ch === '"') {
                inString = false;
            }
            continue;
        }

        if (ch === '"') {
            inString = true;
            continue;
        }

        if (ch === '{') depth++;
        if (ch === '}') {
            depth--;
            if (depth === 0) return input.slice(start, i + 1);
        }
    }

    return null;
}

/**
 * Attempt to repair common JSON errors from LLM output:
 * - Unquoted property names
 * - Single quotes instead of double quotes
 * - Trailing commas
 */
function repairJSON(input: string): string {
    let result = input;
    result = result.replace(/[“”]/g, '"').replace(/[‘’]/g, "'");

    {
        let out = '';
        let inString = false;
        let escape = false;
        for (let i = 0; i < result.length; i++) {
            const ch = result[i];
            if (inString) {
                if (escape) {
                    out += ch;
                    escape = false;
                    continue;
                }
                if (ch === '\\') {
                    out += ch;
                    escape = true;
                    continue;
                }
                if (ch === '"') {
                    out += ch;
                    inString = false;
                    continue;
                }
                if (ch === '\n') {
                    out += '\\n';
                    continue;
                }
                if (ch === '\r') {
                    out += '\\r';
                    continue;
                }
                out += ch;
                continue;
            }

            if (ch === '"') {
                out += ch;
                inString = true;
                continue;
            }

            out += ch;
        }
        result = out;
    }
    // Replace single quotes with double quotes
    result = result.replace(/'/g, '"');
    // Fix unquoted property names: { foo: "bar" } → { "foo": "bar" }
    result = result.replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');
    // Remove trailing commas before } or ]
    result = result.replace(/(,)(\s*[}\]])/g, '$2');
    return result;
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
        // Try to repair common JSON errors and parse again
        try {
            const repaired = repairJSON(jsonObj);
            parsed = JSON.parse(repaired);
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
