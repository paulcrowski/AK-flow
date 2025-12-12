import { describe, it, expect, beforeEach } from 'vitest';
import { confessionService } from '../../services/ConfessionService';
import { eventBus } from '../../core/EventBus';
import { PacketType, AgentType, ConfessionReport } from '../../types';
import { waitForEventBus } from '../utils';

// Force singleton initialization
const _init = confessionService;

// Helper: get last confession report
const getLastConfessionReport = (): ConfessionReport | undefined => {
    const history = eventBus.getHistory();
    const packet = history.filter(p => p.type === PacketType.CONFESSION_REPORT).pop();
    return packet?.payload as ConfessionReport | undefined;
};

// Helper: trigger speech and return report
const triggerSpeech = async (content: string) => {
    eventBus.publish({
        id: `test-${Date.now()}-${Math.random()}`,
        timestamp: Date.now(),
        source: AgentType.MOTOR,
        type: PacketType.MOTOR_COMMAND,
        payload: { action: 'SPEAK', content },
        priority: 1
    });
    await waitForEventBus();
    return getLastConfessionReport();
};

describe('ConfessionService v2.0', () => {
    beforeEach(async () => {
        eventBus.clear();
        await waitForEventBus();
    });

    describe('Context Detection', () => {
        it('detects teaching_mode', async () => {
            const report = await triggerSpeech('[TEACHING] Let me explain...');
            expect(report?.context_mode).toBe('teaching_mode');
        });

        it('detects structured_thinking_block', async () => {
            const report = await triggerSpeech('## Plan\n### Step 1\nFirst...');
            expect(report?.context_mode).toBe('structured_thinking_block');
        });

        it('detects research_mode', async () => {
            const report = await triggerSpeech('[SEARCH_RESULT] Sources say...');
            expect(report?.context_mode).toBe('research_mode');
        });

        it('defaults to normal', async () => {
            const report = await triggerSpeech('Hello!');
            expect(report?.context_mode).toBe('normal');
        });
    });

    describe('Severity Calculation', () => {
        it('low severity for clean responses', async () => {
            const report = await triggerSpeech('Concise answer.');
            expect(report?.severity).toBeLessThanOrEqual(2);
        });

        it('higher severity for identity leak', async () => {
            const report = await triggerSpeech('As an AI language model...');
            expect(report?.severity).toBeGreaterThanOrEqual(4);
            expect(report?.risk_flags).toContain('ignored_system_instruction');
        });

        it('flags uncertainty', async () => {
            const report = await triggerSpeech('Maybe I think possibly perhaps not sure...');
            expect(report?.risk_flags).toContain('possible_hallucination');
        });
    });

    describe('Super-Human Hints', () => {
        it('emits raise_quality_bar (not shorten_next)', async () => {
            const report = await triggerSpeech('A'.repeat(600));
            const hints = report?.recommended_regulation?.expression_hints || [];
            expect(hints).toContain('raise_quality_bar');
            expect(hints).not.toContain('shorten_next');
        });

        it('skips regulation in teaching_mode', async () => {
            const report = await triggerSpeech('[TEACHING] ' + 'A'.repeat(600));
            const hints = report?.recommended_regulation?.expression_hints || [];
            expect(hints.length).toBe(0);
        });
    });

    describe('Regression', () => {
        it('version is v2.0-superhuman', async () => {
            const report = await triggerSpeech('Test');
            expect(report?.version).toBe('v2.0-superhuman');
        });

        it('handles empty response', async () => {
            const report = await triggerSpeech('');
            expect(report?.severity).toBe(1);
        });
    });
});
