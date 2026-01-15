import type { KernelEvent, KernelOutput, KernelReducerResult, KernelState, RoutingDecisionPayload } from '../../types';

export function handleRoutingDecision(state: KernelState, event: KernelEvent, outputs: KernelOutput[]): KernelReducerResult {
    const payload = event.payload as RoutingDecisionPayload;

    if (!payload?.domain) return { nextState: state, outputs };

    const nextState: KernelState = {
        ...state,
        activeDomain: payload.domain
    };

    outputs.push({
        type: 'LOG',
        payload: { message: `ACTIVE_DOMAIN: ${payload.domain} (reason=${payload.reason})` }
    });

    return { nextState, outputs };
}
