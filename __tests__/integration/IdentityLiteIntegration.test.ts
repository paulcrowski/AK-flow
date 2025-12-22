import { describe, test, expect } from 'vitest';
import { extractJSON, extractSummary } from '@utils/AIResponseParser';
import { executeWakeProcess } from '@core/services/WakeService';

describe('Identity-Lite Integration', () => {
    describe('AIResponseParser', () => {
        test('should extract clean JSON', () => {
            const input = '{"foo": "bar"}';
            expect(extractJSON(input)).toEqual({ foo: 'bar' });
        });

        test('should extract JSON from markdown', () => {
            const input = 'Here is code:\n```json\n{"foo": "bar"}\n```';
            expect(extractJSON(input)).toEqual({ foo: 'bar' });
        });

        test('should extract JSON from text', () => {
            const input = 'Some text before {"foo": "bar"} some text after';
            expect(extractJSON(input)).toEqual({ foo: 'bar' });
        });

        test('should handle invalid JSON with fallback', () => {
            const input = 'Invalid JSON';
            const fallback = { error: true };
            expect(extractJSON(input, { fallback })).toEqual(fallback);
        });

        test('extractSummary should return text fallback', () => {
            const input = 'Just text summary.';
            expect(extractSummary(input)).toBe('Just text summary.');
        });
    });

    describe('WakeService Interface', () => {
        test('should export executeWakeProcess function', () => {
            expect(typeof executeWakeProcess).toBe('function');
        });
    });
});
