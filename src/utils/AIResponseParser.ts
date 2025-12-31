import { eventBus } from '../core/EventBus';
import { AgentType, PacketType } from '../types';
import { generateUUID } from './uuid';

/**
 * AIResponseParser - Utility for extracting structured data from AI responses
 * 
 * Problem: AI models often return text with JSON embedded, or malformed JSON.
 * This module provides robust extraction and parsing.
 * 
 * Usage:
 *   import { extractJSON, parseAIResponse, safeParseJSON } from './AIResponseParser';
 *   
 *   const result = extractJSON<MyType>(aiResponse, { fallback: defaultValue });
 */

export interface ExtractOptions<T> {
    /** Fallback value if extraction fails */
    fallback?: T;
    /** Log warnings on failure */
    logWarnings?: boolean;
    /** Custom regex pattern for extraction */
    pattern?: RegExp;
}

/**
 * Extract JSON object from AI response text
 * Handles cases where AI includes text before/after JSON
 */
export function extractJSON<T = Record<string, unknown>>(
    text: string,
    options: ExtractOptions<T> = {}
): T | null {
    const { fallback = null, logWarnings = true, pattern } = options;

    if (!text || typeof text !== 'string') {
        if (logWarnings) console.warn('[AIResponseParser] Empty or invalid input');
        return fallback as T | null;
    }

    // Try multiple extraction strategies
    const strategies = [
        // Strategy 1: Direct JSON parse (response is pure JSON)
        () => JSON.parse(text.trim()),

        // Strategy 2: Extract first JSON object {...}
        () => {
            const match = text.match(/\{[\s\S]*\}/);
            if (!match) throw new Error('No JSON object found');
            return JSON.parse(match[0]);
        },

        // Strategy 3: Extract JSON array [...]
        () => {
            const match = text.match(/\[[\s\S]*\]/);
            if (!match) throw new Error('No JSON array found');
            return JSON.parse(match[0]);
        },

        // Strategy 4: Extract from markdown code block ```json ... ```
        () => {
            const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
            if (!match) throw new Error('No code block found');
            return JSON.parse(match[1].trim());
        },

        // Strategy 5: Custom pattern if provided
        ...(pattern ? [() => {
            const match = text.match(pattern);
            if (!match) throw new Error('Custom pattern not matched');
            return JSON.parse(match[1] || match[0]);
        }] : [])
    ];

    for (const strategy of strategies) {
        try {
            const result = strategy();
            if (result !== null && typeof result === 'object') {
                return result as T;
            }
        } catch {
            // Try next strategy
        }
    }

    if (logWarnings) {
        console.warn('[AIResponseParser] Failed to extract JSON from response:', text.slice(0, 100) + '...');
    }

    return fallback as T | null;
}

/**
 * Safe JSON parse with fallback
 */
export function safeParseJSON<T>(
    text: string,
    fallback: T
): T {
    try {
        return JSON.parse(text);
    } catch {
        return fallback;
    }
}

/**
 * Extract specific fields from AI response with type safety
 */
export function extractFields<T extends Record<string, unknown>>(
    text: string,
    fields: (keyof T)[],
    defaults: Partial<T> = {}
): Partial<T> {
    const parsed = extractJSON<T>(text, { logWarnings: false });

    if (!parsed) {
        return defaults;
    }

    const result: Partial<T> = {};
    for (const field of fields) {
        result[field] = parsed[field] !== undefined ? parsed[field] : defaults[field];
    }

    return result;
}

/**
 * Parse AI response and return typed result with validation
 */
export interface ParseResult<T> {
    success: boolean;
    data: T | null;
    error?: string;
    rawText: string;
}

export function parseAIResponse<T>(
    text: string,
    validator?: (data: unknown) => data is T
): ParseResult<T> {
    const raw = text || '';
    const parsed = extractJSON<T>(raw, { logWarnings: false });

    if (!parsed) {
        return {
            success: false,
            data: null,
            error: 'Failed to extract JSON from response',
            rawText: raw
        };
    }

    if (validator && !validator(parsed)) {
        return {
            success: false,
            data: null,
            error: 'Validation failed',
            rawText: raw
        };
    }

    return {
        success: true,
        data: parsed,
        rawText: raw
    };
}

/**
 * Extract text that looks like a summary (first paragraph or sentence)
 * Useful when AI returns prose instead of JSON
 */
export function extractSummary(text: string, maxLength: number = 500): string {
    if (!text) return '';

    // Remove JSON if present (take text before or after)
    const withoutJson = text.replace(/\{[\s\S]*\}/, '').trim();

    if (withoutJson.length > 10) {
        return withoutJson.slice(0, maxLength);
    }

    // If no text outside JSON, take first paragraph
    const firstParagraph = text.split('\n\n')[0];
    return firstParagraph.slice(0, maxLength);
}

export type LLMJsonParseFailureReason = 'EMPTY' | 'NO_JSON' | 'PARSE_ERROR';

export interface LLMJsonParseOptions<T> {
    validator?: (data: unknown) => data is T;
    allowRepair?: boolean;
    requireJsonBlock?: boolean;
}

export interface LLMJsonParseResult<T> {
    ok: boolean;
    value?: T;
    reason?: LLMJsonParseFailureReason;
    repaired?: boolean;
    extracted?: string;
    error?: string;
}

function extractCodeFenceBlocks(text: string): string[] {
    const blocks: string[] = [];
    const re = /```(?:json)?\s*([\s\S]*?)```/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
        const inner = (m[1] || '').trim();
        if (inner) blocks.push(inner);
        if (blocks.length >= 3) break;
    }
    return blocks;
}

function extractBalancedFrom(text: string, start: number): string | null {
    const open = text[start];
    const close = open === '{' ? '}' : open === '[' ? ']' : null;
    if (!close) return null;

    let inString = false;
    let stringChar: '"' | '\'' | '' = '';
    let escape = false;
    let depth = 0;

    for (let i = start; i < text.length; i++) {
        const ch = text[i];
        if (inString) {
            if (escape) {
                escape = false;
                continue;
            }
            if (ch === '\\') {
                escape = true;
                continue;
            }
            if (ch === stringChar) {
                inString = false;
                stringChar = '';
            }
            continue;
        }

        if (ch === '"' || ch === "'") {
            inString = true;
            stringChar = ch as '"' | '\'';
            continue;
        }

        if (ch === open) depth++;
        if (ch === close) {
            depth--;
            if (depth === 0) return text.slice(start, i + 1);
        }
    }

    return null;
}

function unwrapJsonStringLiteral(text: string): string | null {
    const raw = String(text || '').trim();
    if (!raw) return null;

    // Common failure mode: model returns JSON object encoded as a JSON string
    // Example: "{\"style\":\"NEUTRAL\"}"
    if (!raw.startsWith('"')) return null;

    try {
        const unwrapped = JSON.parse(raw);
        if (typeof unwrapped !== 'string') return null;
        const inner = unwrapped.trim();
        if (!inner) return null;
        if (!(inner.includes('{') || inner.includes('['))) return null;
        return inner;
    } catch {
        return null;
    }
}

export function extractJsonBlock(text: string): string | null {
    const raw = String(text || '').trim();
    if (!raw) return null;

    const unwrapped = unwrapJsonStringLiteral(raw);
    if (unwrapped) {
        const nested = extractJsonBlock(unwrapped);
        if (nested) return nested;
    }

    const fenced = extractCodeFenceBlocks(raw);
    if (fenced.length > 0) return fenced[0];

    const objStart = raw.indexOf('{');
    const arrStart = raw.indexOf('[');
    const start = objStart === -1 ? arrStart : arrStart === -1 ? objStart : Math.min(objStart, arrStart);
    if (start === -1) return null;

    const balanced = extractBalancedFrom(raw, start);
    return balanced;
}

export function repairJsonMinimal(input: string): string {
    let normalized = String(input || '');
    normalized = normalized.replace(/[“”]/g, '"').replace(/[‘’]/g, "'");

    let out = '';
    let inString = false;
    let stringChar: '"' | '\'' | '' = '';
    let escape = false;

    for (let i = 0; i < normalized.length; i++) {
        const ch = normalized[i];

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
            if (ch === stringChar) {
                out += '"';
                inString = false;
                stringChar = '';
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

        if (ch === '"' || ch === "'") {
            inString = true;
            stringChar = ch as '"' | '\'';
            out += '"';
            continue;
        }

        out += ch;
    }

    out = out.replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');
    out = out.replace(/,(\s*[}\]])/g, '$1');
    return out;
}

export function repairTruncatedJson(input: string): {
    repaired: string;
    wasRepaired: boolean;
    repairs: string[];
} {
    const repairs: string[] = [];
    let result = String(input || '').trim();

    if (!result) return { repaired: result, wasRepaired: false, repairs };

    // 1. Dangling key without value: "tool_intent": -> "tool_intent": null
    if (/"\s*:\s*$/.test(result)) {
        result += 'null';
        repairs.push('added_null_for_dangling_key');
    }

    // 2. Unclosed string
    const quoteCount = (result.match(/(?<!\\)"/g) || []).length;
    if (quoteCount % 2 !== 0) {
        result += '"';
        repairs.push('closed_string');
    }

    // 3. Close brackets/braces
    const opens = (result.match(/\[/g) || []).length;
    const closes = (result.match(/\]/g) || []).length;
    for (let i = 0; i < opens - closes; i++) {
        result += ']';
        repairs.push('closed_bracket');
    }

    const openBraces = (result.match(/\{/g) || []).length;
    const closeBraces = (result.match(/\}/g) || []).length;
    for (let i = 0; i < openBraces - closeBraces; i++) {
        result += '}';
        repairs.push('closed_brace');
    }

    // 4. Trailing comma
    const trimmed = result.replace(/,\s*([}\]])/g, '$1');
    if (trimmed !== result) repairs.push('removed_trailing_comma');
    result = trimmed;

    return { repaired: result, wasRepaired: repairs.length > 0, repairs };
}

export function parseJsonFromLLM<T>(
    text: string | undefined,
    options: LLMJsonParseOptions<T> = {}
): LLMJsonParseResult<T> {
    const raw = String(text || '').trim();
    if (!raw) return { ok: false, reason: 'EMPTY' };

    const candidates: string[] = [];

    const unwrapped = unwrapJsonStringLiteral(raw);
    if (unwrapped) {
        candidates.push(unwrapped);
    }

    if (!options.requireJsonBlock && (raw.startsWith('{') || raw.startsWith('['))) {
        candidates.push(raw);
    }

    const fenced = extractCodeFenceBlocks(raw);
    for (const b of fenced) candidates.push(b);

    const block = extractJsonBlock(raw);
    if (block) candidates.push(block);

    if (unwrapped) {
        const nestedBlock = extractJsonBlock(unwrapped);
        if (nestedBlock) candidates.push(nestedBlock);
    }

    const uniq = Array.from(new Set(candidates.map((c) => c.trim()).filter(Boolean)));
    if (uniq.length === 0) return { ok: false, reason: 'NO_JSON' };

    let lastErr: unknown = null;

    for (const c of uniq) {
        try {
            const parsed = JSON.parse(c);
            if (options.validator && !options.validator(parsed)) continue;
            return { ok: true, value: parsed as T, repaired: false, extracted: c };
        } catch (e) {
            lastErr = e;
        }
    }

    if (options.allowRepair) {
        for (const c of uniq) {
            const repaired = repairJsonMinimal(c);
            try {
                const parsed = JSON.parse(repaired);
                if (options.validator && !options.validator(parsed)) continue;
                return { ok: true, value: parsed as T, repaired: true, extracted: c };
            } catch (e) {
                lastErr = e;
            }
        }

        for (const c of uniq) {
            const { repaired, wasRepaired, repairs } = repairTruncatedJson(c);
            if (!wasRepaired) continue;
            try {
                const parsed = JSON.parse(repaired);
                if (options.validator && !options.validator(parsed)) continue;

                eventBus.publish({
                    id: generateUUID(),
                    timestamp: Date.now(),
                    source: AgentType.CORTEX_FLOW,
                    type: PacketType.PREDICTION_ERROR,
                    payload: {
                        metric: 'JSON_TRUNCATION_REPAIRED',
                        repairs: repairs.join(','),
                        inputLength: c.length,
                        outputLength: repaired.length
                    },
                    priority: 0.4
                });

                const isDev = typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production';
                if (isDev) {
                    console.log(`[JSON_REPAIR] ${repairs.join(', ')}. In: ${c.length}, Out: ${repaired.length}`);
                }

                return {
                    ok: true,
                    value: parsed as T,
                    repaired: true,
                    extracted: c,
                    error: `TRUNCATION_REPAIRED:${repairs.join(',')}`
                };
            } catch (e) {
                lastErr = e;
            }
        }
    }

    const error = lastErr instanceof Error ? lastErr.message : lastErr ? String(lastErr) : undefined;
    return { ok: false, reason: 'PARSE_ERROR', error };
}

export default {
    extractJSON,
    safeParseJSON,
    extractFields,
    parseAIResponse,
    extractSummary,
    extractJsonBlock,
    repairJsonMinimal,
    repairTruncatedJson,
    parseJsonFromLLM
};
