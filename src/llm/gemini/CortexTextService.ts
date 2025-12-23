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
  GENERATE_RESPONSE_RESPONSE_SCHEMA,
  STRUCTURED_DIALOGUE_RESPONSE_SCHEMA
} from './responseSchemas';

export function createCortexTextService(ai: GoogleGenAI) {
  return {
    async generateEmbedding(text: string): Promise<number[] | null> {
      try {
        if (!text || typeof text !== 'string') return null;
        const response = await ai.models.embedContent({
          model: 'text-embedding-004',
          contents: text
        });
        return response.embeddings?.[0]?.values || null;
      } catch (e: any) {
        console.error('Embedding Error:', e);
        return null;
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
    ): Promise<{ text: string; thought: string; prediction: string; moodShift: { fear_delta: number; curiosity_delta: number } }> {
      const safeDefault = {
        response_text: 'I am recalibrating...',
        internal_monologue: 'Cognitive dissonance detected...',
        predicted_user_reaction: 'Confusion',
        mood_shift: { fear_delta: 0, curiosity_delta: 0 }
      };

      if (isCortexSubEnabled('minimalPrompt')) {
        return withRetry(async () => {
          const agentId = getCurrentAgentId();
          if (!agentId) throw new Error('Agent ID missing for Cortex flow');

          const contextMock = context.split('\n').slice(-3);

          const limbicState = analysis && typeof analysis === 'object' ? analysis : {
            satisfaction: 0.5,
            frustration: 0.1
          };

          const state = await buildMinimalCortexState({
            agentId: agentId,
            userInput: input,
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

          if (isFactEchoPipelineEnabled()) {
            const guarded = guardLegacyWithFactEcho(legacyResponse, output.fact_echo, {
              agentName: state.core_identity?.name || 'Jesse'
            });
            return guarded.output;
          }

          if (isPrismEnabled()) {
            const guarded = guardLegacyResponse(legacyResponse, {
              agentName: state.core_identity?.name || 'Jesse'
            });
            return guarded.output;
          }

          return legacyResponse;
        });
      }

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
            temperature: 0.7,
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

    async autonomousVolitionV2(ctx: UnifiedContext): Promise<{ internal_monologue: string; voice_pressure: number; speech_content: string }> {
      const prompt = isCortexSubEnabled('unifiedContextPrompt')
        ? UnifiedContextBuilder.formatAsPrompt(ctx, 'autonomous')
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
        console.log('AV_V2 RAW:', rawForLog);

        if (isMainFeatureEnabled('ONE_MIND_ENABLED')) {
          const contracted = applyAutonomyV2RawContract(rawText, {
            maxRawLen: 20000,
            maxInternalMonologueLen: 1200,
            maxSpeechLen: 1200
          });

          if (!contracted.ok) {
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
                stage: 'AUTONOMY_V2',
                reason: contracted.reason,
                details: contracted.details,
                raw_len: String(rawText || '').length,
                raw_preview: String(rawText || '').slice(0, 120),
                model: 'gemini-2.5-flash'
              },
              priority: 0.7
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
          return {
            internal_monologue: `[PARSE_FAIL] ${parseResult.error}`,
            voice_pressure: 0,
            speech_content: ''
          };
        }

        const result = parseResult.data;
        console.log('AV_V2 PARSED:', result);

        return {
          internal_monologue: result.internal_monologue || 'Thinking...',
          voice_pressure: result.voice_pressure ?? 0.0,
          speech_content: (result.speech_content || '').slice(0, 1200)
        };
      }, 1, 3000);
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
