import { eventBus } from '../EventBus';
import { AgentType, PacketType } from '../../types';
import { isMainFeatureEnabled } from '../config/featureFlags';

export type ThinkMode = 'reactive' | 'goal_driven' | 'autonomous' | 'idle';

type P0MetricState = {
    artifactResolveAttempt: number;
    artifactResolveSuccess: number;
    artifactResolveFail: number;
    actionFirstTriggered: number;
    actionType: string | null;
    autonomyAttempt: number;
    autonomySuccess: number;
    autonomyFail: number;
    autonomyCooldownMs: number;
    autonomyConsecutiveFailures: number;
    workFirstPendingFound: boolean | null;
    parseFailCount: number;
};

const getP0MetricStore = (() => {
    let store: Map<string, { tickNumber: number; state: P0MetricState }> | null = null;
    return () => {
        if (!store) {
            store = new Map();
        }
        return store;
    };
})();

function emptyP0MetricState(): P0MetricState {
    return {
        artifactResolveAttempt: 0,
        artifactResolveSuccess: 0,
        artifactResolveFail: 0,
        actionFirstTriggered: 0,
        actionType: null,
        autonomyAttempt: 0,
        autonomySuccess: 0,
        autonomyFail: 0,
        autonomyCooldownMs: 0,
        autonomyConsecutiveFailures: 0,
        workFirstPendingFound: null,
        parseFailCount: 0
    };
}

export function p0MetricStartTick(traceId: string, tickNumber: number): void {
    if (!traceId) return;
    const store = getP0MetricStore();
    store.set(traceId, { tickNumber, state: emptyP0MetricState() });
}

export function p0MetricAdd(traceId: string, patch: Partial<P0MetricState>): void {
    if (!traceId) return;
    const store = getP0MetricStore();
    const cur = store.get(traceId);
    if (!cur) return;

    const s = cur.state;
    cur.state = {
        ...s,
        ...patch,
        artifactResolveAttempt: s.artifactResolveAttempt + (patch.artifactResolveAttempt ?? 0),
        artifactResolveSuccess: s.artifactResolveSuccess + (patch.artifactResolveSuccess ?? 0),
        artifactResolveFail: s.artifactResolveFail + (patch.artifactResolveFail ?? 0),
        actionFirstTriggered: s.actionFirstTriggered + (patch.actionFirstTriggered ?? 0),
        autonomyAttempt: s.autonomyAttempt + (patch.autonomyAttempt ?? 0),
        autonomySuccess: s.autonomySuccess + (patch.autonomySuccess ?? 0),
        autonomyFail: s.autonomyFail + (patch.autonomyFail ?? 0),
        parseFailCount: s.parseFailCount + (patch.parseFailCount ?? 0)
    };
    store.set(traceId, cur);
}

export function publishP0Metric(traceId: string, endedAt: number): void {
    const store = getP0MetricStore();
    const cur = traceId ? store.get(traceId) : undefined;
    if (!cur) return;

    publishTickPacket({
        id: `p0-metric-${cur.tickNumber}-${endedAt}`,
        traceId,
        timestamp: endedAt,
        payload: {
            event: 'P0_METRIC',
            tickNumber: cur.tickNumber,
            ...cur.state
        },
        priority: 0.7
    });
}

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

    if (isMainFeatureEnabled('ONE_MIND_ENABLED')) {
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
