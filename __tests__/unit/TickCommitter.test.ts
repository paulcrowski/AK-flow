import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TickCommitter } from '../../core/systems/TickCommitter';

describe('TickCommitter', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2025-01-01T00:00:00.000Z'));
        TickCommitter.resetForTesting();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('should commit non-empty speech', () => {
        const r = TickCommitter.commitSpeech({
            agentId: 'a1',
            traceId: 't1',
            tickNumber: 1,
            origin: 'autonomous',
            speechText: 'Hello world'
        });

        expect(r.committed).toBe(true);
        expect(r.blocked).toBe(false);
    });

    it('should block empty speech', () => {
        const r = TickCommitter.commitSpeech({
            agentId: 'a1',
            traceId: 't1',
            tickNumber: 1,
            origin: 'autonomous',
            speechText: '   '
        });

        expect(r.committed).toBe(false);
        expect(r.blocked).toBe(true);
        expect(r.blockReason).toBe('EMPTY');
    });

    it('should dedupe identical speech within window', () => {
        const r1 = TickCommitter.commitSpeech({
            agentId: 'a1',
            origin: 'autonomous',
            speechText: 'Same text'
        });
        expect(r1.committed).toBe(true);

        vi.advanceTimersByTime(1000);

        const r2 = TickCommitter.commitSpeech({
            agentId: 'a1',
            origin: 'autonomous',
            speechText: 'Same   text\n'
        });

        expect(r2.committed).toBe(false);
        expect(r2.blocked).toBe(true);
        expect(r2.deduped).toBe(true);
        expect(r2.blockReason).toBe('DEDUPED');
    });

    it('should allow same speech after window', () => {
        TickCommitter.commitSpeech({
            agentId: 'a1',
            origin: 'autonomous',
            speechText: 'Same text'
        });

        vi.advanceTimersByTime(4000);

        const r2 = TickCommitter.commitSpeech({
            agentId: 'a1',
            origin: 'autonomous',
            speechText: 'Same text'
        });

        expect(r2.committed).toBe(true);
    });

    it('should honor explicit blockReason override', () => {
        const r = TickCommitter.commitSpeech({
            agentId: 'a1',
            origin: 'autonomous',
            speechText: 'Hello',
            blockReason: 'FILTERED_TOO_SHORT'
        });

        expect(r.committed).toBe(false);
        expect(r.blocked).toBe(true);
        expect(r.blockReason).toBe('FILTERED_TOO_SHORT');
    });

    it('should support reactive origin', () => {
        const r = TickCommitter.commitSpeech({
            agentId: 'a1',
            traceId: 't1',
            tickNumber: 1,
            origin: 'reactive',
            speechText: 'Hello user'
        });

        expect(r.committed).toBe(true);
        expect(r.blocked).toBe(false);
    });
});
