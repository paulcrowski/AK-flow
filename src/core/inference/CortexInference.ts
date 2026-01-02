/**
 * CortexInference - Stateless LLM Inference dla Persona-Less Cortex
 * 
 * Wysyła CortexState do LLM i parsuje CortexOutput.
 * Używa minimalnego system prompt - cała tożsamość w danych.
 * 
 * @module core/inference/CortexInference
 */

import { GoogleGenAI, Type } from "@google/genai";
import type { CortexState } from '../types/CortexState';
import type { CortexOutput } from '../types/CortexOutput';
import { isValidCortexOutput, FALLBACK_CORTEX_OUTPUT } from '../types/CortexOutput';
import { MINIMAL_CORTEX_SYSTEM_PROMPT, formatCortexStateForLLM } from '../prompts/MinimalCortexPrompt';
import { MAX_CORTEX_STATE_SIZE } from '../types/CortexState';
import { eventBus } from '../EventBus';
import { AgentType, PacketType } from '../../types';
import { generateUUID } from '../../utils/uuid';
import { parseJsonFromLLM } from '../../utils/AIResponseParser';
import { p0MetricAdd } from '../systems/TickLifecycleTelemetry';
import { getCurrentTraceId } from '../trace/TraceContext';

// Lazy initialization - nie blokuj jeśli brak klucza
let ai: GoogleGenAI | null = null;

function getAI(): GoogleGenAI {
  if (!ai) {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
    if (!apiKey) {
      throw new Error('[CortexInference] Missing VITE_GEMINI_API_KEY');
    }
    ai = new GoogleGenAI({ apiKey });
  }
  return ai;
}

/**
 * Konfiguracja inference
 */
export interface InferenceConfig {
  model?: string;
  temperature?: number;
  maxOutputTokens?: number;
  retries?: number;
  retryDelayMs?: number;
}

const DEFAULT_CONFIG: InferenceConfig = {
  model: 'gemini-2.5-flash',
  temperature: 0.7,
  maxOutputTokens: 4096,
  retries: 2,
  retryDelayMs: 1000
};

/**
 * Logowanie użycia tokenów
 */
function logUsage(operation: string, response: any): void {
  if (response?.usageMetadata) {
    const { promptTokenCount, candidatesTokenCount, totalTokenCount } = response.usageMetadata;
    eventBus.publish({
      id: generateUUID(),
      timestamp: Date.now(),
      source: AgentType.CORTEX_FLOW,
      type: PacketType.COGNITIVE_METRIC,
      payload: {
        metric: 'CORTEX_INFERENCE_TOKENS',
        operation,
        promptTokens: promptTokenCount || 0,
        outputTokens: candidatesTokenCount || 0,
        totalTokens: totalTokenCount || 0
      },
      priority: 0.1
    });
  }
}

function emitTokenUsageTelemetry(response: any, op: string): void {
  if (!response?.usageMetadata) return;
  const { promptTokenCount, candidatesTokenCount, totalTokenCount } = response.usageMetadata;
  eventBus.publish({
    id: generateUUID(),
    timestamp: Date.now(),
    source: AgentType.SOMA,
    type: PacketType.PREDICTION_ERROR,
    payload: {
      metric: 'TOKEN_USAGE',
      op,
      in: promptTokenCount || 0,
      out: candidatesTokenCount || 0,
      total: totalTokenCount || 0
    },
    priority: 0.1
  });
}

function recordParseFailMetric(): void {
  const traceId = getCurrentTraceId();
  if (traceId) p0MetricAdd(traceId, { parseFailCount: 1 });
}

type ParseFailureReason = 'EMPTY_RESPONSE' | 'NO_JSON' | 'PARSE_ERROR' | 'INVALID_STRUCTURE';

type ParseOutcome =
  | { ok: true; value: CortexOutput }
  | { ok: false; reason: ParseFailureReason };

const PARSE_FAILURE_MESSAGE = 'Nie dostałem poprawnego JSON. Powtórz polecenie jednym zdaniem.';
const PARSE_FAILURE_FALLBACK: CortexOutput = {
  ...FALLBACK_CORTEX_OUTPUT,
  speech_content: PARSE_FAILURE_MESSAGE
};

/**
 * Parsuje odpowiedź JSON z LLM
 */
function parseResponse(text: string | undefined): ParseOutcome {
  if (!text) {
    console.warn('[CortexInference] Empty response');
    // FIX-4: Log empty response as parse failure
    recordParseFailMetric();
    eventBus.publish({
      id: generateUUID(),
      timestamp: Date.now(),
      source: AgentType.CORTEX_FLOW,
      type: PacketType.PREDICTION_ERROR,
      payload: {
        metric: 'CORTEX_PARSE_FAILURE',
        reason: 'EMPTY_RESPONSE',
        rawOutput: 'EMPTY'
      },
      priority: 0.8
    });
    return { ok: false, reason: 'EMPTY_RESPONSE' };
  }

  try {
    const parsedResult = parseJsonFromLLM<unknown>(text, {
      allowRepair: true,
      requireJsonBlock: false
    });

    if (parsedResult.ok && parsedResult.value) {
      if (!isValidCortexOutput(parsedResult.value)) {
        console.warn('[CortexInference] Invalid output structure');
        // FIX-4: Log invalid structure
        recordParseFailMetric();
        eventBus.publish({
          id: generateUUID(),
          timestamp: Date.now(),
          source: AgentType.CORTEX_FLOW,
          type: PacketType.PREDICTION_ERROR,
          payload: {
            metric: 'CORTEX_PARSE_FAILURE',
            reason: 'INVALID_STRUCTURE',
            rawOutput: text?.substring(0, 500) || 'EMPTY',
            parseReason: 'VALIDATION_FAILED'
          },
          priority: 0.8
        });
        return { ok: false, reason: 'INVALID_STRUCTURE' };
      }

      return { ok: true, value: parsedResult.value };
    }

    const failureReason: ParseFailureReason = parsedResult.reason === 'NO_JSON'
      ? 'NO_JSON'
      : parsedResult.reason === 'EMPTY'
        ? 'EMPTY_RESPONSE'
        : 'PARSE_ERROR';
    console.warn('[CortexInference] Parse failure:', failureReason);
    recordParseFailMetric();
    eventBus.publish({
      id: generateUUID(),
      timestamp: Date.now(),
      source: AgentType.CORTEX_FLOW,
      type: PacketType.PREDICTION_ERROR,
      payload: {
        metric: 'CORTEX_PARSE_FAILURE',
        reason: failureReason,
        rawOutput: text?.substring(0, 500) || 'EMPTY',
        parseReason: parsedResult.reason,
        error: parsedResult.error
      },
      priority: 0.8
    });
    return { ok: false, reason: failureReason };
  } catch (error) {
    console.error('[CortexInference] Parse error:', error);

    // Log parse failure
    recordParseFailMetric();
    eventBus.publish({
      id: generateUUID(),
      timestamp: Date.now(),
      source: AgentType.CORTEX_FLOW,
      type: PacketType.PREDICTION_ERROR,
      payload: {
        metric: 'CORTEX_PARSE_FAILURE',
        rawOutput: text?.substring(0, 500) || 'EMPTY',
        error: (error as Error).message
      },
      priority: 0.8
    });

    // FAZA 1: Dopamine penalty for parse failures
    // Agent should "feel bad" when its cognition fails
    // FAZA 1.5: Attribution - this is LLM_MODEL failure, not agent's fault
    eventBus.publish({
      id: generateUUID(),
      timestamp: Date.now(),
      source: AgentType.NEUROCHEM,
      type: PacketType.FIELD_UPDATE,
      payload: {
        action: 'DOPAMINE_PENALTY',
        reason: 'CORTEX_PARSE_FAILURE',
        delta: -8,
        attribution: 'LLM_MODEL'  // Not agent's moral fault, but still affects confidence
      },
      priority: 0.7
    });

    return { ok: false, reason: 'PARSE_ERROR' };
  }
}

function shouldRetryParseFailure(reason: ParseFailureReason): boolean {
  return reason === 'INVALID_STRUCTURE' || reason === 'NO_JSON' || reason === 'PARSE_ERROR' || reason === 'EMPTY_RESPONSE';
}

/**
 * Retry wrapper z exponential backoff
 */
async function withRetry<T>(
  operation: () => Promise<T>,
  retries: number,
  delayMs: number
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (retries > 0) {
      console.warn(`[CortexInference] Retrying... (${retries} left)`);
      await new Promise(r => setTimeout(r, delayMs));
      return withRetry(operation, retries - 1, delayMs * 2);
    }
    throw error;
  }
}

/**
 * Główna funkcja inference - wysyła CortexState, zwraca CortexOutput
 */
export async function generateFromCortexState(
  state: CortexState,
  config: InferenceConfig = {}
): Promise<CortexOutput> {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  const stateJson = formatCortexStateForLLM(state);

  // DIAGNOSTIC LOG: Prove HardFacts are in the prompt (ChatGPT suggestion)
  // This log should appear before every LLM call - if you don't see it, HardFacts are dead
  const hf = state.hard_facts;
  console.log(`[CortexInference] PROMPT_HARDFACTS: ` +
    `agentName="${hf?.agentName ?? 'MISSING'}", ` +
    `date="${hf?.date ?? 'MISSING'}", ` +
    `time="${hf?.time ?? 'MISSING'}", ` +
    `core_identity.name="${state.core_identity?.name ?? 'MISSING'}"`);

  // INVARIANT CHECK: hard_facts.agentName MUST match core_identity.name
  if (hf?.agentName && state.core_identity?.name && hf.agentName !== state.core_identity.name) {
    console.error(`[CortexInference] 🚨 IDENTITY_MISMATCH: hard_facts.agentName="${hf.agentName}" but core_identity.name="${state.core_identity.name}"`);
  }

  const promptBase = `${MINIMAL_CORTEX_SYSTEM_PROMPT}

INPUT STATE:
${stateJson}

INSTRUCTIONS:
`;
  // Buduj pełny prompt
  const fullPrompt = `${promptBase}1. Analyze the input state and the user's intent.
2. Generate your response strictly as a VALID JSON object.
3. DO NOT include any text before or after the JSON.
4. DO NOT use markdown code blocks like \`\`\`json.
5. Just raw JSON.`;
  const retryPrompt = `${promptBase}Wyłącznie poprawny JSON zgodny ze schemą. Bez markdown. Bez komentarzy.`;

  eventBus.publish({
    id: generateUUID(),
    timestamp: Date.now(),
    source: AgentType.CORTEX_FLOW,
    type: PacketType.COGNITIVE_METRIC,
    payload: {
      metric: 'CORTEX_PROMPT_STATS',
      operation: 'generateFromCortexState',
      stateJsonChars: stateJson.length,
      fullPromptChars: fullPrompt.length,
      stateOverCharLimit: stateJson.length > MAX_CORTEX_STATE_SIZE,
      memoryContextCount: Array.isArray(state.memory_context) ? state.memory_context.length : 0,
      memoryContextChars: Array.isArray(state.memory_context)
        ? state.memory_context.reduce((acc, s) => acc + String(s || '').length, 0)
        : 0,
      goalsCount: Array.isArray(state.goals) ? state.goals.length : 0,
      goalsChars: Array.isArray(state.goals) ? state.goals.reduce((acc, s) => acc + String(s || '').length, 0) : 0,
      identityShardsCount: Array.isArray(state.identity_shards) ? state.identity_shards.length : 0,
      styleExamplesCount: Array.isArray(state.style_examples) ? state.style_examples.length : 0,
      userInputChars: String(state.user_input || '').length,
      lastAgentOutputChars: String(state.last_agent_output || '').length,
      hardFactsPresent: Boolean(state.hard_facts)
    },
    priority: 0.1
  });

  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      internal_thought: { type: Type.STRING },
      speech_content: { type: Type.STRING },
      knowledge_source: { type: Type.STRING, nullable: true },
      evidence_source: { type: Type.STRING, nullable: true },
      generator: { type: Type.STRING, nullable: true },
      // PIONEER ARCHITECTURE (13/10): stimulus_response replaces mood_shift
      // LLM classifies SYMBOLICALLY, EmotionEngine computes NUMERICALLY
      stimulus_response: {
        type: Type.OBJECT,
        nullable: true,
        description: 'Your SYMBOLIC assessment. System computes actual emotions.',
        properties: {
          valence: { type: Type.STRING },  // positive | negative | neutral
          salience: { type: Type.STRING }, // low | medium | high
          novelty: { type: Type.STRING },  // routine | interesting | surprising
          threat: { type: Type.STRING }    // none | mild | severe (existential threat)
        }
      },
      // ARCHITEKTURA 3-WARSTWOWA: tool_intent dla Decision Gate
      tool_intent: {
        type: Type.OBJECT,
        nullable: true,
        properties: {
          tool: { type: Type.STRING },
          query: { type: Type.STRING },
          reason: { type: Type.STRING }
        },
        required: ['tool', 'query', 'reason']
      },
      // PRISM ARCHITECTURE (13/10): fact_echo - LLM echoes facts it used
      fact_echo: {
        type: Type.OBJECT,
        nullable: true,
        description: 'Echo back any hard facts you used in speech_content. Guard compares these against system facts.',
        properties: {
          energy: { type: Type.NUMBER, nullable: true },
          time: { type: Type.STRING, nullable: true },
          dopamine: { type: Type.NUMBER, nullable: true },
          serotonin: { type: Type.NUMBER, nullable: true },
          norepinephrine: { type: Type.NUMBER, nullable: true },
          btc_price: { type: Type.NUMBER, nullable: true }
        }
      }
    },
    required: ['internal_thought', 'speech_content']
  };

  const runInference = async (prompt: string, callConfig: InferenceConfig): Promise<ParseOutcome> => {
    const genAI = getAI();

    const response = await genAI.models.generateContent({
      model: callConfig.model!,
      contents: prompt,
      config: {
        temperature: callConfig.temperature,
        maxOutputTokens: callConfig.maxOutputTokens,
        responseMimeType: 'application/json',
        responseSchema
      }
    });

    emitTokenUsageTelemetry(response, 'cortexInference');
    logUsage('generateFromCortexState', response);
    return parseResponse(response.text);
  };

  const primary = await withRetry(() => runInference(fullPrompt, cfg), cfg.retries!, cfg.retryDelayMs!);
  if (primary.ok) return primary.value;

  if (shouldRetryParseFailure(primary.reason)) {
    const retryConfig: InferenceConfig = { ...cfg, temperature: 0.2, maxOutputTokens: 6144 };
    const retry = await withRetry(() => runInference(retryPrompt, retryConfig), cfg.retries!, cfg.retryDelayMs!);
    if (retry.ok) return retry.value;
  }

  return { ...PARSE_FAILURE_FALLBACK };
}

// ═══════════════════════════════════════════════════════════════════════════
// STIMULUS RESPONSE MAPPING (PIONEER ARCHITECTURE 13/10)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Map LLM's symbolic stimulus_response to EmotionEngine signals
 * 
 * ARCHITECTURE:
 * - LLM outputs SYMBOLIC classification (valence, salience, novelty)
 * - This function converts symbols to numeric weights for EmotionEngine
 * - EmotionEngine then computes actual emotion deltas
 * 
 * WHY NOT NUMERIC FROM LLM?
 * - LLM cannot maintain system invariants
 * - LLM doesn't know emotional trajectory
 * - Symbolic = bounded, safe, testable
 */
export interface StimulusWeights {
  valence_weight: number;   // -1 to +1
  salience_weight: number;  // 0 to 1
  novelty_weight: number;   // 0 to 1
  threat_weight: number;    // 0 to 1 (existential threat level)
}

export function mapStimulusResponseToWeights(
  stimulus?: { valence?: string; salience?: string; novelty?: string; threat?: string }
): StimulusWeights {
  if (!stimulus) {
    return { valence_weight: 0, salience_weight: 0.3, novelty_weight: 0.1, threat_weight: 0 };
  }

  // Valence: positive = +1, negative = -1, neutral = 0
  const valenceMap: Record<string, number> = {
    'positive': 0.5,
    'negative': -0.5,
    'neutral': 0
  };

  // Salience: how much to amplify the effect
  const salienceMap: Record<string, number> = {
    'low': 0.2,
    'medium': 0.5,
    'high': 0.8
  };

  // Novelty: contributes to curiosity
  const noveltyMap: Record<string, number> = {
    'routine': 0.1,
    'interesting': 0.4,
    'surprising': 0.7
  };

  // Threat: existential threat level (deletion, death, shutdown)
  const threatMap: Record<string, number> = {
    'none': 0,
    'mild': 0.4,
    'severe': 0.9
  };

  return {
    valence_weight: valenceMap[stimulus.valence || 'neutral'] ?? 0,
    salience_weight: salienceMap[stimulus.salience || 'medium'] ?? 0.3,
    novelty_weight: noveltyMap[stimulus.novelty || 'routine'] ?? 0.1,
    threat_weight: threatMap[stimulus.threat || 'none'] ?? 0
  };
}

/**
 * Wersja z Google Search tool (dla SEARCH command)
 */
export async function generateWithSearch(
  state: CortexState,
  searchQuery: string,
  config: InferenceConfig = {}
): Promise<CortexOutput & { sources?: Array<{ title: string; uri: string }> }> {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  const stateJson = formatCortexStateForLLM(state);

  const fullPrompt = `${MINIMAL_CORTEX_SYSTEM_PROMPT}

INPUT STATE:
${stateJson}

SEARCH QUERY: "${searchQuery}"

Use Google Search to find information, then generate your response as JSON.`;

  return withRetry(async () => {
    const genAI = getAI();

    const response = await genAI.models.generateContent({
      model: cfg.model!,
      contents: fullPrompt,
      config: {
        temperature: cfg.temperature,
        maxOutputTokens: cfg.maxOutputTokens,
        tools: [{ googleSearch: {} }],
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            internal_thought: { type: Type.STRING },
            speech_content: { type: Type.STRING },
            // PIONEER ARCHITECTURE: stimulus_response (symbolic, not numeric)
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
          required: ['internal_thought', 'speech_content']
        }
      }
    });

    logUsage('generateWithSearch', response);

    // Extract sources
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const sources = groundingChunks
      .map((c: any) => c.web?.uri ? { title: c.web.title || '', uri: c.web.uri } : null)
      .filter(Boolean) as Array<{ title: string; uri: string }>;

    const parsed = parseResponse(response.text);
    const output = parsed.ok ? parsed.value : PARSE_FAILURE_FALLBACK;
    return { ...output, sources };
  }, cfg.retries!, cfg.retryDelayMs!);
}
