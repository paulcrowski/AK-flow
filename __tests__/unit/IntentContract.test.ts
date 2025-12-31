import { describe, it, expect } from 'vitest';
import type { DetectedIntent } from '@/types';
import { parseDetectedIntent } from '@core/systems/IntentContract';
import { detectActionableIntentForTesting, detectFileIntentForTesting } from '@core/systems/eventloop/ReactiveStep';

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

    it('CREATE: should capture content after "z trescia" and derive filename from content', () => {
        const r = detectActionableIntentForTesting('utworz plik z trescia lubie jesc lody');
        expect(r.handled).toBe(true);
        expect(r.action).toBe('CREATE');
        expect(r.payload).toBe('lubie jesc lody');
        expect(String(r.target || '')).toMatch(/lubie-jesc-lody/);
        expect(String(r.target || '')).toMatch(/\.md$/);
    });

    it('CREATE: should keep explicit filename when provided with content', () => {
        const r = detectActionableIntentForTesting('utworz plik notatka.md z trescia hello');
        expect(r.handled).toBe(true);
        expect(r.action).toBe('CREATE');
        expect(r.target).toBe('notatka.md');
        expect(r.payload).toBe('hello');
    });

    it('CREATE: should parse explicit filename with "tresc:" payload', () => {
        const r = detectActionableIntentForTesting('stworz plik paul.txt tresc: testuje cos');
        expect(r.handled).toBe(true);
        expect(r.action).toBe('CREATE');
        expect(r.target).toBe('paul.txt');
        expect(r.payload).toBe('testuje cos');
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

    it('APPEND: should accept edit + add content phrasing', () => {
        const r = detectActionableIntentForTesting('edytuj plik art-123 dodaj tresc hello');
        expect(r.handled).toBe(true);
        expect(r.action).toBe('APPEND');
        expect(r.target).toBe('art-123');
        expect(r.payload).toBe('hello');
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

    it('detectFileIntent should return null for capability questions (null means no intent)', () => {
        const r = detectFileIntentForTesting('umiesz wygenerowac notatke?');
        expect(r).toBeNull();
    });
});
