import { CortexService } from '../../../services/gemini';
import { MemoryService } from '../../../services/supabase';
import { AgentType, PacketType, type Goal } from '../../../types';
import { generateUUID } from '../../../utils/uuid';
import { decideExpression, computeNovelty, estimateSocialCost } from '../ExpressionPolicy';
import { eventBus } from '../../EventBus';
import { isMainFeatureEnabled } from '../../config/featureFlags';
import { DEFAULT_IDENTITY, buildIdentityBlock } from './identity';
import type { AgentIdentityContext, ConversationTurn, GoalPursuitResult, GoalPursuitState, SessionOverlay } from './types';

function buildGoalPrompt(params: {
  goal: Goal;
  limbic: any;
  soma: any;
  conversationHistory: ConversationTurn[];
  identity?: AgentIdentityContext;
  sessionOverlay?: SessionOverlay;
}): string {
  const { goal, limbic, soma, conversationHistory, identity, sessionOverlay } = params;

  const agentIdentity = identity || DEFAULT_IDENTITY;

  const recentChat = conversationHistory
    .slice(-8)
    .map((t) => `${t.role.toUpperCase()}: ${t.text}`)
    .join('\n');

  const identityBlock = buildIdentityBlock(agentIdentity, sessionOverlay);

  return `
            ${identityBlock}

            CURRENT STATE:
            - Limbic: Fear=${limbic.fear.toFixed(2)}, Curiosity=${limbic.curiosity.toFixed(2)}, Satisfaction=${limbic.satisfaction.toFixed(2)}
            - Soma: Energy=${soma.energy}, Load=${soma.cognitiveLoad}

            ACTIVE GOAL (${goal.source.toUpperCase()}):
            - Description: ${goal.description}
            - Priority: ${goal.priority.toFixed(2)}

            RECENT CONVERSATION (context for this goal):
            ${recentChat}

            TASK: As ${agentIdentity.name}, execute exactly ONE short, clear utterance to advance this goal.
            - Stay true to your persona and values.
            - If goal source is 'empathy': briefly check in on the user's state and connect to previous context.
            - If goal source is 'curiosity': propose one new thread to explore that is relevant to the prior conversation.
            - Do not ask multiple questions at once.

            OUTPUT JSON format with NO markdown blocks, just raw JSON:
            {
                "responseText": "the message to the user (one turn)",
                "internalThought": "your internal monologue about how this serves the goal"
            }
        `;
}

export async function pursueGoal(goal: Goal, state: GoalPursuitState): Promise<GoalPursuitResult> {
  const recentHistory = state.conversation.slice(-12);

  const prompt = buildGoalPrompt({
    goal,
    limbic: state.limbic,
    soma: state.soma,
    conversationHistory: recentHistory,
    identity: state.identity,
    sessionOverlay: state.sessionOverlay
  });

  const cortexResult = await CortexService.structuredDialogue(prompt);

  const assistantSpeechHistory = state.conversation
    .filter((m: any) => m.role === 'assistant' && m.type === 'speech')
    .map((m: any) => m.text)
    .slice(-3);

  const novelty = computeNovelty((cortexResult as any).responseText, assistantSpeechHistory);
  const socialCost = estimateSocialCost((cortexResult as any).responseText);

  const decision = decideExpression(
    {
      internalThought: (cortexResult as any).internalThought,
      responseText: (cortexResult as any).responseText,
      goalAlignment: goal.priority,
      noveltyScore: novelty,
      socialCost,
      context: 'GOAL_EXECUTED'
    },
    state.traitVector,
    state.soma,
    state.neuroState,
    false
  );

  console.log('[GOAL_EXECUTED ExpressionPolicy]', {
    goal: goal.description,
    novelty,
    socialCost,
    say: decision.say,
    baseScore: decision.baseScore,
    threshold: decision.threshold,
    originalLength: (cortexResult as any).responseText.length,
    finalLength: decision.text.length
  });

  eventBus.publish({
    id: generateUUID(),
    timestamp: Date.now(),
    source: AgentType.CORTEX_FLOW,
    type: PacketType.SYSTEM_ALERT,
    payload: {
      event: 'EXPRESSION_POLICY_DECISION',
      context: 'GOAL_EXECUTED',
      goal: goal.description,
      novelty,
      socialCost,
      say: decision.say,
      baseScore: decision.baseScore,
      threshold: decision.threshold,
      originalLength: (cortexResult as any).responseText.length,
      finalLength: decision.text.length
    },
    priority: 0.4
  });

  await MemoryService.storeMemory({
    content: `GOAL EXECUTION [${goal.source}]: ${goal.description}\nAgent: ${decision.text}`,
    emotionalContext: state.limbic,
    timestamp: new Date().toISOString(),
    id: generateUUID()
  });

  const hasToolTag = /\[(SEARCH|VISUALIZE):/i.test(String(decision.text || ''));
  const strictGrounded = isMainFeatureEnabled('GROUNDED_MODE');
  const knowledgeSource: GoalPursuitResult['knowledgeSource'] = hasToolTag ? 'tool' : strictGrounded ? 'system' : 'llm';
  const evidenceSource: GoalPursuitResult['evidenceSource'] = hasToolTag ? 'tool' : 'system';
  const generator: GoalPursuitResult['generator'] = 'llm';

  return {
    responseText: decision.text,
    internalThought: (cortexResult as any).internalThought,
    knowledgeSource,
    evidenceSource,
    generator
  };
}
