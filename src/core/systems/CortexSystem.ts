import type { Goal } from '../../types';

import type {
    AgentIdentityContext as AgentIdentityContextT,
    ConversationTurn,
    GoalPursuitResult as GoalPursuitResultT,
    GoalPursuitState as GoalPursuitStateT,
    ProcessInputParams as ProcessInputParamsT,
    ProcessResult as ProcessResultT,
    SessionOverlay as SessionOverlayT
} from './cortex/types';

import { processUserMessage as processUserMessageImpl } from './cortex/processUserMessage';
import { pursueGoal as pursueGoalImpl } from './cortex/goalPursuit';
import { performDeepResearch as performDeepResearchImpl, type DeepResearchRuntime } from './cortex/deepResearch';

export type { ConversationTurn } from './cortex/types';

export namespace CortexSystem {
    export type AgentIdentityContext = AgentIdentityContextT;
    export type SessionOverlay = SessionOverlayT;
    export type ProcessInputParams = ProcessInputParamsT;
    export type ProcessResult = ProcessResultT;
    export type GoalPursuitState = GoalPursuitStateT;
    export type GoalPursuitResult = GoalPursuitResultT;

    export async function processUserMessage(params: ProcessInputParamsT): Promise<ProcessResultT> {
        return processUserMessageImpl(params);
    }

    export async function pursueGoal(goal: Goal, state: GoalPursuitStateT): Promise<GoalPursuitResultT> {
        return pursueGoalImpl(goal, state);
    }

    export async function performDeepResearch(topic: string, context: string, runtime?: DeepResearchRuntime) {
        return performDeepResearchImpl(topic, context, runtime);
    }
}
