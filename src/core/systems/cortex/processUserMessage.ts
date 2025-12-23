import { CortexService } from '../../../llm/gemini';
import { MemoryService, getCurrentAgentId } from '../../../services/supabase';
import { EpisodicMemoryService } from '../../../services/EpisodicMemoryService';
import { SessionMemoryService } from '../../../services/SessionMemoryService';
import { AgentType, PacketType } from '../../../types';
import { generateUUID } from '../../../utils/uuid';
import { EmotionEngine } from '../EmotionEngine';
import { mapStimulusResponseToWeights } from '../../inference/CortexInference';
import { buildMinimalCortexState } from '../../builders';
import { generateFromCortexState } from '../../inference';
import { isCortexSubEnabled, isMainFeatureEnabled } from '../../config/featureFlags';
import { eventBus } from '../../EventBus';
import { getCurrentTraceId } from '../../trace/TraceContext';
import { processDecisionGate, resetTurnStateForAgent } from '../DecisionGate';
import { guardCortexOutput, isPrismEnabled } from '../PrismPipeline';
import * as LimbicSystem from '../LimbicSystem';
import type { MemorySpace } from '../MemorySpace';
import { DEFAULT_IDENTITY, buildIdentityBlock } from './identity';
import { formatHistoryForCortex } from './history';
import type { AgentIdentityContext, ConversationTurn, ProcessInputParams, ProcessResult, SessionOverlay } from './types';
import { recallMemories } from './memoryRecall';

function buildStructuredPrompt(params: {
  text: string;
  currentLimbic: any;
  currentSoma: any;
  memories: any[];
  conversationHistory: ConversationTurn[];
  identity?: AgentIdentityContext;
  sessionOverlay?: SessionOverlay;
}): string {
  const { text, currentLimbic, currentSoma, memories, conversationHistory, identity, sessionOverlay } = params;

  const agentIdentity = identity || DEFAULT_IDENTITY;
  const recentChat = conversationHistory
    .slice(-5)
    .map((t) => `${t.role.toUpperCase()}: ${t.text}`)
    .join('\n');

  const memoryContext = memories.map((m) => `[MEMORY]: ${m.content}`).join('\n');
  const identityBlock = buildIdentityBlock(agentIdentity, sessionOverlay);

  return `
            ${identityBlock}
            
            CURRENT STATE:
            - Limbic: Fear=${currentLimbic.fear.toFixed(2)}, Curiosity=${currentLimbic.curiosity.toFixed(2)}, Satisfaction=${currentLimbic.satisfaction.toFixed(2)}
            - Soma: Energy=${currentSoma.energy}, Load=${currentSoma.cognitiveLoad}
            
            CONTEXT:
            ${memoryContext}
            
            RECENT CONVERSATION:
            ${recentChat}
            
            USER INPUT: "${text}"
            
            TASK: Respond authentically as ${agentIdentity.name}. Stay true to your persona and values.
            
            OUTPUT JSON format with NO markdown blocks, just raw JSON:
            {
                "responseText": "The actual reply to the user.",
                "internalThought": "Your internal reasoning.",
                "nextLimbic": { "fear_delta": 0.0, "curiosity_delta": 0.0 }
            }
        `;
}

export async function processUserMessage(params: ProcessInputParams): Promise<ProcessResult> {
  const {
    text,
    currentLimbic,
    currentSoma,
    conversationHistory,
    identity,
    sessionOverlay,
    memorySpace,
    prefetchedMemories
  } = params;

  const recentHistory = conversationHistory.slice(-12);

  const memories = await recallMemories({
    queryText: text,
    memorySpace: memorySpace as MemorySpace | undefined,
    prefetchedMemories: prefetchedMemories as any
  });

  if (isCortexSubEnabled('minimalPrompt')) {
    const agentId = getCurrentAgentId();
    if (agentId) {
      const formattedHistory = formatHistoryForCortex(recentHistory);

      if (memories.length > 0) {
        const ragContext = memories
          .map((m: any) => {
            const ts = typeof m?.timestamp === 'string' && m.timestamp ? ` ${m.timestamp}` : '';
            return `[MEMORY_RECALL${ts}]: ${m.content}`;
          })
          .join('\n');
        formattedHistory.push(ragContext);
      }

      const sessionMemory = await SessionMemoryService.getSessionStatsSafe();

      const state = buildMinimalCortexState({
        agentId,
        userInput: text,
        recentContext: formattedHistory,
        metaStates: {
          energy: currentSoma.energy,
          confidence: currentLimbic.satisfaction * 100,
          stress: currentLimbic.fear * 100
        },
        sessionMemory
      });

      const rawOutput = await generateFromCortexState(state);

      let guardedOutput = rawOutput;
      if (isPrismEnabled()) {
        const agentName =
          state.core_identity?.name ||
          ((state.hard_facts?.agentName as string | undefined) ?? undefined) ||
          'UNINITIALIZED_AGENT';

        const guardResult = guardCortexOutput(rawOutput, {
          soma: currentSoma,
          agentName
        });
        guardedOutput = guardResult.output;

        if (!guardResult.guardPassed) {
          console.warn(`[CortexSystem] PersonaGuard check FAILED - response was modified`);
        }
      }

      resetTurnStateForAgent(agentId);
      const gateResult = processDecisionGate(guardedOutput, currentSoma, undefined, agentId);
      const output = gateResult.modifiedOutput;

      const isParseFallback = String((output as any)?.internal_thought || '').includes('Parse error - using fallback');

      const hasToolTag = /\[(SEARCH|VISUALIZE):/i.test(String((output as any)?.speech_content || ''));
      const strictGrounded = isMainFeatureEnabled('GROUNDED_MODE');

      const hasMemories = memories.length > 0;
      const hasSearchChunkMemory =
        hasMemories &&
        memories.some((m: any) => typeof m?.content === 'string' && m.content.includes('KNOWLEDGE_CHUNK (SEARCH)'));

      const evidenceKnowledgeSource: ProcessResult['knowledgeSource'] = isParseFallback
        ? 'system'
        : hasToolTag
          ? 'tool'
          : hasMemories
            ? 'memory'
            : 'system';

      const modelKnowledgeSource: ProcessResult['knowledgeSource'] =
        (output as any)?.knowledge_source || (hasToolTag ? 'tool' : hasMemories ? 'memory' : 'llm');

      const modelEvidenceSource: ProcessResult['evidenceSource'] =
        (output as any)?.evidence_source || (hasToolTag ? 'tool' : hasMemories ? 'memory' : 'system');

      const modelGenerator: ProcessResult['generator'] = (output as any)?.generator === 'system' ? 'system' : 'llm';

      const derivedKnowledgeSource: ProcessResult['knowledgeSource'] = strictGrounded ? evidenceKnowledgeSource : modelKnowledgeSource;

      const derivedEvidenceSource: ProcessResult['evidenceSource'] = strictGrounded
        ? (evidenceKnowledgeSource as any)
        : modelEvidenceSource;

      const derivedEvidenceDetail: ProcessResult['evidenceDetail'] = isParseFallback
        ? 'parse_error'
        : evidenceKnowledgeSource === 'tool'
          ? 'live_tool'
          : evidenceKnowledgeSource === 'memory'
            ? hasSearchChunkMemory
              ? 'search_chunk'
              : undefined
            : undefined;

      const shouldForceSearch = strictGrounded && derivedKnowledgeSource === 'system' && !hasToolTag && !hasMemories;
      const finalSpeech = shouldForceSearch
        ? `Sprawdzę to. [SEARCH: ${String(text || '').slice(0, 160)}]`
        : String((output as any)?.speech_content || '');

      if (shouldForceSearch) {
        eventBus.publish({
          id: generateUUID(),
          traceId: getCurrentTraceId() ?? undefined,
          timestamp: Date.now(),
          source: AgentType.CORTEX_FLOW,
          type: PacketType.SYSTEM_ALERT,
          payload: {
            event: 'GROUNDED_STRICT_FORCED_SEARCH',
            reason: 'llm_fallback_disallowed',
            userInput: String(text || '').slice(0, 200)
          },
          priority: 0.2
        });
      }

      if (gateResult.telemetry.violation) {
        console.warn('[CortexSystem] Cognitive violation detected and corrected');
      }
      if (gateResult.telemetry.intentDetected) {
        console.log('[CortexSystem] Tool intent:', gateResult.telemetry.intentExecuted ? 'EXECUTED' : 'BLOCKED');
      }

      await MemoryService.storeMemory({
        content: `User: ${text} | Agent: ${finalSpeech}`,
        emotionalContext: currentLimbic,
        timestamp: new Date().toISOString(),
        id: generateUUID()
      });

      const stimulusWeights = mapStimulusResponseToWeights((output as any).stimulus_response);

      const emotionSignals = {
        ...EmotionEngine.createIdleSignals(currentSoma.cognitiveLoad, 0),
        novelty: stimulusWeights.novelty_weight,
        reward_signal: stimulusWeights.valence_weight * stimulusWeights.salience_weight,
        prediction_error: stimulusWeights.novelty_weight > 0.5 ? 0.3 : 0,
        prediction_valence:
          stimulusWeights.valence_weight > 0
            ? ('positive' as const)
            : stimulusWeights.valence_weight < 0
              ? ('negative' as const)
              : ('neutral' as const),
        threat_level: stimulusWeights.threat_weight
      };

      const emotionDeltas = EmotionEngine.computeDeltas(emotionSignals, currentLimbic);
      const emotionAfter = LimbicSystem.updateEmotionalState(currentLimbic, emotionDeltas);

      EpisodicMemoryService.detectAndStore(agentId, {
        event: `User said: "${text.slice(0, 100)}..." | Agent responded about: ${
          (gateResult.modifiedOutput as any).internal_thought?.slice(0, 50) || 'interaction'
        }`,
        emotionBefore: currentLimbic,
        emotionAfter,
        context: recentHistory.slice(-2).map((t) => t.text).join(' | ')
      }).catch((err) => console.warn('[CortexSystem] Episode detection failed:', err));

      return {
        responseText: finalSpeech,
        internalThought: (output as any).internal_thought,
        moodShift: emotionDeltas,
        knowledgeSource: shouldForceSearch ? 'tool' : derivedKnowledgeSource,
        evidenceSource: shouldForceSearch ? 'system' : derivedEvidenceSource,
        evidenceDetail: shouldForceSearch ? 'forced_search' : derivedEvidenceDetail,
        generator: shouldForceSearch ? 'system' : modelGenerator
      };
    }
  }

  const prompt = buildStructuredPrompt({
    text,
    currentLimbic,
    currentSoma,
    memories,
    conversationHistory: recentHistory,
    identity,
    sessionOverlay
  });

  const cortexResult = await CortexService.structuredDialogue(prompt);

  await MemoryService.storeMemory({
    content: `User: ${text} | Agent: ${cortexResult.responseText}`,
    emotionalContext: currentLimbic,
    timestamp: new Date().toISOString(),
    id: generateUUID()
  });

  const stimulusWeights = mapStimulusResponseToWeights((cortexResult as any).stimulus_response);

  const emotionSignals = {
    ...EmotionEngine.createIdleSignals(currentSoma.cognitiveLoad, 0),
    novelty: stimulusWeights.novelty_weight,
    reward_signal: stimulusWeights.valence_weight * stimulusWeights.salience_weight,
    prediction_error: stimulusWeights.novelty_weight > 0.5 ? 0.3 : 0,
    prediction_valence:
      stimulusWeights.valence_weight > 0
        ? ('positive' as const)
        : stimulusWeights.valence_weight < 0
          ? ('negative' as const)
          : ('neutral' as const),
    threat_level: stimulusWeights.threat_weight
  };

  const emotionDeltas = EmotionEngine.computeDeltas(emotionSignals, currentLimbic);
  const emotionAfter = LimbicSystem.updateEmotionalState(currentLimbic, emotionDeltas);

  const agentId = getCurrentAgentId();
  if (agentId) {
    EpisodicMemoryService.detectAndStore(agentId, {
      event: `User said: "${text.slice(0, 100)}..." | Agent responded about: ${
        (cortexResult as any).internalThought?.slice(0, 50) || 'interaction'
      }`,
      emotionBefore: currentLimbic,
      emotionAfter,
      context: conversationHistory.slice(-2).map((t) => t.text).join(' | ')
    }).catch((err) => console.warn('[CortexSystem] Episode detection failed:', err));
  }

  const legacyHasToolTag = /\[(SEARCH|VISUALIZE):/i.test(String((cortexResult as any).responseText || ''));
  const strictGrounded = isMainFeatureEnabled('GROUNDED_MODE');
  const legacyHasMemories = memories.length > 0;

  const legacyEvidenceSource: ProcessResult['evidenceSource'] = legacyHasToolTag
    ? 'tool'
    : legacyHasMemories
      ? 'memory'
      : 'system';

  const legacyKnowledgeSource: ProcessResult['knowledgeSource'] = strictGrounded
    ? legacyHasToolTag
      ? 'tool'
      : legacyHasMemories
        ? 'memory'
        : 'system'
    : legacyHasToolTag
      ? 'tool'
      : legacyHasMemories
        ? 'memory'
        : 'llm';

  const legacyShouldForceSearch = strictGrounded && legacyEvidenceSource === 'system' && !legacyHasToolTag && !legacyHasMemories;
  const legacyFinalSpeech = legacyShouldForceSearch
    ? `Sprawdzę to. [SEARCH: ${String(text || '').slice(0, 160)}]`
    : String((cortexResult as any).responseText || '');

  return {
    responseText: legacyFinalSpeech,
    internalThought: (cortexResult as any).internalThought,
    moodShift: emotionDeltas,
    knowledgeSource: legacyShouldForceSearch ? 'tool' : legacyKnowledgeSource,
    evidenceSource: legacyShouldForceSearch ? 'system' : legacyEvidenceSource,
    generator: legacyShouldForceSearch ? 'system' : 'llm'
  };
}
