import { AgentType, PacketType, type Goal } from '../../../types';
import { eventBus } from '../../EventBus';
import { ExecutiveGate } from '../ExecutiveGate';
import { TickCommitter } from '../TickCommitter';
import { CortexSystem } from '../CortexSystem';
import { isMainFeatureEnabled } from '../../config/featureFlags';

export type TraceLike = {
  traceId: string;
  tickNumber: number;
  agentId: string | null;
};

export type GoalDrivenCallbacksLike = {
  onMessage: (role: string, text: string, type: any, meta?: any) => void;
  onThought: (thought: string) => void;
};

export async function runGoalDrivenStep(input: {
  ctx: any;
  goal: Goal;
  callbacks: GoalDrivenCallbacksLike;
  gateContext: any;
  trace: TraceLike;
}): Promise<{ executedAt: number; shouldSkipAutonomy: boolean }> {
  const { ctx, goal, callbacks, gateContext, trace } = input;

  const result = await CortexSystem.pursueGoal(goal, {
    limbic: ctx.limbic,
    soma: ctx.soma,
    conversation: ctx.conversation,
    traitVector: ctx.traitVector,
    neuroState: ctx.neuro,
    identity: ctx.agentIdentity,
    sessionOverlay: ctx.sessionOverlay
  });

  const goalCandidate = ExecutiveGate.createGoalCandidate(
    result.responseText,
    result.internalThought || '',
    goal.id,
    { source: goal.source, salience: goal.priority }
  );

  const goalGateDecision = ExecutiveGate.decide([goalCandidate], gateContext);

  eventBus.publish({
    id: `thought-goal-${Date.now()}`,
    timestamp: Date.now(),
    source: AgentType.CORTEX_FLOW,
    type: PacketType.THOUGHT_CANDIDATE,
    payload: {
      hemisphere: 'goal_driven',
      goal_id: goal.id,
      internal_monologue: result.internalThought || '',
      status: 'THINKING'
    },
    priority: 0.5
  });

  if (result.internalThought) {
    callbacks.onMessage('assistant', result.internalThought, 'thought');
  }

  if (goalGateDecision.should_speak && goalGateDecision.winner) {
    const speechText = goalGateDecision.winner.speech_content;

    const commit = isMainFeatureEnabled('ONE_MIND_ENABLED')
      ? TickCommitter.commitSpeech({
          agentId: trace.agentId!,
          traceId: trace.traceId,
          tickNumber: trace.tickNumber,
          origin: 'goal_driven',
          speechText
        })
      : { committed: true, blocked: false, deduped: false };

    if (commit.committed) {
      callbacks.onMessage('assistant', speechText, 'speech', {
        knowledgeSource: result.knowledgeSource,
        evidenceSource: result.evidenceSource,
        generator: result.generator
      });
    }
  } else {
    callbacks.onThought(`[GOAL SUPPRESSED] ${result.responseText?.slice(0, 50)}...`);
  }

  const executedAt = Date.now();

  eventBus.publish({
    id: `goal-executed-${executedAt}`,
    timestamp: executedAt,
    source: AgentType.CORTEX_FLOW,
    type: PacketType.SYSTEM_ALERT,
    payload: {
      event: 'GOAL_EXECUTED',
      goal: {
        id: goal.id,
        source: goal.source,
        description: goal.description,
        priority: goal.priority
      }
    },
    priority: 0.7
  });

  ctx.goalState.activeGoal = null;
  ctx.lastSpeakTimestamp = executedAt;
  ctx.silenceStart = executedAt;

  return { executedAt, shouldSkipAutonomy: true };
}
