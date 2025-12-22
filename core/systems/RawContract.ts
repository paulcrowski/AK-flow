import { parseJsonFromLLM } from '../../utils/AIResponseParser';
import { SYSTEM_CONFIG } from '../config/systemConfig';

export type RawContractFailureReason =
    | 'EMPTY_RESPONSE'
    | 'NO_JSON_OBJECT'
    | 'JSON_PARSE_ERROR'
    | 'VALIDATION_FAILED'
    | 'LOOP_DETECTED';

export interface AutonomyV2Volition {
    internal_monologue: string;
    voice_pressure: number;
    speech_content: string;
}

export interface RawContractResult<T> {
    ok: boolean;
    value: T;
    reason?: RawContractFailureReason;
    details?: string;
}

function sanitizeText(input: string, maxLen: number): string {
    return input
        .slice(0, maxLen)
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
}

function clampString(input: unknown, maxLen: number): string {
    if (typeof input !== 'string') return '';
    return sanitizeText(input, maxLen).trim();
}

function toNumber(input: unknown): number {
    const n = typeof input === 'number' ? input : Number(input);
    if (!Number.isFinite(n)) return 0;
    return n;
}

function tokenizeForRepetition(input: string): string[] {
    return input
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
        .split(/\s+/)
        .filter(Boolean);
}

function looksRepetitive(text: string): boolean {
    const tokens = tokenizeForRepetition(text);
    if (tokens.length < 40) return false;

    const n = 3;
    const counts = new Map<string, number>();
    let maxCount = 0;

    for (let i = 0; i + n <= tokens.length; i++) {
        const gram = `${tokens[i]} ${tokens[i + 1]} ${tokens[i + 2]}`;
        const next = (counts.get(gram) ?? 0) + 1;
        counts.set(gram, next);
        if (next > maxCount) maxCount = next;
        if (maxCount >= 6) return true;
    }

    const sample = text.trim().slice(0, 80);
    if (sample.length >= 40) {
        const occ = text.split(sample).length - 1;
        if (occ >= 3) return true;
    }

    return false;
}

export function applyAutonomyV2RawContract(
    rawText: string | undefined,
    opts?: {
        maxRawLen?: number;
        maxInternalMonologueLen?: number;
        maxSpeechLen?: number;
    }
): RawContractResult<AutonomyV2Volition> {
    const maxRawLen = opts?.maxRawLen ?? 20000;
    const maxInternalMonologueLen = opts?.maxInternalMonologueLen ?? 1200;
    const maxSpeechLen = opts?.maxSpeechLen ?? 1200;

    const silent: AutonomyV2Volition = {
        internal_monologue: '',
        voice_pressure: 0,
        speech_content: ''
    };

    if (!rawText) {
        return { ok: false, value: silent, reason: 'EMPTY_RESPONSE' };
    }

    const sanitized = sanitizeText(rawText, maxRawLen);

    const failClosedEnabled = (SYSTEM_CONFIG.features as Record<string, boolean>).P011_FAIL_CLOSED_JSON_ENABLED ?? true;
    const trimmed = sanitized.trimStart();
    if (failClosedEnabled && !trimmed.startsWith('{')) {
        return { ok: false, value: silent, reason: 'NO_JSON_OBJECT', details: 'TRIM_NOT_JSON_OBJECT' };
    }

    const parsedResult = parseJsonFromLLM<any>(sanitized, { allowRepair: true, requireJsonBlock: true });
    if (!parsedResult.ok) {
        if (parsedResult.reason === 'NO_JSON') {
            // If there's a JSON opener but no extractable balanced block, treat as parse error (truncated/invalid JSON).
            // "NO_JSON_OBJECT" is reserved for outputs that contain no JSON at all.
            const hasJsonOpener = sanitized.includes('{') || sanitized.includes('[');
            if (hasJsonOpener) {
                return {
                    ok: false,
                    value: silent,
                    reason: 'JSON_PARSE_ERROR',
                    details: parsedResult.error || 'NO_BALANCED_JSON_BLOCK'
                };
            }

            return { ok: false, value: silent, reason: 'NO_JSON_OBJECT' };
        }
        if (parsedResult.reason === 'EMPTY') {
            return { ok: false, value: silent, reason: 'EMPTY_RESPONSE' };
        }
        return {
            ok: false,
            value: silent,
            reason: 'JSON_PARSE_ERROR',
            details: parsedResult.error || parsedResult.reason
        };
    }

    const parsed: any = parsedResult.value;

    if (!parsed || typeof parsed !== 'object') {
        return { ok: false, value: silent, reason: 'VALIDATION_FAILED' };
    }

    const internal_monologue = clampString(parsed.internal_monologue, maxInternalMonologueLen);
    const speech_content = clampString(parsed.speech_content, maxSpeechLen);
    const voice_pressure = toNumber(parsed.voice_pressure);

    if (internal_monologue.length === 0 && speech_content.length === 0) {
        return { ok: false, value: silent, reason: 'VALIDATION_FAILED' };
    }

    if (looksRepetitive(internal_monologue) || looksRepetitive(speech_content)) {
        return { ok: false, value: silent, reason: 'LOOP_DETECTED' };
    }

    return {
        ok: true,
        value: {
            internal_monologue,
            voice_pressure,
            speech_content
        }
    };
}
