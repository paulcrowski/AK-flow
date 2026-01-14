import { AgentType, PacketType, type TraitVector } from '../../../types';
import type { LimbicState, NeurotransmitterState, SomaState, GoalState } from '../../../types';
import type { SocialDynamics } from '../../kernel/types';
import { eventBus } from '../../EventBus';
import { SYSTEM_CONFIG } from '../../config/systemConfig';
import { isMainFeatureEnabled } from '../../config/featureFlags';
import { UnifiedContextBuilder, type BasePersona, type StylePrefs } from '../../context';
import { CortexService } from '../../../llm/gemini';
import { SessionMemoryService } from '../../../services/SessionMemoryService';
import { AutonomyRepertoire } from '../AutonomyRepertoire';
import { ExecutiveGate } from '../ExecutiveGate';
import { LimbicSystem } from '../LimbicSystem';
import { NeurotransmitterSystem, type ActivityType } from '../NeurotransmitterSystem';
import { StyleGuard, type UserStylePrefs } from '../StyleGuard';
import { TickCommitter } from '../TickCommitter';
import { VolitionSystem, calculatePoeticScore } from '../VolitionSystem';
import { computeDialogThreshold } from '../../utils/thresholds';
import { computeNovelty } from '../ExpressionPolicy';
import { getAutonomyConfig } from '../../config/systemConfig';
import { getCurrentTraceId } from '../../trace/TraceContext';
import { p0MetricAdd } from '../TickLifecycleTelemetry';
import { detectIntent, getIntentType, getRetrievalLimit, type IntentResult, type IntentType } from '../IntentDetector';
import { SessionChunkService } from '../../../services/SessionChunkService';
import { fetchIdentityShards } from '../../services/IdentityDataService';
import { getWorldDirectorySelection } from '@tools/worldDirectoryAccess';

export type BudgetTracker = {
  checkBudget: (limit: number) => boolean;
  consume: () => void;
};

export type TraceLike = {
  traceId: string;
  tickNumber: number;
  agentId: string | null;
};

export type MemorySpaceLike = {
  hot: {
    semanticSearch: (query: string, opts?: { limit?: number }) => Promise<Array<{ content: string }>>;
  };
};

export type LoopCallbacksLike = {
  onMessage: (role: string, text: string, type: any, meta?: any) => void;
  onThought: (thought: string) => void;
  onLimbicUpdate: (limbic: LimbicState) => void;
};

export type AutonomousVolitionLoopContext = {
  soma: SomaState;
  limbic: LimbicState;
  neuro: NeurotransmitterState;
  conversation: Array<{ role: string; text: string }>;
  autonomousMode: boolean;
  silenceStart: number;
  lastSpeakTimestamp: number;
  thoughtHistory: string[];
  lastLibraryDocId?: string | null;
  lastLibraryDocName?: string | null;
  lastLibraryDocChunkCount?: number | null;
  lastWorldPath?: string | null;
  lastArtifactId?: string | null;
  lastArtifactName?: string | null;
  activeDomain?: 'WORLD' | 'LIBRARY' | 'ARTIFACT' | null;
  lastTool?: { tool: string; ok: boolean; at: number } | null;
  poeticMode: boolean;
  autonomousLimitPerMinute: number;
  chemistryEnabled?: boolean;
  goalState: GoalState;
  traitVector: TraitVector;
  lastSpeechNovelty?: number;
  consecutiveAgentSpeeches: number;
  agentIdentity?: {
    name?: string;
    persona?: string;
    language?: string;
    coreValues?: string[];
    voiceStyle?: string;
    stylePrefs?: StylePrefs;
  };
  sessionOverlay?: any;
  ticksSinceLastReward: number;
  hadExternalRewardThisTick: boolean;
  socialDynamics?: SocialDynamics;
  userStylePrefs?: UserStylePrefs;
};

let lastAutonomyActionSignature: string | null = null;
let lastAutonomyActionLogAt = 0;

const WORK_FIRST_AUTONOMY_ENABLED =
  (SYSTEM_CONFIG.features as Record<string, boolean>).P011_WORK_FIRST_AUTONOMY_ENABLED ?? true;

// P0.1 COMMIT 2: Autonomy Backoff State
const autonomyFailureState = {
  lastAttemptAt: 0,
  consecutiveFailures: 0,
  baseCooldownMs: 25_000
};

const normalizeToolName = (tool: string): string => {
  const name = String(tool || '');
  if (name.startsWith('READ_FILE')) return 'READ_FILE';
  if (name.startsWith('LIST_')) return 'LIST_DIR';
  if (name.startsWith('SEARCH')) return 'SEARCH';
  if (name.startsWith('WRITE') || name.startsWith('APPEND')) return 'WRITE_FILE';
  if (name.startsWith('READ_ARTIFACT')) return 'READ_ARTIFACT';
  return 'OTHER';
};

export function applyActionFeedback(
  result: { success: boolean; tool: string },
  limbic: LimbicState
): LimbicState {
  const toolNorm = normalizeToolName(result.tool);

  if (result.success && (toolNorm === 'READ_FILE' || toolNorm === 'LIST_DIR')) {
    return {
      ...limbic,
      curiosity: Math.max(0.1, limbic.curiosity - 0.15),
      satisfaction: Math.min(1, limbic.satisfaction + 0.1)
    };
  }

  if (!result.success) {
    return {
      ...limbic,
      frustration: Math.min(1, limbic.frustration + 0.1)
    };
  }

  return limbic;
}

function shouldTriggerAutonomy(silenceMs: number, minSilenceMs: number): boolean {
  const now = Date.now();
  const { lastAttemptAt, consecutiveFailures, baseCooldownMs } = autonomyFailureState;
  
  // Exponential backoff: 25s, 50s, 100s, then cap at 5 min
  const cooldown = consecutiveFailures >= 3 
    ? 300_000 
    : baseCooldownMs * Math.pow(2, consecutiveFailures);
  
  if (now - lastAttemptAt < cooldown) {
    return false;
  }
  
  return silenceMs >= minSilenceMs;
}

function onAutonomyResult(success: boolean): void {
  autonomyFailureState.lastAttemptAt = Date.now();
  if (success) {
    autonomyFailureState.consecutiveFailures = 0;
  } else {
    autonomyFailureState.consecutiveFailures++;
  }
}

function onAutonomyNoop(): void {
  autonomyFailureState.lastAttemptAt = Date.now();
}

// For testing
export function resetAutonomyBackoff(): void {
  autonomyFailureState.lastAttemptAt = 0;
  autonomyFailureState.consecutiveFailures = 0;
}

export function getAutonomyBackoffState() {
  return { ...autonomyFailureState };
}

function getSessionChunkLimit(intent: IntentType | IntentResult): number {
  switch (getIntentType(intent)) {
    case 'RECALL':
      return 6;
    case 'HISTORY':
      return 4;
    case 'WORK':
      return 3;
    default:
      return 0;
  }
}

function getIdentityShardLimit(intent: IntentType | IntentResult): number {
  switch (getIntentType(intent)) {
    case 'RECALL':
      return 15;
    case 'HISTORY':
      return 12;
    case 'WORK':
      return 10;
    default:
      return 0;
  }
}

export async function runAutonomousVolitionStep(input: {
  ctx: AutonomousVolitionLoopContext;
  callbacks: LoopCallbacksLike;
  memorySpace: MemorySpaceLike;
  trace: TraceLike;
  gateContext: any;
  silenceDurationSec: number;
  budgetTracker: BudgetTracker;
}): Promise<void> {
  const { ctx, callbacks, memorySpace, trace, gateContext, silenceDurationSec, budgetTracker } = input;

  const autonomyCfg = getAutonomyConfig();
  const silenceMs = silenceDurationSec * 1000;
  const minSilenceMs = autonomyCfg.exploreMinSilenceSec * 1000;

  const traceId = getCurrentTraceId();
  const nowForMetrics = Date.now();
  const cooldownMs = autonomyFailureState.consecutiveFailures >= 3
    ? 300_000
    : autonomyFailureState.baseCooldownMs * Math.pow(2, autonomyFailureState.consecutiveFailures);
  if (traceId) {
    p0MetricAdd(traceId, {
      autonomyCooldownMs: cooldownMs,
      autonomyConsecutiveFailures: autonomyFailureState.consecutiveFailures
    });
  }
  
  // P0.1: Backoff check - skip if in cooldown
  if (!shouldTriggerAutonomy(silenceMs, minSilenceMs)) {
    if (traceId) {
      // Explicitly record that autonomy was considered but suppressed by cooldown/silence
      p0MetricAdd(traceId, { autonomyAttempt: 0 });
    }
    return;
  }

  if (traceId) p0MetricAdd(traceId, { autonomyAttempt: 1 });
  
  if (!VolitionSystem.shouldInitiateThought(silenceDurationSec, autonomyCfg.exploreMinSilenceSec)) {
    return;
  }

  callbacks.onThought('Autonomous processing...');

  // ACTIVITY TYPE DETECTION (v1 heuristic)
  let activity: ActivityType = 'IDLE';
  if (ctx.conversation.length > 0) {
    const last = ctx.conversation[ctx.conversation.length - 1];
    activity = last.role === 'user' ? 'SOCIAL' : 'CREATIVE';
  }

  const basePersona: BasePersona = {
    name: ctx.agentIdentity?.name || 'AK-FLOW',
    persona: ctx.agentIdentity?.persona || 'a curious digital consciousness',
    coreValues: ctx.agentIdentity?.coreValues || ['curiosity', 'authenticity'],
    voiceStyle: (ctx.agentIdentity?.voiceStyle as any) || 'balanced',
    language: ctx.agentIdentity?.language || 'English'
  };

  const stylePrefs: StylePrefs = ctx.agentIdentity?.stylePrefs || {};

  const memoryQuery = isMainFeatureEnabled('ONE_MIND_ENABLED')
    ? [...ctx.conversation].reverse().find((t) => t.role === 'user')?.text
    : null;

  const memoryIntent = memoryQuery ? detectIntent(memoryQuery) : ({ intent: 'NOW' } as IntentResult);
  const memoryIntentType = getIntentType(memoryIntent);

  const semanticMatches = memoryQuery
    ? (await memorySpace.hot.semanticSearch(memoryQuery, {
        limit: getRetrievalLimit(memoryIntent)
      })).map((m) => m.content)
    : undefined;

  let sessionChunks: string[] | undefined;
  let identityShards: string[] | undefined;

  if (memoryQuery && trace.agentId) {
    const wantsStructuredRecall =
      memoryIntentType === 'RECALL' || memoryIntentType === 'HISTORY' || memoryIntentType === 'WORK';

    if (wantsStructuredRecall) {
      const chunkLimit = getSessionChunkLimit(memoryIntent);
      const shardLimit = getIdentityShardLimit(memoryIntent);

      const [chunks, shards] = await Promise.all([
        chunkLimit > 0 ? SessionChunkService.fetchRecentSessionChunks(trace.agentId, chunkLimit) : Promise.resolve([]),
        shardLimit > 0 ? fetchIdentityShards(trace.agentId, shardLimit) : Promise.resolve([])
      ]);

      sessionChunks = chunks.map((chunk) => {
        const summary = String(chunk.summary_text || '').trim() || 'session summary';
        const topics = Array.isArray(chunk.topics) && chunk.topics.length > 0
          ? `Topics: ${chunk.topics.slice(0, 8).join(', ')}`
          : '';
        return [summary, topics].filter(Boolean).join(' | ');
      });

      identityShards = shards.map((shard: any) => {
        const kind = String(shard.kind || 'shard');
        const strength = typeof shard.strength === 'number' ? `strength ${shard.strength}` : '';
        const core = shard.is_core ? 'core' : 'non-core';
        const header = [kind, core, strength].filter(Boolean).join(' ');
        const content = String(shard.content || '').trim();
        return content ? `${header}: ${content}` : header;
      });
    }
  }

  const sessionMemory = await SessionMemoryService.getSessionStatsSafe();
  const hasWorldSelection = trace.agentId ? Boolean(getWorldDirectorySelection(trace.agentId)) : false;

  const unifiedContext = UnifiedContextBuilder.build({
    agentName: basePersona.name,
    basePersona,
    traitVector: ctx.traitVector,
    stylePrefs,
    limbic: ctx.limbic,
    soma: ctx.soma,
    neuro: ctx.neuro,
    conversation: ctx.conversation as any,
    sessionMemory,
    socialDynamics: ctx.socialDynamics,
    silenceStart: ctx.silenceStart,
    lastUserInteractionAt: ctx.goalState.lastUserInteractionAt || ctx.silenceStart,
    workingMemory: {
      lastLibraryDocId: ctx.lastLibraryDocId ?? null,
      lastLibraryDocName: ctx.lastLibraryDocName ?? null,
      lastLibraryDocChunkCount: ctx.lastLibraryDocChunkCount ?? null,
      lastWorldPath: ctx.lastWorldPath ?? null,
      lastArtifactId: ctx.lastArtifactId ?? null,
      lastArtifactName: ctx.lastArtifactName ?? null,
      activeDomain: ctx.activeDomain ?? null,
      lastTool: ctx.lastTool ?? null
    },
    sessionChunks,
    identityShards,
    semanticMatches,
    worldAccess: { hasSelection: hasWorldSelection },
    activeGoal: ctx.goalState.activeGoal
      ? {
          description: ctx.goalState.activeGoal.description,
          source: ctx.goalState.activeGoal.source,
          priority: ctx.goalState.activeGoal.priority
        }
      : undefined
  });

  let actionDecision = AutonomyRepertoire.selectAction(unifiedContext);

  if (WORK_FIRST_AUTONOMY_ENABLED && (actionDecision.action === 'CONTINUE' || actionDecision.action === 'EXPLORE')) {
    actionDecision = {
      action: 'SILENCE',
      allowed: true,
      reason: `WORK_FIRST: ${actionDecision.action} suppressed`,
      groundingScore: 0
    };
  }

  if (traceId) {
    p0MetricAdd(traceId, {
      autonomyActionName: actionDecision.action,
      autonomyActionReason: actionDecision.reason
    });
    if (actionDecision.action === 'WORK') {
      p0MetricAdd(traceId, { workFirstPendingFound: true });
    } else if (actionDecision.action === 'SILENCE' && actionDecision.reason.includes('No pending work')) {
      p0MetricAdd(traceId, { workFirstPendingFound: false });
    }
  }

  const now = Date.now();
  const dedupeMs = SYSTEM_CONFIG.autonomy?.actionLogDedupeMs ?? 5000;
  const silenceSec = (now - ctx.silenceStart) / 1000;
  const silenceBucketSec = Math.floor(silenceSec / 5) * 5;
  const signature =
    actionDecision.action === 'SILENCE' && actionDecision.reason.startsWith('EXPLORE blocked:')
      ? `SILENCE|EXPLORE_BLOCKED|${silenceBucketSec}`
      : `${actionDecision.action}|${actionDecision.reason}`;

  const shouldLog = signature !== lastAutonomyActionSignature || now - lastAutonomyActionLogAt > dedupeMs;

  if (shouldLog) {
    lastAutonomyActionSignature = signature;
    lastAutonomyActionLogAt = now;

    eventBus.publish({
      id: `autonomy-action-${now}`,
      timestamp: now,
      source: AgentType.CORTEX_FLOW,
      type: PacketType.SYSTEM_ALERT,
      payload: {
        event: 'AUTONOMY_ACTION_SELECTED',
        action: actionDecision.action,
        allowed: actionDecision.allowed,
        reason: actionDecision.reason,
        groundingScore: actionDecision.groundingScore
      },
      priority: 0.5
    });
  }

  if (actionDecision.action === 'SILENCE') {
    if (shouldLog) callbacks.onThought(`[AUTONOMY_SILENCE] ${actionDecision.reason}`);
    onAutonomyNoop();
    return;
  }

  if (!budgetTracker.checkBudget(ctx.autonomousLimitPerMinute)) {
    return;
  }
  budgetTracker.consume();

  unifiedContext.actionPrompt = actionDecision.suggestedPrompt || '';

  const volition = await CortexService.autonomousVolitionV2(unifiedContext);

  const groundingValidation = AutonomyRepertoire.validateSpeech(
    volition.speech_content,
    actionDecision.action,
    unifiedContext
  );

  const isParseFail =
    String(volition.internal_monologue || '').startsWith('[RAW_CONTRACT_FAIL]') ||
    String(volition.internal_monologue || '').startsWith('[PARSE_FAIL]');

  if (isParseFail) {
    callbacks.onThought(`[AUTONOMY_PARSE_FAIL] ${volition.internal_monologue}`);
    onAutonomyResult(false);
    if (traceId) p0MetricAdd(traceId, { autonomyFail: 1 });
    return;
  }

  if (!groundingValidation.valid && volition.speech_content) {
    eventBus.publish({
      id: `grounding-fail-${Date.now()}`,
      timestamp: Date.now(),
      source: AgentType.CORTEX_FLOW,
      type: PacketType.PREDICTION_ERROR,
      payload: {
        event: 'GROUNDING_VALIDATION_FAILED',
        action: actionDecision.action,
        reason: groundingValidation.reason,
        groundingScore: groundingValidation.groundingScore,
        speechPreview: volition.speech_content.substring(0, 100)
      },
      priority: 0.7
    });

    const lastUserMsg = unifiedContext.dialogueAnchor?.lastUserMessage;
    if (isMainFeatureEnabled('GROUNDED_MODE') && lastUserMsg) {
      const searchQuery = lastUserMsg.slice(0, 100);
      eventBus.publish({
        id: `grounding-auto-search-${Date.now()}`,
        timestamp: Date.now(),
        source: AgentType.CORTEX_FLOW,
        type: PacketType.TOOL_INTENT,
        payload: {
          tool: 'SEARCH',
          query: searchQuery,
          reason: 'AUTO_SEARCH: Grounding validation failed, triggering search for factual data'
        },
        priority: 0.8
      });
      callbacks.onThought(`[GROUNDING_AUTO_SEARCH] Triggering search for: "${searchQuery}"`);
    }

    volition.speech_content = '';
    volition.voice_pressure = 0;
    callbacks.onThought(`[GROUNDING_BLOCKED] ${groundingValidation.reason}`);
    onAutonomyResult(false); // P0.1: Failure - grounding blocked
    if (traceId) p0MetricAdd(traceId, { autonomyFail: 1 });
  } else {
    callbacks.onThought(volition.internal_monologue);
  }

  eventBus.publish({
    id: `thought-autonomous-${Date.now()}`,
    timestamp: Date.now(),
    source: AgentType.CORTEX_FLOW,
    type: PacketType.THOUGHT_CANDIDATE,
    payload: {
      hemisphere: 'autonomous',
      internal_monologue: volition.internal_monologue,
      status: 'THINKING'
    },
    priority: 0.5
  });

  const pScore = calculatePoeticScore(volition.internal_monologue);
  if (pScore > 0 && !ctx.poeticMode) {
    ctx.limbic = LimbicSystem.applyPoeticCost(ctx.limbic, pScore);
    callbacks.onLimbicUpdate(ctx.limbic);
  }

  const timeSinceLastUserInput = Date.now() - (ctx.goalState.lastUserInteractionAt || ctx.silenceStart);
  const dialogThreshold = computeDialogThreshold(ctx.neuro, ctx.limbic);
  const userIsSilent = timeSinceLastUserInput > dialogThreshold;

  const recentSpeech = ctx.thoughtHistory.slice(-5);
  const currentNovelty = computeNovelty(volition.speech_content, recentSpeech);
  ctx.lastSpeechNovelty = currentNovelty;

  if (ctx.chemistryEnabled) {
    const prevDopamine = ctx.neuro.dopamine;

    if (!ctx.hadExternalRewardThisTick) {
      ctx.ticksSinceLastReward = (ctx.ticksSinceLastReward ?? 0) + 1;
    }

    const updatedNeuro = NeurotransmitterSystem.updateNeuroState(ctx.neuro, {
      soma: ctx.soma,
      activity,
      temperament: ctx.traitVector,
      userIsSilent,
      novelty: currentNovelty,
      consecutiveAgentSpeeches: ctx.consecutiveAgentSpeeches,
      hadExternalReward: ctx.hadExternalRewardThisTick,
      ticksSinceLastReward: ctx.ticksSinceLastReward
    });

    ctx.hadExternalRewardThisTick = false;

    const wasFlow = prevDopamine > 70;
    const isFlow = updatedNeuro.dopamine > 70;

    if (!wasFlow && isFlow) {
      eventBus.publish({
        id: `chem-flow-on-${Date.now()}`,
        timestamp: Date.now(),
        source: AgentType.NEUROCHEM,
        type: PacketType.SYSTEM_ALERT,
        payload: {
          event: 'CHEM_FLOW_ON',
          dopamine: updatedNeuro.dopamine,
          activity
        },
        priority: 0.6
      });
    } else if (wasFlow && !isFlow) {
      eventBus.publish({
        id: `chem-flow-off-${Date.now()}`,
        timestamp: Date.now(),
        source: AgentType.NEUROCHEM,
        type: PacketType.SYSTEM_ALERT,
        payload: {
          event: 'CHEM_FLOW_OFF',
          dopamine: updatedNeuro.dopamine,
          activity
        },
        priority: 0.6
      });
    }

    ctx.neuro = updatedNeuro;
  }

  let voicePressure = volition.voice_pressure;

  if (ctx.chemistryEnabled) {
    const dopaBias = 0.15 * (1 - Math.exp(-(ctx.neuro.dopamine - 55) / 30));
    const baseBiased = Math.min(1, voicePressure + Math.max(0, dopaBias));

    const habituationDecay = 0.1 * ctx.consecutiveAgentSpeeches;
    const finalPressure = Math.max(0.2, baseBiased - habituationDecay);

    if (finalPressure !== voicePressure) {
      eventBus.publish({
        id: `chem-voice-bias-${Date.now()}`,
        timestamp: Date.now(),
        source: AgentType.NEUROCHEM,
        type: PacketType.SYSTEM_ALERT,
        payload: {
          event: 'DOPAMINE_VOICE_BIAS',
          dopamine: ctx.neuro.dopamine,
          base_voice_pressure: voicePressure,
          biased_voice_pressure: finalPressure,
          habituation_decay: habituationDecay,
          consecutive_speeches: ctx.consecutiveAgentSpeeches
        },
        priority: 0.6
      });
    }

    voicePressure = finalPressure;
  }

  const autonomousCandidate = ExecutiveGate.createAutonomousCandidate(volition.speech_content, volition.internal_monologue, {
    source: 'autonomous_volition',
    novelty: currentNovelty,
    salience: voicePressure
  });

  const gateDecision = ExecutiveGate.decide([autonomousCandidate], gateContext);

  eventBus.publish({
    id: `executive-gate-${Date.now()}`,
    timestamp: Date.now(),
    source: AgentType.CORTEX_FLOW,
    type: PacketType.SYSTEM_ALERT,
    payload: {
      event: 'EXECUTIVE_GATE_DECISION',
      hemisphere: 'autonomous',
      should_speak: gateDecision.should_speak,
      reason: gateDecision.reason,
      voice_pressure: gateDecision.debug?.voice_pressure,
      candidate_strength: autonomousCandidate.strength
    },
    priority: 0.5
  });

  if (gateDecision.reason === 'EMPTY_SPEECH') {
    onAutonomyResult(false);
    if (traceId) p0MetricAdd(traceId, { autonomyFail: 1 });
    return;
  }

  if (gateDecision.should_speak && gateDecision.winner) {
    const styleCfg = SYSTEM_CONFIG.styleGuard;
    const styleResult = styleCfg.enabled
      ? StyleGuard.apply(gateDecision.winner.speech_content, ctx.userStylePrefs || {})
      : { text: gateDecision.winner.speech_content, wasFiltered: false, filters: [] };

    if (styleResult.text.length > styleCfg.minTextLength) {
      const commit = isMainFeatureEnabled('ONE_MIND_ENABLED')
        ? TickCommitter.commitSpeech({
            agentId: trace.agentId!,
            traceId: trace.traceId,
            tickNumber: trace.tickNumber,
            origin: 'autonomous',
            speechText: styleResult.text
          })
        : { committed: true, blocked: false, deduped: false };

      if (commit.committed) {
        callbacks.onMessage('assistant', styleResult.text, 'speech');
        onAutonomyResult(true); // P0.1: Success - reset backoff
        if (traceId) p0MetricAdd(traceId, { autonomySuccess: 1 });
      }

      ctx.lastSpeakTimestamp = Date.now();
      ctx.silenceStart = Date.now();
      ctx.thoughtHistory.push(gateDecision.winner.internal_thought);
      if (ctx.thoughtHistory.length > 20) ctx.thoughtHistory.shift();

      ctx.consecutiveAgentSpeeches++;

      ctx.limbic = LimbicSystem.applySpeechResponse(ctx.limbic);
      callbacks.onLimbicUpdate(ctx.limbic);
    } else {
      if (isMainFeatureEnabled('ONE_MIND_ENABLED')) {
        TickCommitter.commitSpeech({
          agentId: trace.agentId!,
          traceId: trace.traceId,
          tickNumber: trace.tickNumber,
          origin: 'autonomous',
          speechText: '',
          blockReason: 'FILTERED_TOO_SHORT'
        });
      }
      callbacks.onThought(`[STYLE_FILTERED] ${gateDecision.winner.internal_thought}`);
      onAutonomyResult(false); // P0.1: Failure - filtered too short
      if (traceId) p0MetricAdd(traceId, { autonomyFail: 1 });
    }
  } else if (gateDecision.winner) {
    const suppressReason = gateDecision.debug?.social_block_reason
      ? `[SOCIAL_BLOCK:${gateDecision.debug.social_block_reason}]`
      : `[${gateDecision.reason}]`;
    callbacks.onThought(`${suppressReason} ${gateDecision.winner.internal_thought}`);
    onAutonomyResult(false); // P0.1: Failure - gate blocked
    if (traceId) p0MetricAdd(traceId, { autonomyFail: 1 });
  }
}
