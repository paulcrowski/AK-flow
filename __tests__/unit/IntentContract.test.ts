import { describe, it, expect } from 'vitest';
import type { DetectedIntent } from '@/types';
import { parseDetectedIntent } from '@core/systems/IntentContract';
import { detectActionableIntentForTesting } from '@core/systems/eventloop/ReactiveStep';

describe('IntentContract', () => {
    const safeDefault: DetectedIntent = {
        style: 'NEUTRAL',
        command: 'NONE',
        urgency: 'LOW'
    };

    it('should parse valid json', () => {
        const r = parseDetectedIntent('{"style":"SIMPLE","command":"NONE","urgency":"HIGH"}', safeDefault);
        expect(r.ok).toBe(true);
        expect(r.value.style).toBe('SIMPLE');
        expect(r.value.urgency).toBe('HIGH');
    });

    it('should parse when prefixed with prose', () => {
        const text = 'Here is the JSON you requested:\n{"style":"NEUTRAL","command":"SEARCH","urgency":"MEDIUM"}';
        const r = parseDetectedIntent(text, safeDefault);
        expect(r.ok).toBe(true);
        expect(r.value.command).toBe('SEARCH');
    });

    it('should fail validation on unknown fields', () => {
        const r = parseDetectedIntent('{"style":"XXX","command":"NONE","urgency":"LOW"}', safeDefault);
        expect(r.ok).toBe(false);
        expect(r.reason).toBe('VALIDATION_FAILED');
    });

    it('should fail when no json present', () => {
        const r = parseDetectedIntent('no json here', safeDefault);
        expect(r.ok).toBe(false);
        expect(r.reason).toBe('NO_JSON');
    });

    it('should repair single quotes and parse', () => {
        const text = "{'style':'SIMPLE','command':'NONE','urgency':'LOW'}";
        const r = parseDetectedIntent(text, safeDefault);
        expect(r.ok).toBe(true);
        expect(r.value.style).toBe('SIMPLE');
    });

    it('should repair unquoted keys and parse', () => {
        const text = '{style:"ACADEMIC",command:"SEARCH",urgency:"MEDIUM"}';
        const r = parseDetectedIntent(text, safeDefault);
        expect(r.ok).toBe(true);
        expect(r.value.style).toBe('ACADEMIC');
        expect(r.value.command).toBe('SEARCH');
    });

    it('should repair trailing commas and parse', () => {
        const text = '{"style":"NEUTRAL","command":"NONE","urgency":"HIGH",}';
        const r = parseDetectedIntent(text, safeDefault);
        expect(r.ok).toBe(true);
        expect(r.value.urgency).toBe('HIGH');
    });
});

describe('P0.1.1 Action-First intent detection', () => {
    it('CREATE: should accept "utworz" (no diacritics) and derive filename from phrase', () => {
        const r = detectActionableIntentForTesting('utworz plik o kotkach');
        expect(r.handled).toBe(true);
        expect(r.action).toBe('CREATE');
        expect(String(r.target || '')).toMatch(/\.md$/);
        expect(String(r.target || '')).toContain('kotkach');
    });

    it('APPEND: verb + target + payload required', () => {
        const r = detectActionableIntentForTesting('dopisz do note.md: hello');
        expect(r.handled).toBe(true);
        expect(r.action).toBe('APPEND');
        expect(r.target).toBe('note.md');
        expect(r.payload).toBe('hello');
    });

    it('REPLACE: verb + target detected (payload optional)', () => {
        const r = detectActionableIntentForTesting('zamien w note.md: nowa tresc');
        expect(r.handled).toBe(true);
        expect(r.action).toBe('REPLACE');
        expect(r.target).toBe('note.md');
        expect(r.payload).toBe('nowa tresc');
    });

    it('READ: verb + target detected', () => {
        const r = detectActionableIntentForTesting('pokaz note');
        expect(r.handled).toBe(true);
        expect(r.action).toBe('READ');
        expect(r.target).toBe('note');
    });

    it('should ignore capability questions', () => {
        const r = detectActionableIntentForTesting('umiesz wygenerowac notatke?');
        expect(r.handled).toBe(false);
    });
});
