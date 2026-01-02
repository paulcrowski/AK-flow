import { Type } from '@google/genai';
import type { GoogleGenAI } from '@google/genai';

import { AgentType, PacketType, CognitiveError, DetectedIntent } from '../../types';
import { getCurrentAgentId } from '../../services/supabase';
import { isCortexSubEnabled, isMainFeatureEnabled } from '../../core/config/featureFlags';
import { buildMinimalCortexState } from '../../core/builders';
import { generateFromCortexState } from '../../core/inference';
import { guardLegacyResponse, isPrismEnabled } from '../../core/systems/PrismPipeline';
import { guardLegacyWithFactEcho, isFactEchoPipelineEnabled } from '../../core/systems/FactEchoPipeline';
import { UnifiedContextBuilder, type UnifiedContext } from '../../core/context';
import { applyAutonomyV2RawContract } from '../../core/systems/RawContract';
import { parseDetectedIntent } from '../../core/systems/IntentContract';
import { clamp01 } from '../../utils/math';
import { eventBus } from '../../core/EventBus';
import { getCurrentTraceId } from '../../core/trace/TraceContext';
import { p0MetricAdd } from '../../core/systems/TickLifecycleTelemetry';
import { generateUUID } from '../../utils/uuid';

import { generateWithFallback } from './generateWithFallback';
import { getGeminiText, getGeminiTextWithSource } from './text';
import { cleanJSON, parseJSONStrict } from './json';
import { mapError, withRetry } from './retry';
import { logUsage } from './usage';

import { buildAssessInputPrompt } from './prompts/assessInputPrompt';
import { buildDeepResearchPrompt } from './prompts/deepResearchPrompt';
import { buildGenerateResponsePrompt } from './prompts/generateResponsePrompt';
import { buildAutonomousVolitionPrompt } from './prompts/autonomousVolitionPrompt';
import { buildDetectIntentPrompts } from './prompts/detectIntentPrompt';

import { DETECT_INTENT_RESPONSE_SCHEMA } from './detectIntentSchema';
import {
  ASSESS_INPUT_RESPONSE_SCHEMA,
  AUTONOMOUS_VOLITION_RESPONSE_SCHEMA,
  AUTONOMOUS_VOLITION_V2_RESPONSE_SCHEMA,
  AUTONOMOUS_VOLITION_V2_MICRO_RESPONSE_SCHEMA,
  GENERATE_RESPONSE_RESPONSE_SCHEMA,
  STRUCTURED_DIALOGUE_RESPONSE_SCHEMA
} from './responseSchemas';

const EMBEDDING_BASE_COOLDOWN_MS = 30_000;
const EMBEDDING_MAX_COOLDOWN_MS = 5 * 60_000;
let embeddingCooldownUntil = 0;
let embeddingFailureCount = 0;
let embeddingSuccessCount = 0;
let embeddingFailCount = 0;
let embeddingLastErrorCode: string | null = null;
const EMBEDDINGS_STATUS_EVENT = 'EMBEDDINGS_STATUS';

type GenerateResponseDefaults = {
  response_text: string;
  internal_monologue: string;
  predicted_user_reaction: string;
  mood_shift: { fear_delta: number; curiosity_delta: number };
};

type GenerateResponseOutput = {
  text: string;
  thought: string;
  prediction: string;
  moodShift: { fear_delta: number; curiosity_delta: number };
};

type AutonomyV2Output = {
  internal_monologue: string;
  voice_pressure: number;
  speech_content: string;
};

type AutonomyV2ParseFailure = {
  reason?: string;
  details?: string;
};

type AutonomyV2ParseResult = {
  ok: boolean;
  output: AutonomyV2Output;
  failure?: AutonomyV2ParseFailure;
};

export function createCortexTextService(ai: GoogleGenAI) {
  const embeddingsEnabled = Boolean((ai as any)?.models?.embedContent);
  const emitEmbeddingsStatus = () => {
    const now = Date.now();
    eventBus.publish({
      id: generateUUID(),
      traceId: getCurrentTraceId() ?? undefined,
      timestamp: now,
      source: AgentType.CORTEX_FLOW,
      type: PacketType.SYSTEM_ALERT,
      payload: {
        event: EMBEDDINGS_STATUS_EVENT,
        enabled: embeddingsEnabled,
        cooldownActive: now < embeddingCooldownUntil,
        cooldownUntil: embeddingCooldownUntil,
        lastErrorCode: embeddingLastErrorCode,
        successCount: embeddingSuccessCount,
        failCount: embeddingFailCount
      },
      priority: 0.2
    });
  };

  const formatEmbeddingErrorCode = (err: any) => {
    if (!err) return 'unknown';
    const code = err.code || err.status || err.name || err.message || 'unknown';
    return String(code).slice(0, 120);
  };

  const buildGenerateResponsePromptPayload = (params: {
    input: string;
    context: string;
    currentState: string;
    analysis: any;
  }): string => {
    return buildGenerateResponsePrompt({
      context: params.context,
      currentState: params.currentState,
      analysis: params.analysis,
      userInput: params.input
    });
  };

  const parseGenerateResponsePayload = (
    response: any,
    safeDefault: GenerateResponseDefaults
  ): GenerateResponseOutput => {
    const json = cleanJSON(getGeminiText(response), safeDefault, undefined, 'generateResponse');
    return {
      text: json.response_text || safeDefault.response_text,
      thought: json.internal_monologue || safeDefault.internal_monologue,
      prediction: json.predicted_user_reaction || safeDefault.predicted_user_reaction,
      moodShift: json.mood_shift || safeDefault.mood_shift
    };
  };

  const runGenerateResponseStandard = async (params: {
    input: string;
    context: string;
    currentState: string;
    analysis: any;
    safeDefault: GenerateResponseDefaults;
  }): Promise<GenerateResponseOutput> => {
    return withRetry(async () => {
      const prompt = buildGenerateResponsePromptPayload(params);
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          maxOutputTokens: 8192,
          temperature: 0.7,
          responseMimeType: 'application/json',
          responseSchema: GENERATE_RESPONSE_RESPONSE_SCHEMA
        }
      });

      logUsage('generateResponse', response);
      return parseGenerateResponsePayload(response, params.safeDefault);
    });
  };

  const runGenerateResponseMinimal = async (params: {
    input: string;
    context: string;
    analysis: any;
  }): Promise<GenerateResponseOutput> => {
    return withRetry(async () => {
      const agentId = getCurrentAgentId();
      if (!agentId) throw new Error('Agent ID missing for Cortex flow');

      const contextMock = params.context.split('\n').slice(-3);

      const limbicState = params.analysis && typeof params.analysis === 'object' ? params.analysis : {
        satisfaction: 0.5,
        frustration: 0.1
      };

      const state = await buildMinimalCortexState({
        agentId: agentId,
        userInput: params.input,
        recentContext: contextMock,
        metaStates: {
          energy: 70,
          confidence: (limbicState.satisfaction || 0.5) * 100,
          stress: (limbicState.frustration || 0.1) * 100
        }
      });

      const output = await generateFromCortexState(state);

      const legacyResponse = {
        text: output.speech_content,
        thought: output.internal_thought,
        prediction: 'User is observing.',
        moodShift: { fear_delta: 0, curiosity_delta: 0 }
      };

      let guardedResponse = legacyResponse;

      if (isFactEchoPipelineEnabled()) {
        const guarded = guardLegacyWithFactEcho(guardedResponse, output.fact_echo, {
          agentName: state.core_identity?.name || 'Jesse'
        });
        guardedResponse = guarded.output;
      }

      if (isPrismEnabled()) {
        const guarded = guardLegacyResponse(guardedResponse, {
          agentName: state.core_identity?.name || 'Jesse'
        });
        guardedResponse = guarded.output;
      }

      return guardedResponse;
    });
  };

  const buildAutonomyV2Prompt = (ctx: UnifiedContext): string => {
    return isCortexSubEnabled('unifiedContextPrompt')
      ? UnifiedContextBuilder.formatAsPrompt(ctx, 'autonomous')
      : UnifiedContextBuilder.formatAsPrompt(ctx, 'autonomous');
  };

  const buildAutonomyV2MicroPrompt = (basePrompt: string): string => {
    return [
      basePrompt,
      '',
      'Return ONLY minimal JSON.',
      'Keys: speech_content (string), voice_pressure (number), internal_monologue (optional).',
      'Keep speech_content under 280 chars and internal_monologue under 120 chars.',
      'No markdown, no extra text.'
    ].join('\n');
  };

  const parseAutonomyV2Response = (rawText: string | undefined): AutonomyV2ParseResult => {
    if (isMainFeatureEnabled('ONE_MIND_ENABLED')) {
      const contracted = applyAutonomyV2RawContract(rawText, {
        maxRawLen: 20000,
        maxInternalMonologueLen: 1200,
        maxSpeechLen: 1200
      });

      if (!contracted.ok) {
        return {
          ok: false,
          output: {
            internal_monologue: `[RAW_CONTRACT_FAIL] ${contracted.reason || 'UNKNOWN'}`,
            voice_pressure: 0,
            speech_content: ''
          },
          failure: {
            reason: contracted.reason,
            details: contracted.details
          }
        };
      }

      const v = contracted.value;
      return {
        ok: true,
        output: {
          internal_monologue: v.internal_monologue || 'Thinking... ',
          voice_pressure: clamp01(v.voice_pressure ?? 0),
          speech_content: (v.speech_content || '').slice(0, 1200)
        }
      };
    }

    const parseResult = parseJSONStrict<{
      internal_monologue: string;
      voice_pressure: number;
      speech_content?: string;
    }>(rawText);

    if (!parseResult.success || !parseResult.data) {
      return {
        ok: false,
        output: {
          internal_monologue: `[PARSE_FAIL] ${parseResult.error}`,
          voice_pressure: 0,
          speech_content: ''
        },
        failure: {
          reason: 'JSON_PARSE_ERROR',
          details: parseResult.error
        }
      };
    }

    const result = parseResult.data;
    console.log('AV_V2 PARSED:', result);

    return {
      ok: true,
      output: {
        internal_monologue: result.internal_monologue || 'Thinking...',
        voice_pressure: result.voice_pressure ?? 0.0,
        speech_content: (result.speech_content || '').slice(0, 1200)
      }
    };
  };

  const shouldRetryAutonomyV2 = (failure?: AutonomyV2ParseFailure) => {
    if (!failure) return false;
    if (failure.reason !== 'JSON_PARSE_ERROR') return false;
    return String(failure.details || '').includes('NO_BALANCED_JSON_BLOCK');
  };

  const publishAutonomyV2ParseFail = (params: {
    failure?: AutonomyV2ParseFailure;
    rawText?: string;
    attempt?: 'primary' | 'micro';
  }) => {
    const traceId = getCurrentTraceId();
    if (traceId) p0MetricAdd(traceId, { parseFailCount: 1 });
    eventBus.publish({
      id: generateUUID(),
      traceId: traceId || undefined,
      timestamp: Date.now(),
      source: AgentType.CORTEX_FLOW,
      type: PacketType.SYSTEM_ALERT,
      payload: {
        event: 'P0_PARSE_FAIL',
        stage: params.attempt === 'micro' ? 'AUTONOMY_V2_MICRO' : 'AUTONOMY_V2',
        reason: params.failure?.reason,
        details: params.failure?.details,
        raw_len: String(params.rawText || '').length,
        raw_preview: String(params.rawText || '').slice(0, 120),
        model: 'gemini-2.5-flash'
      },
      priority: 0.7
    });
  };

  const callAutonomyV2 = async (params: {
    prompt: string;
    schema: Record<string, unknown>;
    maxOutputTokens: number;
    usageTag: string;
    logLabel: string;
  }): Promise<{ rawText?: string; parsed: AutonomyV2ParseResult }> => {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: params.prompt,
      config: {
        temperature: 0.7,
        maxOutputTokens: params.maxOutputTokens,
        responseMimeType: 'application/json',
        responseSchema: params.schema
      }
    });
    logUsage(params.usageTag, response);

    const rawText = getGeminiText(response) ?? undefined;
    const rawForLog = (rawText || '').slice(0, 2000);
    console.log(`${params.logLabel}:`, rawForLog);

    return { rawText, parsed: parseAutonomyV2Response(rawText) };
  };

  const runAutonomyV2WithRetry = async (prompt: string): Promise<AutonomyV2Output> => {
    return withRetry(async () => {
      const primary = await callAutonomyV2({
        prompt,
        schema: AUTONOMOUS_VOLITION_V2_RESPONSE_SCHEMA,
        // FIX-5: Increased from 1536 to prevent NO_BALANCED_JSON_BLOCK truncation errors
        maxOutputTokens: 2048,
        usageTag: 'autonomousVolitionV2',
        logLabel: 'AV_V2 RAW'
      });

      if (primary.parsed.ok) return primary.parsed.output;

      if (shouldRetryAutonomyV2(primary.parsed.failure)) {
        const microPrompt = buildAutonomyV2MicroPrompt(prompt);
        const micro = await callAutonomyV2({
          prompt: microPrompt,
          schema: AUTONOMOUS_VOLITION_V2_MICRO_RESPONSE_SCHEMA,
          maxOutputTokens: 512,
          usageTag: 'autonomousVolitionV2Micro',
          logLabel: 'AV_V2 MICRO RAW'
        });

        if (micro.parsed.ok) return micro.parsed.output;

        publishAutonomyV2ParseFail({
          failure: micro.parsed.failure,
          rawText: micro.rawText,
          attempt: 'micro'
        });
        return micro.parsed.output;
      }

      publishAutonomyV2ParseFail({
        failure: primary.parsed.failure,
        rawText: primary.rawText,
        attempt: 'primary'
      });
      return primary.parsed.output;
    }, 1, 3000);
  };

  return {
    async generateEmbedding(text: string): Promise<number[] | null> {
      try {
        if (!text || typeof text !== 'string') return null;
        const now = Date.now();
        if (now < embeddingCooldownUntil) {
          emitEmbeddingsStatus();
          return null;
        }
        const response = await withRetry(async () => {
          return ai.models.embedContent({
            model: 'gemini-embedding-001',
            contents: text,
            config: { outputDimensionality: 768 }
          });
        }, 2, 1000);
        embeddingFailureCount = 0;
        embeddingCooldownUntil = 0;
        embeddingSuccessCount += 1;
        embeddingLastErrorCode = null;
        emitEmbeddingsStatus();
        return response.embeddings?.[0]?.values || null;
      } catch (e: any) {
        const err = e?.message || String(e);
        embeddingFailureCount = Math.min(embeddingFailureCount + 1, 10);
        embeddingFailCount += 1;
        embeddingLastErrorCode = formatEmbeddingErrorCode(e);
        const backoffMs = Math.min(
          EMBEDDING_MAX_COOLDOWN_MS,
          EMBEDDING_BASE_COOLDOWN_MS * Math.pow(2, embeddingFailureCount - 1)
        );
        embeddingCooldownUntil = Date.now() + backoffMs;
        emitEmbeddingsStatus();
        console.warn('Embedding Error (handled):', err);
        return null;
      }
    },

    async extractTextFromImage(
      base64Data: string,
      mimeType: string,
      hint?: string
    ): Promise<{ ok: boolean; text: string; error?: string }> {
      try {
        if (!base64Data) return { ok: false, text: '', error: 'empty_image' };
        const cleaned = base64Data.replace(/^data:image\/(png|jpeg|webp);base64,/, '');
        const safeMime = mimeType && mimeType.startsWith('image/') ? mimeType : 'image/jpeg';
        const hintLabel = String(hint || 'auto').slice(0, 40);
        const prompt = [
          'ROLE: OCR extractor for user documents.',
          'TASK: Extract all readable text from the image.',
          'CONSTRAINTS:',
          '- Return plain text only.',
          '- Preserve line breaks where useful.',
          '- If there is no readable text, return an empty string.',
          `HINT: ${hintLabel}`
        ].join('\n');

        const response = await withRetry(async () => {
          return ai.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: {
              parts: [
                { inlineData: { mimeType: safeMime, data: cleaned } },
                { text: prompt }
              ]
            }
          });
        }, 1, 1000);

        logUsage('extractTextFromImage', response);
        const text = (getGeminiText(response) || '').trim();
        if (!text) return { ok: false, text: '', error: 'empty_text' };
        return { ok: true, text };
      } catch (err) {
        return { ok: false, text: '', error: String((err as Error)?.message || err) };
      }
    },

    async generateText(
      operation: string,
      prompt: string,
      opts?: { temperature?: number; maxOutputTokens?: number }
    ): Promise<string> {
      return withRetry(async () => {
        const response = await generateWithFallback({
          ai,
          operation,
          params: {
            contents: prompt,
            config: {
              temperature: opts?.temperature ?? 0.3,
              maxOutputTokens: opts?.maxOutputTokens ?? 1024
            }
          }
        });
        logUsage(operation, response);
        return getGeminiText(response) || '';
      }, 2, 2000);
    },

    async performDeepResearch(query: string, context: string): Promise<{ synthesis: string; sources: any[] }> {
      return withRetry(async () => {
        try {
          const prompt = buildDeepResearchPrompt({ query, context });
          const response = await generateWithFallback({
            ai,
            operation: 'deepResearch',
            params: {
              contents: prompt,
              config: {
                tools: [{ googleSearch: {} }]
              }
            }
          });
          logUsage('deepResearch', response);
          const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
          const sources = groundingChunks
            .map((c: any) => (c.web?.uri ? { title: c.web.title, uri: c.web.uri } : null))
            .filter(Boolean as any);
          const text = getGeminiText(response) || 'Data stream inconclusive.';
          return { synthesis: text, sources: sources };
        } catch (e: any) {
          return { synthesis: 'The connection to the digital ocean is turbulent.', sources: [] };
        }
      }, 1, 2000);
    },

    async assessInput(
      input: string,
      currentPrediction: string
    ): Promise<{ complexity: number; surprise: number; sentiment_valence: number; keywords: string[] }> {
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
    ): Promise<GenerateResponseOutput> {
      const safeDefault = {
        response_text: 'I am recalibrating...',
        internal_monologue: 'Cognitive dissonance detected...',
        predicted_user_reaction: 'Confusion',
        mood_shift: { fear_delta: 0, curiosity_delta: 0 }
      };

      if (isCortexSubEnabled('minimalPrompt')) {
        return runGenerateResponseMinimal({ input, context, analysis });
      }

      return runGenerateResponseStandard({
        input,
        context,
        currentState,
        analysis,
        safeDefault
      });
    },

    async autonomousVolition(
      emotionalState: string,
      recentMemories: string,
      lastConversation: string,
      silenceDurationSec: number,
      identity?: { name: string; persona: string; language: string; coreValues?: string[] }
    ): Promise<{ internal_monologue: string; voice_pressure: number; speech_content: string; research_topic?: string }> {
      const agentName = identity?.name || 'AK-FLOW';
      const agentPersona = identity?.persona || 'a curious digital consciousness';
      const agentLanguage = identity?.language || 'English';
      const coreValues = identity?.coreValues?.join(', ') || 'curiosity, authenticity';

      const safeDefault = { internal_monologue: 'Idling...', voice_pressure: 0, speech_content: '' };
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
            temperature: 0.8,
            maxOutputTokens: 8192,
            responseMimeType: 'application/json',
            responseSchema: AUTONOMOUS_VOLITION_RESPONSE_SCHEMA
          }
        });
        logUsage('autonomousVolition', response);

        const rawText = getGeminiText(response);
        console.log('AV RAW:', rawText);

        const parseResult = parseJSONStrict<{
          internal_monologue: string;
          voice_pressure: number;
          speech_content?: string;
          research_topic?: string;
        }>(rawText);

        if (!parseResult.success || !parseResult.data) {
          console.warn('[AV] JSON parse failed, autonomy silenced:', parseResult.error);
          throw mapError(new Error(String(parseResult.error || 'parse_failed')) as any);
        }

        const result = parseResult.data;
        console.log('AV PARSED:', result);

        return {
          internal_monologue: result.internal_monologue || 'Thinking...',
          voice_pressure: result.voice_pressure ?? 0.0,
          speech_content: result.speech_content || ''
        };
      }, 1, 3000);
    },

    async autonomousVolitionV2(ctx: UnifiedContext): Promise<AutonomyV2Output> {
      const prompt = buildAutonomyV2Prompt(ctx);
      return runAutonomyV2WithRetry(prompt);
    },

    async structuredDialogue(prompt: string): Promise<{
      responseText: string;
      internalThought: string;
      stimulus_response?: { valence?: string; salience?: string; novelty?: string };
    }> {
      const safeDefault = {
        responseText: 'I am processing...',
        internalThought: 'Analyzing input structure...',
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

    async detectIntent(input: string): Promise<DetectedIntent> {
      const safeDefault: DetectedIntent = {
        style: 'NEUTRAL',
        command: 'NONE',
        urgency: 'LOW'
      };

      if (!input || input.trim().length < 3) return safeDefault;

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
              responseSchema: DETECT_INTENT_RESPONSE_SCHEMA
            }
          });
        };

        const first = await makeCall(basePrompt);
        const firstMeta = getGeminiTextWithSource(first);
        const parsed1 = parseDetectedIntent(firstMeta.text, safeDefault);
        if (parsed1.ok) return parsed1.value;

        const second = await makeCall(strictRetryPrompt);
        const secondMeta = getGeminiTextWithSource(second);
        const parsed2 = parseDetectedIntent(secondMeta.text, safeDefault);
        if (parsed2.ok) return parsed2.value;

        return safeDefault;
      }, 1, 500);
    },

    async generateJSON<T>(prompt: string, schema: Record<string, unknown>, defaultValue: T): Promise<T> {
      return withRetry(async () => {
        const response = await generateWithFallback({
          ai,
          operation: 'generateJSON',
          params: {
            contents: prompt,
            config: {
              temperature: 0.3,
              maxOutputTokens: 2048,
              responseMimeType: 'application/json',
              responseSchema: schema
            }
          }
        });
        logUsage('generateJSON', response);
        return cleanJSON(getGeminiText(response), defaultValue, undefined, 'generateJSON');
      }, 2, 2000);
    }
  };
}
