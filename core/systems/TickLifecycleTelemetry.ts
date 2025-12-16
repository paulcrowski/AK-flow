import { eventBus } from '../EventBus';
import { AgentType, PacketType } from '../../types';
import { isFeatureEnabled } from '../config/featureFlags';

export type ThinkMode = 'reactive' | 'goal_driven' | 'autonomous' | 'idle';

function publishTickPacket(packet: {
    id: string;
    traceId: string;
    timestamp: number;
    payload: Record<string, unknown>;
    priority: number;
}): void {
    const base = {
        id: packet.id,
        traceId: packet.traceId,
        timestamp: packet.timestamp,
        source: AgentType.CORTEX_FLOW,
        type: PacketType.SYSTEM_ALERT,
        payload: packet.payload,
        priority: packet.priority
    };

    if (isFeatureEnabled('USE_ONE_MIND_PIPELINE')) {
        eventBus.publishSync(base);
        return;
    }

    eventBus.publish(base);
}

export function publishTickStart(traceId: string, tickNumber: number, startedAt: number): void {
    publishTickPacket({
        id: `tick-start-${tickNumber}-${startedAt}`,
        traceId,
        timestamp: startedAt,
        payload: {
            event: 'TICK_START',
            tickNumber
        },
        priority: 1
    });
}

export function publishTickSkipped(traceId: string, tickNumber: number, timestamp: number, reason: string): void {
    publishTickPacket({
        id: `tick-skipped-${tickNumber}-${timestamp}`,
        traceId,
        timestamp,
        payload: {
            event: 'TICK_SKIPPED',
            tickNumber,
            reason
        },
        priority: 1
    });
}

export function publishThinkModeSelected(traceId: string, tickNumber: number, timestamp: number, mode: ThinkMode): void {
    publishTickPacket({
        id: `think-mode-${tickNumber}-${timestamp}`,
        traceId,
        timestamp,
        payload: {
            event: 'THINK_MODE_SELECTED',
            tickNumber,
            mode
        },
        priority: 0.6
    });
}

export function publishTickEnd(
    traceId: string,
    tickNumber: number,
    endedAt: number,
    durationMs: number,
    skipped: boolean,
    skipReason: string | null
): void {
    publishTickPacket({
        id: `tick-end-${tickNumber}-${endedAt}`,
        traceId,
        timestamp: endedAt,
        payload: {
            event: 'TICK_END',
            tickNumber,
            durationMs,
            ...(skipped ? { skipped: true, skipReason } : {})
        },
        priority: 1
    });
}
