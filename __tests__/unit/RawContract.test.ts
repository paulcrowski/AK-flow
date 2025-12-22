import { describe, it, expect } from 'vitest';
import { applyAutonomyV2RawContract } from '../../core/systems/RawContract';

describe('RawContract', () => {
    it('should fail closed on empty response', () => {
        const r = applyAutonomyV2RawContract(undefined);
        expect(r.ok).toBe(false);
        expect(r.reason).toBe('EMPTY_RESPONSE');
        expect(r.value.voice_pressure).toBe(0);
    });

    it('should accept fenced json block', () => {
        const raw = '```json\n{"internal_monologue":"x","voice_pressure":0.5,"speech_content":"y"}\n```';
        const r = applyAutonomyV2RawContract(raw);
        expect(r.ok).toBe(true);
        expect(r.value.internal_monologue).toBe('x');
        expect(r.value.speech_content).toBe('y');
    });

    it('should accept double-encoded json string literal', () => {
        const rawObj = { internal_monologue: 'x', voice_pressure: 0.5, speech_content: 'y' };
        const raw = JSON.stringify(JSON.stringify(rawObj));
        const r = applyAutonomyV2RawContract(raw);
        expect(r.ok).toBe(true);
        expect(r.value.internal_monologue).toBe('x');
    });

    it('should fail closed when no json object present', () => {
        const r = applyAutonomyV2RawContract('hello world');
        expect(r.ok).toBe(false);
        expect(r.reason).toBe('NO_JSON_OBJECT');
    });

    it('should fail closed when prefixed with prose before json object', () => {
        const r = applyAutonomyV2RawContract('json {"internal_monologue":"x","voice_pressure":0.5,"speech_content":"y"}');
        expect(r.ok).toBe(false);
        expect(r.reason).toBe('NO_JSON_OBJECT');
    });

    it('should fail closed on invalid json', () => {
        const r = applyAutonomyV2RawContract('{"internal_monologue":');
        expect(r.ok).toBe(false);
        expect(r.reason).toBe('JSON_PARSE_ERROR');
    });

    it('should clamp output lengths and sanitize control chars', () => {
        const long = 'x'.repeat(5000);
        const r = applyAutonomyV2RawContract(
            JSON.stringify({
                internal_monologue: `a\u0000b${long}`,
                voice_pressure: 0.7,
                speech_content: `c\u0007d${long}`
            })
        );

        expect(r.ok).toBe(true);
        expect(r.value.internal_monologue.includes('\u0000')).toBe(false);
        expect(r.value.speech_content.includes('\u0007')).toBe(false);
        expect(r.value.internal_monologue.length).toBeLessThanOrEqual(1200);
        expect(r.value.speech_content.length).toBeLessThanOrEqual(1200);
    });

    it('should detect simple repetition loops and silence', () => {
        const spam = 'hello world hello world hello world hello world hello world hello world hello world hello world hello world hello world '; 
        const r = applyAutonomyV2RawContract(
            JSON.stringify({
                internal_monologue: spam.repeat(10),
                voice_pressure: 0.9,
                speech_content: ''
            })
        );

        expect(r.ok).toBe(false);
        expect(r.reason).toBe('LOOP_DETECTED');
        expect(r.value.voice_pressure).toBe(0);
    });
});
