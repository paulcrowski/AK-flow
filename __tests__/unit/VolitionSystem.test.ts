import { describe, it, expect } from 'vitest';
import { VolitionSystem } from '@core/systems/VolitionSystem';
import type { LimbicState } from '@/types';

const calmLimbic: LimbicState = {
    fear: 0.1,
    curiosity: 0.5,
    frustration: 0.1,
    satisfaction: 0.5
};

describe('VolitionSystem.shouldSpeak', () => {
    it('should inhibit empty content', () => {
        const d = VolitionSystem.shouldSpeak('', 1, 0, calmLimbic, []);
        expect(d.shouldSpeak).toBe(false);
        expect(d.reason).toBe('NO_CONTENT');
    });

    it('should respect speech refractory window', () => {
        const now = Date.now();
        const d = VolitionSystem.shouldSpeak('hello', 1, 0, calmLimbic, [], now - 100, now, false);
        expect(d.shouldSpeak).toBe(false);
        expect(d.reason).toBe('SPEECH_REFRACTORY');
    });

    it('should speak when pressure + silence bonus crosses threshold', () => {
        const d = VolitionSystem.shouldSpeak('hello', 0.6, 100, calmLimbic, [], undefined, undefined, false);
        expect(d.shouldSpeak).toBe(true);
    });

    it('should not speak while sleeping', () => {
        const d = VolitionSystem.shouldSpeak(
            'hello', 1, 100, calmLimbic, [],
            undefined, undefined, false, true
        );
        expect(d.shouldSpeak).toBe(false);
        expect(d.reason).toBe('SLEEPING');
    });
});
