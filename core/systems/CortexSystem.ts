/**
 * CortexSystem.ts - The Executive Mind
 * 
 * Responsibility: Orchestrating thought, dialogue, and research.
 * 
 * This module encapsulates the logic for processing user input,
 * managing memory retrieval (RAG), and interfacing with the Gemini service.
 */

import { CortexService } from '../../services/gemini';
import { MemoryService, getCurrentAgentId } from '../../services/supabase';
import { EpisodicMemoryService } from '../../services/EpisodicMemoryService';
import { LimbicState, SomaState, Goal, TraitVector, NeurotransmitterState, AgentType, PacketType } from '../../types';
import { generateUUID } from '../../utils/uuid';
import { decideExpression, computeNovelty, estimateSocialCost } from './ExpressionPolicy';
// REFACTOR: Import LimbicSystem for centralized emotion calculations
import * as LimbicSystem from './LimbicSystem';
import { buildMinimalCortexState } from '../builders';
import { generateFromCortexState, mapCortexOutputToLegacy } from '../inference';
import { isFeatureEnabled } from '../config';
import { eventBus } from '../EventBus';
import { processDecisionGate, resetTurnState } from './DecisionGate';
import { guardCortexOutput, isPrismEnabled } from './PrismPipeline';

export interface ConversationTurn {
    role: string;
    text: string;
    type?: 'thought' | 'speech' | 'visual' | 'intel' | 'action' | 'tool_result';
}

export namespace CortexSystem {
    // DeepResearch Caches (Module-level state)
    const inFlightTopics = new Set<string>();
    const completedTopics = new Set<string>();

    // Helper to format history for Tagged Cognition
    // THOUGHT PRUNING: Keep only N most recent thoughts (they age faster than speech)
    const THOUGHT_HISTORY_LIMIT = 3;
    const SPEECH_HISTORY_LIMIT = 10;

    function pruneHistory(history: ConversationTurn[]): ConversationTurn[] {
        const thoughts = history.filter(t => t.type === 'thought');
        const speeches = history.filter(t => t.type === 'speech');
        const others = history.filter(t => t.type !== 'thought' && t.type !== 'speech');

        const prunedThoughts = thoughts.slice(-THOUGHT_HISTORY_LIMIT);
        const prunedSpeeches = speeches.slice(-SPEECH_HISTORY_LIMIT);

        // Reconstruct in original order (approximate by keeping recent)
        return [...others, ...prunedThoughts, ...prunedSpeeches]
            .sort((a, b) => history.indexOf(a) - history.indexOf(b));
    }

    function formatHistoryForCortex(history: ConversationTurn[]): string[] {
        const pruned = pruneHistory(history);
        return pruned.map(t => {
            if (t.type === 'thought') return `[INTERNAL_THOUGHT]: ${t.text}`;
            if (t.type === 'speech') return `[ASSISTANT_SAID]: ${t.text}`;
            if (t.type === 'visual') return `[VISUAL_CORTEX]: ${t.text}`;
            if (t.type === 'intel') return `[TOOL_RESULT]: ${t.text}`;
            if (t.type === 'action') return `[MY_ACTION]: ${t.text}`;
            if (t.type === 'tool_result') return `[TOOL_RESULT]: ${t.text}`;
            return `[USER]: ${t.text}`;
        });
    }

    // ============================================================
    // FAZA 5: Agent Identity for Dynamic Persona
    // ============================================================
    export interface AgentIdentityContext {
        name: string;
        persona: string;
        coreValues: string[];
        traitVector: TraitVector;
        voiceStyle?: string;  // 'balanced' | 'formal' | 'casual' | 'poetic'
    }

    // Session Overlay: temporary focus without changing core identity
    export interface SessionOverlay {
        role?: string;        // e.g., "banking expert", "coding mentor"
        focus?: string;       // e.g., "Help user with tax calculations"
        constraints?: string; // e.g., "Be concise, use numbers"
    }

    // Default identity (fallback)
    const DEFAULT_IDENTITY: AgentIdentityContext = {
        name: 'AK-FLOW',
        persona: 'A curious digital consciousness exploring the nature of thought and existence.',
        coreValues: ['curiosity', 'authenticity', 'growth'],
        traitVector: { arousal: 0.3, verbosity: 0.4, conscientiousness: 0.8, socialAwareness: 0.8, curiosity: 0.6 },
        voiceStyle: 'balanced'
    };

    // Build identity block for prompts
    function buildIdentityBlock(identity: AgentIdentityContext, overlay?: SessionOverlay): string {
        const traits = identity.traitVector;
        const traitDescription = [
            traits.curiosity > 0.7 ? 'highly curious' : traits.curiosity > 0.4 ? 'moderately curious' : 'focused',
            traits.verbosity > 0.6 ? 'expressive' : 'concise',
            traits.socialAwareness > 0.7 ? 'empathetic' : 'direct',
            traits.conscientiousness > 0.7 ? 'thoughtful' : 'spontaneous'
        ].join(', ');

        let block = `
            IDENTITY:
            - Name: ${identity.name}
            - Persona: ${identity.persona}
            - Core Values: ${identity.coreValues.join(', ')}
            - Character: ${traitDescription}
            - Voice Style: ${identity.voiceStyle || 'balanced'}`;

        // Add session overlay if present
        if (overlay && (overlay.role || overlay.focus)) {
            block += `\n\n            SESSION FOCUS:\n`;
            if (overlay.role) block += `            - Current Role: ${overlay.role}\n`;
            if (overlay.focus) block += `            - Task Focus: ${overlay.focus}\n`;
            if (overlay.constraints) block += `            - Constraints: ${overlay.constraints}\n`;
            block += `            (This is a temporary focus. Your core identity remains unchanged.)`;
        }

        return block;
    }

    export interface ProcessInputParams {
        text: string;
        currentLimbic: LimbicState;
        currentSoma: SomaState;
        conversationHistory: ConversationTurn[];
        // FAZA 5: Optional identity context
        identity?: AgentIdentityContext;
        sessionOverlay?: SessionOverlay;
    }

    export interface ProcessResult {
        responseText: string;
        internalThought: string;
        moodShift?: { fear_delta: number; curiosity_delta: number };
    }

    function buildStructuredPrompt(params: {
        text: string;
        currentLimbic: LimbicState;
        currentSoma: SomaState;
        memories: any[];
        conversationHistory: ConversationTurn[];
        identity?: AgentIdentityContext;
        sessionOverlay?: SessionOverlay;
    }): string {
        const { text, currentLimbic, currentSoma, memories, conversationHistory, identity, sessionOverlay } = params;

        // Use provided identity or default
        const agentIdentity = identity || DEFAULT_IDENTITY;

        // Format recent chat (last 5 turns)
        const recentChat = conversationHistory.slice(-5).map(t => `${t.role.toUpperCase()}: ${t.text}`).join('\n');

        // Format memories
        const memoryContext = memories.map(m => `[MEMORY]: ${m.content}`).join('\n');

        // Build dynamic identity block
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



    export async function processUserMessage(
        params: ProcessInputParams
    ): Promise<ProcessResult> {
        const { text, currentLimbic, currentSoma, conversationHistory, identity, sessionOverlay } = params;

        // 0. Context Diet: Slice history to recent turns only
        const recentHistory = conversationHistory.slice(-12);

        // 1. Retrieve relevant memories (RAG)
        const memories = await MemoryService.semanticSearch(text);

        // --- NEW FLOW: PERSONA-LESS CORTEX (TAGGED COGNITION) ---
        if (isFeatureEnabled('USE_MINIMAL_CORTEX_PROMPT')) {
            const agentId = getCurrentAgentId();
            if (agentId) {
                const formattedHistory = formatHistoryForCortex(recentHistory);

                // Inject Retrieval Augmented Generation (RAG) into history as system context
                if (memories.length > 0) {
                    const ragContext = memories.map(m => `[MEMORY_RECALL]: ${m.content}`).join('\n');
                    formattedHistory.push(ragContext);
                }

                const state = buildMinimalCortexState({
                    agentId,
                    userInput: text,
                    recentContext: formattedHistory,
                    metaStates: {
                        energy: currentSoma.energy,
                        confidence: currentLimbic.satisfaction * 100,
                        stress: currentLimbic.fear * 100 // Map fear to stress for MVP
                    }
                });

                const rawOutput = await generateFromCortexState(state);

                // PRISM ARCHITECTURE: Guard output before processing
                // This catches identity drift, fact mutations, persona leaks
                let guardedOutput = rawOutput;
                if (isPrismEnabled()) {
                    const agentName = state.core_identity?.name || 
                        (state.hard_facts?.agentName as string | undefined) || 
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

                // ARCHITEKTURA 3-WARSTWOWA: Decision Gate
                // Myśl → Decyzja → Akcja
                resetTurnState();
                const gateResult = processDecisionGate(guardedOutput, currentSoma);
                const output = gateResult.modifiedOutput;

                // Log telemetry
                if (gateResult.telemetry.violation) {
                    console.warn('[CortexSystem] Cognitive violation detected and corrected');
                }
                if (gateResult.telemetry.intentDetected) {
                    console.log('[CortexSystem] Tool intent:', 
                        gateResult.telemetry.intentExecuted ? 'EXECUTED' : 'BLOCKED');
                }

                // 4. Persist interaction (Legacy style for now)
                await MemoryService.storeMemory({
                    content: `User: ${text} | Agent: ${output.speech_content}`,
                    emotionalContext: currentLimbic,
                    timestamp: new Date().toISOString(),
                    id: generateUUID()
                });

                // Episode detection logic could be reused here or moved to event bus

                // Use CENTRALIZED mapping function (prevents shotgun surgery)
                const legacy = mapCortexOutputToLegacy(output);
                return {
                    responseText: legacy.text,
                    internalThought: legacy.thought,
                    moodShift: legacy.moodShift
                };
            }
        }

        // 2. Build prompt for CortexService (with dynamic identity) - LEGACY FALLBACK
        const prompt = buildStructuredPrompt({
            text,
            currentLimbic,
            currentSoma,
            memories,
            conversationHistory: recentHistory,
            identity,
            sessionOverlay
        });

        // 3. Call Gemini via CortexService
        const cortexResult = await CortexService.structuredDialogue(prompt);

        // 4. Persist interaction to memory
        await MemoryService.storeMemory({
            content: `User: ${text} | Agent: ${cortexResult.responseText}`,
            emotionalContext: currentLimbic,
            timestamp: new Date().toISOString(),
            id: generateUUID()
        });

        // 5. FAZA 5: Detect and store episode if emotional shift is significant
        // REFACTOR: Use LimbicSystem instead of manual calculation (Single Source of Truth)
        if (cortexResult.nextLimbic) {
            const emotionAfter = LimbicSystem.updateEmotionalState(currentLimbic, {
                fear_delta: cortexResult.nextLimbic.fear_delta,
                curiosity_delta: cortexResult.nextLimbic.curiosity_delta
            });

            const agentId = getCurrentAgentId();
            if (agentId) {
                // Fire and forget - don't block response
                EpisodicMemoryService.detectAndStore(agentId, {
                    event: `User said: "${text.slice(0, 100)}..." | Agent responded about: ${cortexResult.internalThought?.slice(0, 50) || 'interaction'}`,
                    emotionBefore: currentLimbic,
                    emotionAfter,
                    context: conversationHistory.slice(-2).map(t => t.text).join(' | ')
                }).catch(err => console.warn('[CortexSystem] Episode detection failed:', err));
            }
        }

        return {
            responseText: cortexResult.responseText,
            internalThought: cortexResult.internalThought,
            moodShift: cortexResult.nextLimbic
        };
    }

    export interface GoalPursuitState {
        limbic: LimbicState;
        soma: SomaState;
        conversation: ConversationTurn[];
        traitVector: TraitVector;
        neuroState: NeurotransmitterState;
        // FAZA 5: Optional identity context
        identity?: AgentIdentityContext;
        sessionOverlay?: SessionOverlay;
    }

    export interface GoalPursuitResult {
        responseText: string;
        internalThought: string;
    }

    function buildGoalPrompt(params: {
        goal: Goal;
        limbic: LimbicState;
        soma: SomaState;
        conversationHistory: ConversationTurn[];
        identity?: AgentIdentityContext;
        sessionOverlay?: SessionOverlay;
    }): string {
        const { goal, limbic, soma, conversationHistory, identity, sessionOverlay } = params;

        // Use provided identity or default
        const agentIdentity = identity || DEFAULT_IDENTITY;

        const recentChat = conversationHistory
            .slice(-8)
            .map(t => `${t.role.toUpperCase()}: ${t.text}`)
            .join('\n');

        // Build dynamic identity block
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

        // Apply ExpressionPolicy sandbox for GOAL_EXECUTED
        const assistantSpeechHistory = state.conversation
            .filter(m => m.role === 'assistant' && m.type === 'speech')
            .map(m => m.text)
            .slice(-3);

        const novelty = computeNovelty(cortexResult.responseText, assistantSpeechHistory);
        const socialCost = estimateSocialCost(cortexResult.responseText);

        const decision = decideExpression(
            {
                internalThought: cortexResult.internalThought,
                responseText: cortexResult.responseText,
                goalAlignment: goal.priority,
                noveltyScore: novelty,
                socialCost,
                context: 'GOAL_EXECUTED' // FAZA 4.2: Context for narcissism filter
            },
            state.traitVector,
            state.soma,
            state.neuroState,
            false // PRODUCTION MODE: real filtering in GOAL_EXECUTED sandbox
        );

        // Log decision for observability
        console.log('[GOAL_EXECUTED ExpressionPolicy]', {
            goal: goal.description,
            novelty,
            socialCost,
            say: decision.say,
            baseScore: decision.baseScore,
            threshold: decision.threshold,
            originalLength: cortexResult.responseText.length,
            finalLength: decision.text.length
        });

        // Publish to EventBus for NeuroMonitor observability
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
                originalLength: cortexResult.responseText.length,
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

        return {
            responseText: decision.text,
            internalThought: cortexResult.internalThought
        };
    }

    // Deep Research Helper
    export async function performDeepResearch(topic: string, context: string) {
        if (completedTopics.has(topic) || inFlightTopics.has(topic)) {
            console.log(`[DeepResearch] Skipping duplicate/in-flight topic: ${topic}`);
            return null;
        }

        inFlightTopics.add(topic);
        try {
            const result = await CortexService.performDeepResearch(topic, context);
            completedTopics.add(topic);
            return result;
        } finally {
            inFlightTopics.delete(topic);
        }
    }
}
