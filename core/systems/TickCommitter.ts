import { eventBus } from '../EventBus';
import { AgentType, PacketType } from '../../types';
import { generateUUID } from '../../utils/uuid';

export type TickCommitBlockReason =
    | 'DEDUPED'
    | 'EMPTY'
    | 'FILTERED_TOO_SHORT';

export interface TickCommitInput {
    agentId: string;
    traceId?: string;
    tickNumber?: number;
    origin: 'autonomous' | 'goal_driven' | 'reactive';
    speechText: string;
    blockReason?: string;
}

export interface TickCommitResult {
    committed: boolean;
    blocked: boolean;
    blockReason?: TickCommitBlockReason | string;
    deduped: boolean;
}

const DEDUPE_WINDOW_MS = 3000;

let totalCommits = 0;
let blockedCommits = 0;
let dedupedCommits = 0;

const lastSpeechByAgent = new Map<string, { signature: string; at: number }>();

function signatureFor(text: string): string {
    return text.trim().replace(/\s+/g, ' ').toLowerCase();
}

export const TickCommitter = {
    commitSpeech(input: TickCommitInput): TickCommitResult {
        const now = Date.now();
        const normalized = signatureFor(input.speechText);

        if (input.blockReason) {
            blockedCommits++;
            totalCommits++;

            this.publishCommitEvent(input, {
                committed: false,
                blocked: true,
                blockReason: input.blockReason,
                deduped: false
            });

            return { committed: false, blocked: true, blockReason: input.blockReason, deduped: false };
        }

        if (!normalized) {
            blockedCommits++;
            totalCommits++;

            this.publishCommitEvent(input, {
                committed: false,
                blocked: true,
                blockReason: 'EMPTY',
                deduped: false
            });

            return { committed: false, blocked: true, blockReason: 'EMPTY', deduped: false };
        }

        const prev = lastSpeechByAgent.get(input.agentId);
        if (prev && prev.signature === normalized && now - prev.at < DEDUPE_WINDOW_MS) {
            dedupedCommits++;
            blockedCommits++;
            totalCommits++;

            this.publishCommitEvent(input, {
                committed: false,
                blocked: true,
                blockReason: 'DEDUPED',
                deduped: true
            });

            return { committed: false, blocked: true, blockReason: 'DEDUPED', deduped: true };
        }

        lastSpeechByAgent.set(input.agentId, { signature: normalized, at: now });
        totalCommits++;

        this.publishCommitEvent(input, {
            committed: true,
            blocked: false,
            deduped: false
        });

        return { committed: true, blocked: false, deduped: false };
    },

    getCounters() {
        return {
            totalCommits,
            blockedCommits,
            dedupedCommits
        };
    },

    resetForTesting() {
        totalCommits = 0;
        blockedCommits = 0;
        dedupedCommits = 0;
        lastSpeechByAgent.clear();
    },

    publishCommitEvent(input: TickCommitInput, result: TickCommitResult) {
        eventBus.publish({
            id: generateUUID(),
            traceId: input.traceId,
            timestamp: Date.now(),
            source: AgentType.CORTEX_FLOW,
            type: PacketType.SYSTEM_ALERT,
            payload: {
                event: 'TICK_COMMIT',
                tickNumber: input.tickNumber,
                origin: input.origin,
                committed: result.committed,
                blocked: result.blocked,
                blockReason: result.blockReason,
                deduped: result.deduped,
                counters: this.getCounters()
            },
            priority: 0.6
        });
    }
};
