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
import { eventBus } from '../EventBus';
import { AgentType, PacketType } from '../../types';
import { generateUUID } from '../../utils/uuid';

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

/**
 * Parsuje odpowiedź JSON z LLM
 */
function parseResponse(text: string | undefined): CortexOutput {
  if (!text) {
    console.warn('[CortexInference] Empty response');
    return { ...FALLBACK_CORTEX_OUTPUT };
  }

  try {
    // Próbuj bezpośredni parse
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      // Wyciągnij JSON z markdown
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        parsed = JSON.parse(match[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    }

    if (isValidCortexOutput(parsed)) {
      return parsed;
    }

    console.warn('[CortexInference] Invalid output structure');
    return { ...FALLBACK_CORTEX_OUTPUT };
  } catch (error) {
    console.error('[CortexInference] Parse error:', error);

    // Log parse failure
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

    return { ...FALLBACK_CORTEX_OUTPUT };
  }
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

  // Buduj pełny prompt
  const fullPrompt = `${MINIMAL_CORTEX_SYSTEM_PROMPT}

INPUT STATE:
${stateJson}

INSTRUCTIONS:
1. Analyze the input state and the user's intent.
2. Generate your response strictly as a VALID JSON object.
3. DO NOT include any text before or after the JSON.
4. DO NOT use markdown code blocks like \`\`\`json.
5. Just raw JSON.`;

  return withRetry(async () => {
    const genAI = getAI();

    const response = await genAI.models.generateContent({
      model: cfg.model!,
      contents: fullPrompt,
      config: {
        temperature: cfg.temperature,
        maxOutputTokens: cfg.maxOutputTokens,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            internal_thought: { type: Type.STRING },
            speech_content: { type: Type.STRING },
            mood_shift: {
              type: Type.OBJECT,
              properties: {
                energy_delta: { type: Type.NUMBER },
                confidence_delta: { type: Type.NUMBER },
                stress_delta: { type: Type.NUMBER }
              },
              required: ['energy_delta', 'confidence_delta', 'stress_delta']
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
            }
          },
          required: ['internal_thought', 'speech_content', 'mood_shift']
        }
      }
    });

    logUsage('generateFromCortexState', response);
    return parseResponse(response.text);
  }, cfg.retries!, cfg.retryDelayMs!);
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
            mood_shift: {
              type: Type.OBJECT,
              properties: {
                energy_delta: { type: Type.NUMBER },
                confidence_delta: { type: Type.NUMBER },
                stress_delta: { type: Type.NUMBER }
              },
              required: ['energy_delta', 'confidence_delta', 'stress_delta']
            }
          },
          required: ['internal_thought', 'speech_content', 'mood_shift']
        }
      }
    });

    logUsage('generateWithSearch', response);

    // Extract sources
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const sources = groundingChunks
      .map((c: any) => c.web?.uri ? { title: c.web.title || '', uri: c.web.uri } : null)
      .filter(Boolean) as Array<{ title: string; uri: string }>;

    const output = parseResponse(response.text);
    return { ...output, sources };
  }, cfg.retries!, cfg.retryDelayMs!);
}
