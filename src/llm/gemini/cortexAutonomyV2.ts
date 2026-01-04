import type { GoogleGenAI } from '@google/genai';

import { AgentType, PacketType } from '../../types';
import { isCortexSubEnabled, isMainFeatureEnabled } from '../../core/config/featureFlags';
import { UnifiedContextBuilder, type UnifiedContext } from '../../core/context';
import { applyAutonomyV2RawContract } from '../../core/systems/RawContract';
import { clamp01 } from '../../utils/math';
import { eventBus } from '../../core/EventBus';
import { getCurrentTraceId } from '../../core/trace/TraceContext';
import { p0MetricAdd } from '../../core/systems/TickLifecycleTelemetry';
import { generateUUID } from '../../utils/uuid';

import { getGeminiText } from './text';
import { parseJSONStrict } from './json';
import { withRetry } from './retry';
import { logUsage } from './usage';
import {
  AUTONOMOUS_VOLITION_V2_RESPONSE_SCHEMA,
  AUTONOMOUS_VOLITION_V2_MICRO_RESPONSE_SCHEMA
} from './responseSchemas';

export type AutonomyV2Output = {
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
    'Output must be a single JSON object (start with \"{\" and end with \"}\").',
    'Keys: speech_content (string), voice_pressure (number), internal_monologue (optional).',
    'Keep speech_content under 280 chars and internal_monologue under 120 chars.',
    'No markdown, no extra text, no code fences.'
  ].join('\n');
};

const buildAutonomyV2MicroRetryPrompt = (basePrompt: string): string => {
  return [
    basePrompt,
    '',
    'STRICT JSON ONLY.',
    'Return exactly one JSON object and nothing else.',
    'Output must start with \"{\" and end with \"}\".',
    'Schema:',
    '{\"speech_content\":\"...\",\"voice_pressure\":0.0,\"internal_monologue\":\"...\"}'
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
  attempt?: 'primary' | 'micro' | 'micro_retry';
}) => {
  const traceId = getCurrentTraceId();
  if (traceId) p0MetricAdd(traceId, { parseFailCount: 1 });
  const stage = params.attempt === 'micro_retry'
    ? 'AUTONOMY_V2_MICRO_RETRY'
    : params.attempt === 'micro'
      ? 'AUTONOMY_V2_MICRO'
      : 'AUTONOMY_V2';
  eventBus.publish({
    id: generateUUID(),
    traceId: traceId || undefined,
    timestamp: Date.now(),
    source: AgentType.CORTEX_FLOW,
    type: PacketType.SYSTEM_ALERT,
    payload: {
      event: 'P0_PARSE_FAIL',
      stage,
      reason: params.failure?.reason,
      details: params.failure?.details,
      raw_len: String(params.rawText || '').length,
      raw_preview: String(params.rawText || '').slice(0, 120),
      model: 'gemini-2.5-flash'
    },
    priority: 0.7
  });
};

const callAutonomyV2 = async (ai: GoogleGenAI, params: {
  prompt: string;
  schema: Record<string, unknown>;
  maxOutputTokens: number;
  temperature?: number;
  usageTag: string;
  logLabel: string;
}): Promise<{ rawText?: string; parsed: AutonomyV2ParseResult }> => {
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: params.prompt,
    config: {
      temperature: params.temperature ?? 0.7,
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

const runAutonomyV2WithRetry = async (ai: GoogleGenAI, prompt: string): Promise<AutonomyV2Output> => {
  return withRetry(async () => {
    const primary = await callAutonomyV2(ai, {
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
      const micro = await callAutonomyV2(ai, {
        prompt: microPrompt,
        schema: AUTONOMOUS_VOLITION_V2_MICRO_RESPONSE_SCHEMA,
        maxOutputTokens: 1024,
        usageTag: 'autonomousVolitionV2Micro',
        logLabel: 'AV_V2 MICRO RAW'
      });

      if (micro.parsed.ok) return micro.parsed.output;

      if (shouldRetryAutonomyV2(micro.parsed.failure)) {
        const microRetryPrompt = buildAutonomyV2MicroRetryPrompt(prompt);
        const microRetry = await callAutonomyV2(ai, {
          prompt: microRetryPrompt,
          schema: AUTONOMOUS_VOLITION_V2_MICRO_RESPONSE_SCHEMA,
          maxOutputTokens: 1536,
          temperature: 0.2,
          usageTag: 'autonomousVolitionV2MicroRetry',
          logLabel: 'AV_V2 MICRO RETRY RAW'
        });

        if (microRetry.parsed.ok) return microRetry.parsed.output;

        publishAutonomyV2ParseFail({
          failure: microRetry.parsed.failure,
          rawText: microRetry.rawText,
          attempt: 'micro_retry'
        });
        return microRetry.parsed.output;
      }

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

export function createAutonomyV2Runner(ai: GoogleGenAI) {
  return {
    autonomousVolitionV2: async (ctx: UnifiedContext): Promise<AutonomyV2Output> => {
      const prompt = buildAutonomyV2Prompt(ctx);
      return runAutonomyV2WithRetry(ai, prompt);
    }
  };
}
