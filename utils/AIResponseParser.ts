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

export default {
    extractJSON,
    safeParseJSON,
    extractFields,
    parseAIResponse,
    extractSummary
};
