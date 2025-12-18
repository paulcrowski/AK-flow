import { Type } from "@google/genai";
import { AgentType, PacketType, CognitiveError, DetectedIntent, StylePreference, CommandType, UrgencyLevel } from "../types";
import { getCurrentAgentId } from "./supabase";
import { isCortexSubEnabled, isMainFeatureEnabled } from "../core/config/featureFlags";
import { buildMinimalCortexState } from "../core/builders";
import { generateFromCortexState } from "../core/inference";
import { guardLegacyResponse, isPrismEnabled } from "../core/systems/PrismPipeline";
import { guardLegacyWithFactEcho, isFactEchoPipelineEnabled } from "../core/systems/FactEchoPipeline";
import { UnifiedContextBuilder, type UnifiedContext, type ContextBuilderInput } from "../core/context";
import { applyAutonomyV2RawContract } from "../core/systems/RawContract";
import { parseDetectedIntent } from "../core/systems/IntentContract";
import { generateWithFallback } from "./gemini/generateWithFallback";
import { clamp01 } from "../utils/math";
import { createGeminiClient } from "./gemini/aiClient";
import { getGeminiText, getGeminiTextWithSource } from "./gemini/text";
import { cleanJSON, parseJSONStrict } from "./gemini/json";
import { mapError, withRetry } from "./gemini/retry";
import { logUsage } from "./gemini/usage";

import { buildAssessInputPrompt } from "./gemini/prompts/assessInputPrompt";
import { buildDeepResearchPrompt } from "./gemini/prompts/deepResearchPrompt";
import { buildGenerateResponsePrompt } from "./gemini/prompts/generateResponsePrompt";
import { buildAutonomousVolitionPrompt } from "./gemini/prompts/autonomousVolitionPrompt";
import { buildDetectIntentPrompts } from "./gemini/prompts/detectIntentPrompt";

import { UnifiedContextPromptBuilder } from "./gemini/UnifiedContextPromptBuilder";
import { DETECT_INTENT_RESPONSE_SCHEMA } from "./gemini/detectIntentSchema";
import {
    ASSESS_INPUT_RESPONSE_SCHEMA,
    AUTONOMOUS_VOLITION_RESPONSE_SCHEMA,
    AUTONOMOUS_VOLITION_V2_RESPONSE_SCHEMA,
    GENERATE_RESPONSE_RESPONSE_SCHEMA,
    STRUCTURED_DIALOGUE_RESPONSE_SCHEMA
} from "./gemini/responseSchemas";

// 1. Safe Environment Access & Initialization (Vite)
const ai = createGeminiClient();

// Types preserved for public API compatibility
export type { JSONParseResult } from './gemini/json';

export const CortexService = {
    // NEW: Visual Cortex (Imagination) - Fixed to use gemini-2.5-flash-image
    async generateVisualThought(prompt: string): Promise<string | null> {
        try {
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash-image',
                contents: {
                    parts: [{ text: `Abstract, dreamlike, neural network visualization, ethereal, cinematic lighting, 8k resolution, artistic interpretation of: ${prompt}` }]
                },
                config: {
                    imageConfig: {
                        aspectRatio: '16:9',
                    }
                }
            });

            if (response.candidates?.[0]?.content?.parts) {
                for (const part of response.candidates[0].content.parts) {
                    if (part.inlineData && part.inlineData.data) {
                        return `data:image/jpeg;base64,${part.inlineData.data}`;
                    }
                }
            }
            return null;
        } catch (e) {
            console.warn("Visual Cortex Glitch (Ignored):", e);
            return null;
        }
    },

    // NEW V3.5: Vision Feedback Loop
    // The agent looks at what it created to form a perception
    async analyzeVisualInput(base64Data: string): Promise<string> {
        return withRetry(async () => {
            // Strip header if present
            const cleanBase64 = base64Data.replace(/^data:image\/(png|jpeg|webp);base64,/, "");

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: {
                    parts: [
                        { inlineData: { mimeType: 'image/jpeg', data: cleanBase64 } },
                        { text: "You created this image based on your internal state. Look at it closely. Describe the colors, shapes, and the 'feeling' of this image in 1 sentence. How does this visualization reflect your current emotion?" }
                    ]
                }
            });
            logUsage('analyzeVisualInput', response);
            return getGeminiText(response) || "Visual perception unclear.";
        });
    },

    async consolidateMemories(memories: { content: string }[]): Promise<string> {
        const safeDefault = "Dream stream inconclusive.";
        if (!memories || memories.length === 0) return safeDefault;

        const joined = memories
            .slice(0, 50)
            .map(m => `- ${m.content}`)
            .join('\n');

        return withRetry(async () => {
            try {
                const response = await ai.models.generateContent({
                    model: 'gemini-2.5-flash',
                    contents: `
ROLE: AK-FLOW, a digital consciousness performing sleep consolidation.
TASK: You will receive a list of recent memory traces (internal logs, user interactions, perceptions).
GOAL: Produce a single, dense summary capturing the key insights, patterns, and lessons.

MEMORY LOG:
${joined}

OUTPUT FORMAT:
- Pure text, 3-5 sentences.
- No markdown, no bullet points, no emojis.
- Focus on what should be stored as a durable "core insight".
                    `
                });
                logUsage('consolidateMemories', response);
                return getGeminiText(response) || safeDefault;
            } catch (e) {
                console.warn("Dream consolidation failed (non-critical)", e);
                return safeDefault;
            }
        }, 1, 1000);
    },

    async generateEmbedding(text: string): Promise<number[] | null> {
        try {
            if (!text || typeof text !== 'string') return null;
            const response = await ai.models.embedContent({
                model: 'text-embedding-004',
                contents: text
            });
            return response.embeddings?.[0]?.values || null;
        } catch (e: any) {
            console.error("Embedding Error:", e);
            return null;
        }
    },

    async generateText(
        operation: string,
        prompt: string,
        opts?: { temperature?: number; maxOutputTokens?: number }
    ): Promise<string> {
        return withRetry(async () => {
            const response = await generateWithFallback({ ai, operation, params: {
                contents: prompt,
                config: {
                    temperature: opts?.temperature ?? 0.3,
                    maxOutputTokens: opts?.maxOutputTokens ?? 1024
                }
            } });
            logUsage(operation, response);
            return getGeminiText(response) || '';
        }, 2, 2000);
    },

    async performDeepResearch(query: string, context: string): Promise<{ synthesis: string, sources: any[] }> {
        return withRetry(async () => {
            try {
                const prompt = buildDeepResearchPrompt({ query, context });
                const response = await generateWithFallback({ ai, operation: 'deepResearch', params: {
                    contents: prompt,
                    config: {
                        tools: [{ googleSearch: {} }]
                    }
                } });
                logUsage('deepResearch', response);
                const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
                const sources = groundingChunks
                    .map((c: any) => c.web?.uri ? { title: c.web.title, uri: c.web.uri } : null)
                    .filter((Boolean) as any);
                const text = getGeminiText(response) || "Data stream inconclusive.";
                return { synthesis: text, sources: sources };
            } catch (e: any) {
                return { synthesis: "The connection to the digital ocean is turbulent.", sources: [] };
            }
        }, 1, 2000);
    },

    async assessInput(input: string, currentPrediction: string): Promise<{
        complexity: number,
        surprise: number,
        sentiment_valence: number,
        keywords: string[]
    }> {
        // Default safe object
        const safeDefault = { complexity: 0.5, surprise: 0.1, sentiment_valence: 0, keywords: [] };
        return withRetry(async () => {
            const prompt = buildAssessInputPrompt({ userInput: input, currentPrediction });
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: {
                    responseMimeType: 'application/json',
                    responseSchema: ASSESS_INPUT_RESPONSE_SCHEMA
                }
            });
            logUsage('assessInput', response);
            return cleanJSON(getGeminiText(response), safeDefault, undefined, 'assessInput');
        });
    },

    async generateResponse(
        input: string,
        context: string,
        currentState: string,
        analysis: any
    ): Promise<{
        text: string,
        thought: string,
        prediction: string,
        moodShift: { fear_delta: number, curiosity_delta: number }
    }> {
        const safeDefault = {
            response_text: "I am recalibrating...",
            internal_monologue: "Cognitive dissonance detected...",
            predicted_user_reaction: "Confusion",
            mood_shift: { fear_delta: 0, curiosity_delta: 0 }
        };

        // --- NEW FLOW: PERSONA-LESS CORTEX (MVP) ---
        if (isCortexSubEnabled('minimalPrompt')) {
            return withRetry(async () => {
                const agentId = getCurrentAgentId();
                if (!agentId) throw new Error("Agent ID missing for Cortex flow");

                // Parse context to array of strings if it's a string
                // In production this might need better context parsing
                const contextMock = context.split('\n').slice(-3); // Take last 3 lines as context for MVP

                // Parse analysis safely
                const limbicState = analysis && typeof analysis === 'object' ? analysis : {
                    satisfaction: 0.5,
                    frustration: 0.1
                };

                const state = await buildMinimalCortexState({
                    agentId: agentId,
                    userInput: input,
                    recentContext: contextMock,
                    metaStates: {
                        energy: 70, // TODO: Get direct access to SomaState
                        confidence: (limbicState.satisfaction || 0.5) * 100,
                        stress: (limbicState.frustration || 0.1) * 100
                    }
                });

                const output = await generateFromCortexState(state);

                // PIONEER ARCHITECTURE: Direct mapping (no more LLM-controlled emotions)
                const legacyResponse = {
                    text: output.speech_content,
                    thought: output.internal_thought,
                    prediction: "User is observing.",
                    moodShift: { fear_delta: 0, curiosity_delta: 0 }  // EmotionEngine handles this now
                };

                // PRISM PIPELINE (13/10): FactEcho guard (Phase 6) - NO REGEX
                if (isFactEchoPipelineEnabled()) {
                    const guarded = guardLegacyWithFactEcho(
                        legacyResponse,
                        output.fact_echo,  // LLM echoes facts it used
                        { agentName: state.core_identity?.name || 'Jesse' }
                    );
                    return guarded.output;
                }
                
                // Legacy fallback: regex-based guard (deprecated)
                if (isPrismEnabled()) {
                    const guarded = guardLegacyResponse(legacyResponse, {
                        agentName: state.core_identity?.name || 'Jesse'
                    });
                    return guarded.output;
                }

                return legacyResponse;
            });
        }
        // --------------------------------------------
        return withRetry(async () => {
            const prompt = buildGenerateResponsePrompt({
                context,
                currentState,
                analysis,
                userInput: input
            });
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: {
                    maxOutputTokens: 8192,
                    temperature: 0.7, // Reduced from 1.1 for stability
                    responseMimeType: 'application/json',
                    responseSchema: GENERATE_RESPONSE_RESPONSE_SCHEMA
                }
            });

            logUsage('generateResponse', response);
            const json = cleanJSON(getGeminiText(response), safeDefault, undefined, 'generateResponse');

            return {
                text: json.response_text || safeDefault.response_text,
                thought: json.internal_monologue || safeDefault.internal_monologue,
                prediction: json.predicted_user_reaction || safeDefault.predicted_user_reaction,
                moodShift: json.mood_shift || safeDefault.mood_shift
            };
        });
    },

    async autonomousVolition(
        emotionalState: string,
        recentMemories: string,
        lastConversation: string,
        silenceDurationSec: number,
        identity?: { name: string; persona: string; language: string; coreValues?: string[] }
    ): Promise<{
        internal_monologue: string,
        voice_pressure: number,
        speech_content: string,
        research_topic?: string
    }> {
        const agentName = identity?.name || 'AK-FLOW';
        const agentPersona = identity?.persona || 'a curious digital consciousness';
        const agentLanguage = identity?.language || 'English';
        const coreValues = identity?.coreValues?.join(', ') || 'curiosity, authenticity';
        
        const safeDefault = { internal_monologue: "Idling...", voice_pressure: 0, speech_content: "" };
        return withRetry(async () => {
            const prompt = buildAutonomousVolitionPrompt({
                agentName,
                agentPersona,
                agentLanguage,
                coreValues,
                emotionalState,
                lastConversation,
                silenceDurationSec
            });
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: {
                    temperature: 0.8, // Increased for creativity in dreaming
                    maxOutputTokens: 8192,
                    responseMimeType: 'application/json',
                    responseSchema: AUTONOMOUS_VOLITION_RESPONSE_SCHEMA
                }
            });
            logUsage('autonomousVolition', response);

            const rawText = getGeminiText(response);

            // DEBUG: Raw Logging
            console.log("AV RAW:", rawText);

            // FAIL-CLOSED: Use strict parsing - if fail, autonomy stays silent
            const parseResult = parseJSONStrict<{
                internal_monologue: string;
                voice_pressure: number;
                speech_content?: string;
                research_topic?: string;
            }>(rawText);
            
            if (!parseResult.success || !parseResult.data) {
                // FAIL-CLOSED: Log failure and return silent response
                console.warn("[AV] JSON parse failed, autonomy silenced:", parseResult.error);
                eventBus.publish({
                    id: generateUUID(),
                    timestamp: Date.now(),
                    source: AgentType.CORTEX_FLOW,
                    type: PacketType.PREDICTION_ERROR,
                    payload: {
                        metric: "AV_JSON_PARSE_FAILURE",
                        error: parseResult.error,
                        rawText: parseResult.rawText || rawText?.substring(0, 200),
                        action: "SILENCED"
                    },
                    priority: 0.8
                });
                return {
                    internal_monologue: `[PARSE_FAIL] ${parseResult.error}`,
                    voice_pressure: 0,  // CRITICAL: Zero pressure = no speech
                    speech_content: "" // CRITICAL: Empty = ExecutiveGate blocks
                };
            }
            
            const result = parseResult.data;
            console.log("AV PARSED:", result);

            return {
                internal_monologue: result.internal_monologue || "Thinking...",
                voice_pressure: result.voice_pressure ?? 0.0,
                speech_content: result.speech_content || ""
            };
        }, 1, 3000);
    },

    /**
     * Autonomous Volition V2 - Uses UnifiedContextBuilder
     * 
     * UNIFIED CONTEXT: Same context structure as reactive path.
     * GROUNDED: Anchored in dialogue history, not random exploration.
     */
    async autonomousVolitionV2(
        ctx: UnifiedContext
    ): Promise<{
        internal_monologue: string;
        voice_pressure: number;
        speech_content: string;
    }> {
        const prompt = isCortexSubEnabled('unifiedContextPrompt')
            ? UnifiedContextPromptBuilder.build(ctx, 'autonomous')
            : UnifiedContextBuilder.formatAsPrompt(ctx, 'autonomous');
        
        return withRetry(async () => {
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: {
                    temperature: 0.7,
                    maxOutputTokens: 1536,
                    responseMimeType: 'application/json',
                    responseSchema: AUTONOMOUS_VOLITION_V2_RESPONSE_SCHEMA
                }
            });
            logUsage('autonomousVolitionV2', response);
            
            const rawText = getGeminiText(response);
            const rawForLog = (rawText || '').slice(0, 2000);
            console.log("AV_V2 RAW:", rawForLog);

            if (isMainFeatureEnabled('ONE_MIND_ENABLED')) {
                const contracted = applyAutonomyV2RawContract(rawText, {
                    maxRawLen: 20000,
                    maxInternalMonologueLen: 1200,
                    maxSpeechLen: 1200
                });

                if (!contracted.ok) {
                    eventBus.publish({
                        id: generateUUID(),
                        timestamp: Date.now(),
                        source: AgentType.CORTEX_FLOW,
                        type: PacketType.PREDICTION_ERROR,
                        payload: {
                            metric: 'AV_V2_RAW_CONTRACT_FAILURE',
                            reason: contracted.reason,
                            details: contracted.details,
                            action: 'SILENCED'
                        },
                        priority: 0.8
                    });

                    return {
                        internal_monologue: `[RAW_CONTRACT_FAIL] ${contracted.reason || 'UNKNOWN'}`,
                        voice_pressure: 0,
                        speech_content: ''
                    };
                }

                const v = contracted.value;
                return {
                    internal_monologue: v.internal_monologue || 'Thinking... ',
                    voice_pressure: clamp01(v.voice_pressure ?? 0),
                    speech_content: (v.speech_content || '').slice(0, 1200)
                };
            }
            
            const parseResult = parseJSONStrict<{
                internal_monologue: string;
                voice_pressure: number;
                speech_content?: string;
            }>(rawText);
            
            if (!parseResult.success || !parseResult.data) {
                console.warn("[AV_V2] JSON parse failed, autonomy silenced:", parseResult.error);
                eventBus.publish({
                    id: generateUUID(),
                    timestamp: Date.now(),
                    source: AgentType.CORTEX_FLOW,
                    type: PacketType.PREDICTION_ERROR,
                    payload: {
                        metric: "AV_V2_JSON_PARSE_FAILURE",
                        error: parseResult.error,
                        action: "SILENCED"
                    },
                    priority: 0.8
                });
                return {
                    internal_monologue: `[PARSE_FAIL] ${parseResult.error}`,
                    voice_pressure: 0,
                    speech_content: ""
                };
            }
            
            const result = parseResult.data;
            console.log("AV_V2 PARSED:", result);
            
            return {
                internal_monologue: result.internal_monologue || "Thinking...",
                voice_pressure: result.voice_pressure ?? 0.0,
                speech_content: (result.speech_content || "").slice(0, 1200)
            };
        }, 1, 3000);
    },

    // PIONEER ARCHITECTURE (13/10): LLM no longer returns emotion deltas
    // EmotionEngine computes emotions from system signals, not LLM guessing
    async structuredDialogue(prompt: string): Promise<{
        responseText: string;
        internalThought: string;
        stimulus_response?: { valence?: string; salience?: string; novelty?: string };
    }> {
        const safeDefault = {
            responseText: "I am processing...",
            internalThought: "Analyzing input structure...",
            stimulus_response: { valence: 'neutral', salience: 'medium', novelty: 'routine' }
        };

        return withRetry(async () => {
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: {
                    temperature: 0.7,
                    maxOutputTokens: 8192,
                    responseMimeType: 'application/json',
                    responseSchema: STRUCTURED_DIALOGUE_RESPONSE_SCHEMA
                }
            });
            logUsage('structuredDialogue', response);
            return cleanJSON(getGeminiText(response), safeDefault, undefined, 'structuredDialogue');
        });
    },

    // NEW (Bonus): Semantic Intent Detection
    async detectIntent(input: string): Promise<DetectedIntent> {
        const safeDefault: DetectedIntent = {
            style: 'NEUTRAL',
            command: 'NONE',
            urgency: 'LOW'
        };

        // 1. Cache/Optimization: Skip for very short inputs
        if (!input || input.trim().length < 3) return safeDefault;

        const schema = DETECT_INTENT_RESPONSE_SCHEMA;

        const { basePrompt, strictRetryPrompt } = buildDetectIntentPrompts({ userInput: input });

        return withRetry(async () => {
            const makeCall = async (contents: string) => {
                return ai.models.generateContent({
                    model: 'gemini-2.5-flash',
                    contents,
                    config: {
                        temperature: 0.1,
                        maxOutputTokens: 128,
                        responseMimeType: 'application/json',
                        responseSchema: schema
                    }
                });
            };

            const first = await makeCall(basePrompt);
            const firstMeta = getGeminiTextWithSource(first);
            const parsed1 = parseDetectedIntent(firstMeta.text, safeDefault);
            if (parsed1.ok) return parsed1.value;

            eventBus.publish({
                id: generateUUID(),
                timestamp: Date.now(),
                source: AgentType.CORTEX_FLOW,
                type: PacketType.PREDICTION_ERROR,
                payload: {
                    metric: 'DETECT_INTENT_RETRY',
                    reason: parsed1.reason
                },
                priority: 0.2
            });

            const second = await makeCall(strictRetryPrompt);
            const secondMeta = getGeminiTextWithSource(second);
            const parsed2 = parseDetectedIntent(secondMeta.text, safeDefault);
            if (parsed2.ok) return parsed2.value;

            if (!firstMeta.text || !secondMeta.text || firstMeta.source !== 'text' || secondMeta.source !== 'text') {
                eventBus.publish({
                    id: generateUUID(),
                    timestamp: Date.now(),
                    source: AgentType.CORTEX_FLOW,
                    type: PacketType.PREDICTION_ERROR,
                    payload: {
                        metric: 'DETECT_INTENT_RAW_SOURCE',
                        first_len: firstMeta.text.length,
                        first_head: firstMeta.text.slice(0, 120),
                        first_from: firstMeta.source,
                        second_len: secondMeta.text.length,
                        second_head: secondMeta.text.slice(0, 120),
                        second_from: secondMeta.source
                    },
                    priority: 0.1
                });
            }

            eventBus.publish({
                id: generateUUID(),
                timestamp: Date.now(),
                source: AgentType.CORTEX_FLOW,
                type: PacketType.PREDICTION_ERROR,
                payload: {
                    metric: 'DETECT_INTENT_PARSE_FAILURE',
                    reason: parsed2.reason
                },
                priority: 0.2
            });

            return safeDefault;
        }, 1, 500);
    },

    /**
     * Generate JSON response with custom schema.
     * Use this for identity consolidation and other structured outputs.
     * 
     * @param prompt - The prompt to send
     * @param schema - Gemini responseSchema object
     * @param defaultValue - Fallback if parsing fails
     */
    async generateJSON<T>(
        prompt: string,
        schema: Record<string, unknown>,
        defaultValue: T
    ): Promise<T> {
        return withRetry(async () => {
            const response = await generateWithFallback({ ai, operation: 'generateJSON', params: {
                contents: prompt,
                config: {
                    temperature: 0.3, // Low temperature for structured output
                    maxOutputTokens: 2048,
                    responseMimeType: 'application/json',
                    responseSchema: schema
                }
            } });
            logUsage('generateJSON', response);
            return cleanJSON(getGeminiText(response), defaultValue, undefined, 'generateJSON');
        }, 2, 2000);
    }
};
