/**
 * CortexSystem.ts - The Executive Mind
 * 
 * Responsibility: Orchestrating thought, dialogue, and research.
 * 
 * This module encapsulates the logic for processing user input,
 * managing memory retrieval (RAG), and interfacing with the Gemini service.
 */

import { CortexService } from '../../services/gemini';
import { MemoryService } from '../../services/supabase';
import { LimbicState, SomaState, Goal, TraitVector, NeurotransmitterState, AgentType, PacketType } from '../../types';
import { generateUUID } from '../../utils/uuid';
import { decideExpression, computeNovelty, estimateSocialCost } from './ExpressionPolicy';
import { eventBus } from '../EventBus';

export interface ConversationTurn {
    role: string;
    text: string;
    type?: 'thought' | 'speech' | 'visual' | 'intel';
}

export namespace CortexSystem {
    // DeepResearch Caches (Module-level state)
    const inFlightTopics = new Set<string>();
    const completedTopics = new Set<string>();

    export interface ProcessInputParams {
        text: string;
        currentLimbic: LimbicState;
        currentSoma: SomaState;
        conversationHistory: ConversationTurn[];
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
    }): string {
        const { text, currentLimbic, currentSoma, memories, conversationHistory } = params;

        // Format recent chat (last 5 turns)
        const recentChat = conversationHistory.slice(-5).map(t => `${t.role.toUpperCase()}: ${t.text}`).join('\n');

        // Format memories
        const memoryContext = memories.map(m => `[MEMORY]: ${m.content}`).join('\n');

        return `
            ROLE: AK-FLOW, Advanced Cognitive System.
            
            CURRENT STATE:
            - Limbic: Fear=${currentLimbic.fear.toFixed(2)}, Curiosity=${currentLimbic.curiosity.toFixed(2)}, Satisfaction=${currentLimbic.satisfaction.toFixed(2)}
            - Soma: Energy=${currentSoma.energy}, Load=${currentSoma.cognitiveLoad}
            
            CONTEXT:
            ${memoryContext}
            
            RECENT CONVERSATION:
            ${recentChat}
            
            USER INPUT: "${text}"
            
            TASK: Analyze input, update emotional state, and formulate a response.
            
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
        const { text, currentLimbic, currentSoma, conversationHistory } = params;

        // 0. Context Diet: Slice history to recent turns only
        const recentHistory = conversationHistory.slice(-12);

        // 1. Retrieve relevant memories (RAG)
        const memories = await MemoryService.semanticSearch(text);

        // 2. Build prompt for CortexService
        const prompt = buildStructuredPrompt({
            text,
            currentLimbic,
            currentSoma,
            memories,
            conversationHistory: recentHistory
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
    }): string {
        const { goal, limbic, soma, conversationHistory } = params;

        const recentChat = conversationHistory
            .slice(-8)
            .map(t => `${t.role.toUpperCase()}: ${t.text}`)
            .join('\n');

        return `
            ROLE: AK-FLOW, Autonomous Cognitive Agent.

            CURRENT STATE:
            - Limbic: Fear=${limbic.fear.toFixed(2)}, Curiosity=${limbic.curiosity.toFixed(2)}, Satisfaction=${limbic.satisfaction.toFixed(2)}
            - Soma: Energy=${soma.energy}, Load=${soma.cognitiveLoad}

            ACTIVE GOAL (${goal.source.toUpperCase()}):
            - Description: ${goal.description}
            - Priority: ${goal.priority.toFixed(2)}

            RECENT CONVERSATION (context for this goal):
            ${recentChat}

            TASK: Execute exactly ONE short, clear utterance to advance this goal.
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
            conversationHistory: recentHistory
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
