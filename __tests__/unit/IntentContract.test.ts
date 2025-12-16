import { describe, it, expect } from 'vitest';
import type { DetectedIntent } from '../../types';
import { parseDetectedIntent } from '../../core/systems/IntentContract';

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
});
