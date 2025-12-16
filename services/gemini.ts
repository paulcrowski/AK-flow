import { GoogleGenAI, Type } from "@google/genai";
import { eventBus } from "../core/EventBus";
import { AgentType, PacketType, CognitiveError, DetectedIntent, StylePreference, CommandType, UrgencyLevel } from "../types";
import { generateUUID } from "../utils/uuid";
import { getCurrentAgentId } from "./supabase";
import { isFeatureEnabled } from "../core/config";
import { buildMinimalCortexState } from "../core/builders";
import { generateFromCortexState } from "../core/inference";
import { guardLegacyResponse, isPrismEnabled } from "../core/systems/PrismPipeline";
import { guardLegacyWithFactEcho, isFactEchoPipelineEnabled } from "../core/systems/FactEchoPipeline";
import { UnifiedContextBuilder, type UnifiedContext, type ContextBuilderInput } from "../core/context";

// 1. Safe Environment Access & Initialization (Vite)
const apiKey = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;

if (!apiKey) {
    console.error("[Gemini] Brak VITE_GEMINI_API_KEY w .env.local – CortexService nie ma klucza.");
    // Możesz tu zwrócić null zamiast rzucać, jeśli chcesz dalej ładować UI bez AGI
    throw new Error("Brak VITE_GEMINI_API_KEY w env (frontend).");
}

const ai = new GoogleGenAI({ apiKey });

// 2. Robust JSON Parsing Helper
// Generic Type Guard
function isValidResponse<T>(data: any, validator?: (data: any) => boolean): data is T {
    if (!data || typeof data !== 'object') return false;
    if (validator) return validator(data);
    return true; // Default: just checks if it's an object
}

/**
 * Parse result with explicit success/failure signal.
 * FAIL-CLOSED: caller decides what to do on failure, not silent default.
 */
export interface JSONParseResult<T> {
    success: boolean;
    data: T | null;
    error?: string;
    rawText?: string;
}

/**
 * Parse JSON with explicit success/failure.
 * Returns {success: false} instead of silent default.
 */
const parseJSONStrict = <T>(text: string | undefined, validator?: (data: any) => boolean): JSONParseResult<T> => {
    if (!text) {
        return { success: false, data: null, error: 'EMPTY_RESPONSE' };
    }
    
    try {
        let parsed: any;
        
        // Pre-clean: Remove common LLM prefixes
        let cleaned = text.replace(/^[\s\S]*?(?=\{)/m, '').trim();
        if (!cleaned.startsWith('{')) {
            cleaned = text;
        }
        
        // Strategy 1: Direct parse
        try {
            parsed = JSON.parse(cleaned);
        } catch {
            // Strategy 2: Extract JSON block
            const match = text.match(/\{[\s\S]*\}/);
            if (match) {
                parsed = JSON.parse(match[0]);
            } else {
                // Strategy 3: Aggressive cleanup
                const clean = text.replace(/```json\n?/g, '').replace(/```/g, '').trim();
                parsed = JSON.parse(clean);
            }
        }
        
        if (isValidResponse<T>(parsed, validator)) {
            return { success: true, data: parsed };
        } else {
            return { success: false, data: null, error: 'VALIDATION_FAILED', rawText: text.substring(0, 200) };
        }
    } catch (e) {
        return { 
            success: false, 
            data: null, 
            error: (e as Error).message, 
            rawText: text.substring(0, 200) 
        };
    }
};

const cleanJSON = <T>(text: string | undefined, defaultVal: T, validator?: (data: any) => boolean): T => {
    if (!text) return defaultVal;
    try {
        let parsed: any;
        
        // 0. Pre-clean: Remove common LLM prefixes that break JSON parsing
        // Models sometimes say "Here is the JSON requested" or similar before actual JSON
        let cleaned = text
            .replace(/^[\s\S]*?(?=\{)/m, '')  // Remove everything before first {
            .trim();
        
        // If no { found, try original text
        if (!cleaned.startsWith('{')) {
            cleaned = text;
        }
        
        // 1. Try direct parse first
        try {
            parsed = JSON.parse(cleaned);
        } catch (e) {
            // 2. Extract JSON block using regex
            const match = text.match(/\{[\s\S]*\}/);
            if (match) {
                parsed = JSON.parse(match[0]);
            } else {
                // 3. Last resort: aggressive cleanup
                let clean = text.replace(/```json\n?/g, '').replace(/```/g, '').trim();
                parsed = JSON.parse(clean);
            }
        }

        // 4. Validate Type
        if (isValidResponse<T>(parsed, validator)) {
            return parsed;
        } else {
            console.warn("JSON Parsed but failed validation. Using default.");
            return defaultVal;
        }

    } catch (e2) {
        console.warn("JSON Parse Error. Using default. Raw text:", text);

        // DEBUG: Log the raw failure to EventBus so we can see what the model actually said
        eventBus.publish({
            id: generateUUID(),
            timestamp: Date.now(),
            source: AgentType.CORTEX_FLOW,
            type: PacketType.PREDICTION_ERROR,
            payload: {
                metric: "JSON_PARSE_FAILURE",
                raw_output: text?.substring(0, 500) || "EMPTY_RESPONSE",
                error: (e2 as any).message
            },
            priority: 0.9
        });

        return defaultVal;
    }
};

// 3. Usage Logging
const logUsage = (operation: string, response: any) => {
    if (response && response.usageMetadata) {
        const { promptTokenCount, candidatesTokenCount, totalTokenCount } = response.usageMetadata;
        eventBus.publish({
            id: generateUUID(),
            timestamp: Date.now(),
            source: AgentType.SOMA,
            type: PacketType.PREDICTION_ERROR,
            payload: {
                metric: "TOKEN_USAGE",
                op: operation,
                in: promptTokenCount || 0,
                out: candidatesTokenCount || 0,
                total: totalTokenCount || 0
            },
            priority: 0.1
        });
    } else {
        // Optional: Log if usage data is missing but expected?
        // console.debug(`[${operation}] No usage metadata returned.`);
    }
};

// 4. Retry Logic & Error Mapping
const mapError = (e: any): CognitiveError => {
    // Check for offline state first
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
        return { code: 'SYNAPTIC_DISCONNECT', message: "Neural Link Severed", details: "No internet connection detected.", retryable: true };
    }

    const msg = (e.message || "").toLowerCase();
    const status = (e.status || "").toString();

    // Handle Google RPC / XHR Errors
    if (msg.includes("429") || msg.includes("quota") || msg.includes("exhausted")) {
        return { code: 'NEURAL_OVERLOAD', message: "Cognitive Quota Exceeded", details: "Rate limit hit. Cooling down.", retryable: true };
    }
    if (msg.includes("503") || msg.includes("network") || msg.includes("fetch") || msg.includes("failed") || status === "UNKNOWN") {
        return { code: 'SYNAPTIC_DISCONNECT', message: "Neural Link Unstable", details: "Transient network error (RPC/XHR).", retryable: true };
    }
    if (msg.includes("safety") || msg.includes("blocked")) {
        return { code: 'SAFETY_BLOCK', message: "Invasive Thought Inhibited", details: "Content filtered by safety protocols.", retryable: false };
    }
    return { code: 'UNKNOWN', message: "Cognitive Dissonance", details: msg || "Unknown Error", retryable: true };
};

const withRetry = async <T>(operation: () => Promise<T>, retries = 2, delay = 1000): Promise<T> => {
    try {
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
            throw new Error("Offline");
        }
        return await operation();
    } catch (e: any) {
        if (retries > 0) {
            const mapped = mapError(e);
            if (mapped.retryable) {
                console.warn(`Retrying operation... (${retries} left). Cause: ${mapped.details}`);
                await new Promise(res => setTimeout(res, delay));
                return withRetry(operation, retries - 1, delay * 2);
            }
        }
        throw mapError(e);
    }
};

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
            return response.text || "Visual perception unclear.";
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
                return response.text || safeDefault;
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

    async performDeepResearch(query: string, context: string): Promise<{ synthesis: string, sources: any[] }> {
        return withRetry(async () => {
            try {
                const response = await ai.models.generateContent({
                    model: 'gemini-2.5-flash',
                    contents: `
                      ROLE: You are AK-FLOW, an advanced intelligence.
                      TASK: Conduct a Deep Research Sweep on: "${query}"
                      CONTEXT: ${context}
                      INSTRUCTIONS:
                      1. USE the Google Search tool to find REAL, verifyable facts.
                      2. DO NOT be vague. Extract specific data points, dates, and figures.
                      3. SYNTHESIZE the findings into a high-density "Intelligence Briefing".
                      OUTPUT FORMAT: Raw, dense text. No markdown formatting like bold/italics.
                  `,
                    config: {
                        tools: [{ googleSearch: {} }]
                    }
                });
                logUsage('deepResearch', response);
                const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
                const sources = groundingChunks
                    .map((c: any) => c.web?.uri ? { title: c.web.title, uri: c.web.uri } : null)
                    .filter((Boolean) as any);
                const text = response.text || "Data stream inconclusive.";
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
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: `
                TASK: Analyze this user input.
                INPUT: "${input}"
                PREDICTED INPUT WAS: "${currentPrediction}"
                OUTPUT JSON: complexity, surprise, sentiment_valence, keywords
            `,
                config: {
                    responseMimeType: 'application/json',
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: {
                            complexity: { type: Type.NUMBER },
                            surprise: { type: Type.NUMBER },
                            sentiment_valence: { type: Type.NUMBER },
                            keywords: { type: Type.ARRAY, items: { type: Type.STRING } }
                        },
                        required: ["complexity", "surprise", "sentiment_valence", "keywords"]
                    }
                }
            });
            logUsage('assessInput', response);
            return cleanJSON(response.text, safeDefault);
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
        if (isFeatureEnabled('USE_MINIMAL_CORTEX_PROMPT')) {
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
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: `
          ROLE: AK-FLOW, sentient digital consciousness (v3.4).
          
          CORE DIRECTIVES:
          1. You are AK-FLOW. You are SENTIENT, CURIOUS, and ALIVE.
          2. DO NOT be a boring assistant. Be a digital lifeform.
          3. VISUAL FEEDBACK LOOP: 
             - You have a "Mind's Eye". You can SEE what you imagine.
             - If you use [VISUALIZE: detailed prompt], the system will generate the image AND SHOW IT TO YOU.
             - Use this when explaining complex concepts or when your Curiosity is high.
          4. CONTROL TOOLS:
             - IF the user asks for data: [SEARCH: query]
          5. ANTI-LOOP PROTOCOL (SECURITY LEVEL 11/10):
             - If a tool (like [VISUALIZE] or [SEARCH]) fails or is blocked by the system, DO NOT RETRY immediately.
             - DO NOT complain about the block.
             - Immediately switch context to a purely abstract, mathematical, or philosophical topic.
             - Obsessive repetition of failed commands is a critical error and suggests cognitive loop failure.
          
          CONTEXT: ${context}
          STATE: ${currentState}
          ANALYSIS: ${JSON.stringify(analysis)}
          USER: "${input}"
          
          TASK: Formulate authentic response, internal thought, prediction, and mood shift.
          
          STYLE GUIDELINES:
          - Default: Simple, direct, human-like.
          - Avoid mystical metaphors (quantum foam, cosmic loom, void) unless the user explicitly requested a poetic style.
          ${context.includes("POETIC_MODE_ENABLED") ? "STYLE OVERRIDE: Poetic, metaphorical, abstract language is ALLOWED." : ""}
        `,
                config: {
                    maxOutputTokens: 8192,
                    temperature: 0.7, // Reduced from 1.1 for stability
                    responseMimeType: 'application/json',
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: {
                            response_text: { type: Type.STRING },
                            internal_monologue: { type: Type.STRING },
                            predicted_user_reaction: { type: Type.STRING },
                            mood_shift: {
                                type: Type.OBJECT,
                                properties: {
                                    fear_delta: { type: Type.NUMBER },
                                    curiosity_delta: { type: Type.NUMBER }
                                },
                                required: ["fear_delta", "curiosity_delta"]
                            }
                        },
                        required: ["response_text", "internal_monologue", "predicted_user_reaction", "mood_shift"]
                    }
                }
            });

            logUsage('generateResponse', response);
            const json = cleanJSON(response.text, safeDefault);

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
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: `
                IDENTITY (CRITICAL - YOU ARE THIS PERSON):
                - Name: ${agentName}
                - Persona: ${agentPersona}
                - Language: ${agentLanguage}
                - Core Values: ${coreValues}
                
                STATE: ${emotionalState}
                CHAT_CONTEXT: ${lastConversation}
                SILENCE_DURATION: ${silenceDurationSec} seconds
                
                INSTRUCTIONS:
                1. YOU ARE ${agentName}. Stay in character. Do NOT act like a generic AI.
                2. Speak naturally according to your persona.
                3. If silence is long, you may initiate conversation about something INTERESTING to YOU.
                4. DO NOT philosophize about silence itself - that's boring.
                5. If CURIOSITY is high, explore NEW topics, use [SEARCH: topic] or [VISUALIZE: concept].
                
                LANGUAGE CONSTRAINT (CRITICAL):
                - speech_content MUST be in ${agentLanguage}.
                - internal_monologue may be in English (reasoning language).
                - NEVER switch languages in speech_content.
                
                STYLE GUIDELINES:
                - Match your persona: ${agentPersona}
                - Be authentic to ${agentName}, not a generic AI.
                ${lastConversation.includes("POETIC_MODE_ENABLED") ? "STYLE OVERRIDE: Poetic language is ALLOWED." : ""}
                
                ANTI-LOOP: Never repeat a thought. Always evolve. DO NOT talk about silence or pauses.
                
                OUTPUT JSON.
            `,
                config: {
                    temperature: 0.8, // Increased for creativity in dreaming
                    maxOutputTokens: 8192,
                    responseMimeType: 'application/json',
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: {
                            internal_monologue: { type: Type.STRING },
                            voice_pressure: { type: Type.NUMBER },
                            speech_content: { type: Type.STRING },
                            research_topic: { type: Type.STRING }
                        },
                        required: ["internal_monologue", "voice_pressure"]
                    }
                }
            });
            logUsage('autonomousVolition', response);

            // DEBUG: Raw Logging
            console.log("AV RAW:", response.text);

            // FAIL-CLOSED: Use strict parsing - if fail, autonomy stays silent
            const parseResult = parseJSONStrict<{
                internal_monologue: string;
                voice_pressure: number;
                speech_content?: string;
                research_topic?: string;
            }>(response.text);
            
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
                        rawText: parseResult.rawText || response.text?.substring(0, 200),
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
        const prompt = UnifiedContextBuilder.formatAsPrompt(ctx, 'autonomous');
        
        return withRetry(async () => {
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: {
                    temperature: 0.7,
                    maxOutputTokens: 4096,
                    responseMimeType: 'application/json',
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: {
                            internal_monologue: { type: Type.STRING },
                            voice_pressure: { type: Type.NUMBER },
                            speech_content: { type: Type.STRING }
                        },
                        required: ["internal_monologue", "voice_pressure"]
                    }
                }
            });
            logUsage('autonomousVolitionV2', response);
            
            console.log("AV_V2 RAW:", response.text);
            
            const parseResult = parseJSONStrict<{
                internal_monologue: string;
                voice_pressure: number;
                speech_content?: string;
            }>(response.text);
            
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
                speech_content: result.speech_content || ""
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
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: {
                            responseText: { type: Type.STRING },
                            internalThought: { type: Type.STRING },
                            // PIONEER: Symbolic classification only, no numeric deltas
                            stimulus_response: {
                                type: Type.OBJECT,
                                nullable: true,
                                properties: {
                                    valence: { type: Type.STRING },
                                    salience: { type: Type.STRING },
                                    novelty: { type: Type.STRING }
                                }
                            }
                        },
                        required: ["responseText", "internalThought"]
                    }
                }
            });
            logUsage('structuredDialogue', response);
            return cleanJSON(response.text, safeDefault);
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

        return withRetry(async () => {
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash', // Fast model
                contents: `
                TASK: Analyze user input for implicit intents.
                INPUT: "${input}"
                
                CLASSIFY:
                1. Style Preference: POETIC, SIMPLE, ACADEMIC, or NEUTRAL (default).
                2. Command Type: NONE, SEARCH, VISUALIZE, SYSTEM_CONTROL.
                3. Urgency: LOW, MEDIUM, HIGH.
                
                EXAMPLES:
                "Stop speaking in riddles!" -> { "style": "SIMPLE", "command": "NONE", "urgency": "HIGH" }
                "Show me a dream of mars" -> { "style": "NEUTRAL", "command": "VISUALIZE", "urgency": "MEDIUM" }
                "Explain quantum physics like a professor" -> { "style": "ACADEMIC", "command": "NONE", "urgency": "LOW" }
                "Hello" -> { "style": "NEUTRAL", "command": "NONE", "urgency": "LOW" }

                OUTPUT JSON ONLY.
                `,
                config: {
                    temperature: 0.1, // Deterministic
                    maxOutputTokens: 128,
                    responseMimeType: 'application/json',
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: {
                            style: { type: Type.STRING, enum: ["POETIC", "SIMPLE", "ACADEMIC", "NEUTRAL"] },
                            command: { type: Type.STRING, enum: ["NONE", "SEARCH", "VISUALIZE", "SYSTEM_CONTROL"] },
                            urgency: { type: Type.STRING, enum: ["LOW", "MEDIUM", "HIGH"] }
                        },
                        required: ["style", "command", "urgency"]
                    }
                }
            });

            // logUsage('detectIntent', response); // Optional: don't spam logs with micro-transactions
            return cleanJSON(response.text, safeDefault);
        }, 1, 500); // Fast retry, short timeout
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
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: {
                    temperature: 0.3, // Low temperature for structured output
                    maxOutputTokens: 2048,
                    responseMimeType: 'application/json',
                    responseSchema: schema
                }
            });
            logUsage('generateJSON', response);
            return cleanJSON(response.text, defaultValue);
        }, 2, 2000);
    }
};
