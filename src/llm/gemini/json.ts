import { eventBus } from '../../core/EventBus';
import { AgentType, PacketType } from '../../types';
import { generateUUID } from '../../utils/uuid';
import { parseJsonFromLLM } from '../../utils/AIResponseParser';

function isValidResponse<T>(data: any, validator?: (data: any) => boolean): data is T {
  if (!data || typeof data !== 'object') return false;
  if (validator) return validator(data);
  return true;
}

export interface JSONParseResult<T> {
  success: boolean;
  data: T | null;
  error?: string;
  rawText?: string;
}

export const parseJSONStrict = <T>(text: string | undefined, validator?: (data: any) => boolean): JSONParseResult<T> => {
  if (!text) {
    return { success: false, data: null, error: 'EMPTY_RESPONSE' };
  }

  try {
    const sanitizedText = text
      .slice(0, 20000)
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');

    const parsedResult = parseJsonFromLLM<T>(sanitizedText, {
      allowRepair: true,
      validator: validator as any,
      requireJsonBlock: false
    });

    if (parsedResult.ok && parsedResult.value && isValidResponse<T>(parsedResult.value, validator)) {
      return { success: true, data: parsedResult.value };
    }

    return { success: false, data: null, error: parsedResult.error || 'PARSE_ERROR', rawText: text.substring(0, 200) };
  } catch (e) {
    return {
      success: false,
      data: null,
      error: (e as Error).message,
      rawText: text.substring(0, 200)
    };
  }
};

export const cleanJSON = <T>(
  text: string | undefined,
  defaultVal: T,
  validator?: (data: any) => boolean,
  callsite?: string
): T => {
  if (!text) return defaultVal;

  try {
    const parsedResult = parseJsonFromLLM<T>(text, {
      allowRepair: true,
      validator: validator as any,
      requireJsonBlock: false
    });

    if (parsedResult.ok && parsedResult.value && isValidResponse<T>(parsedResult.value, validator)) {
      return parsedResult.value;
    }

    if (!parsedResult.ok) {
      throw new Error(parsedResult.error || 'PARSE_ERROR');
    }

    console.warn('JSON Parsed but failed validation. Using default.');
    return defaultVal;
  } catch (e2) {
    const hasBrace = text?.includes('{') ?? false;
    const hasBracket = text?.includes('[') ?? false;
    const first60 = text?.substring(0, 60) || 'EMPTY';

    console.warn(
      `[JSON_PARSE_FAILURE] callsite=${callsite || 'unknown'} hasBrace=${hasBrace} hasBracket=${hasBracket} first60="${first60}"`
    );

    eventBus.publish({
      id: generateUUID(),
      timestamp: Date.now(),
      source: AgentType.CORTEX_FLOW,
      type: PacketType.PREDICTION_ERROR,
      payload: {
        metric: 'JSON_PARSE_FAILURE',
        callsite: callsite || 'unknown',
        has_brace: hasBrace,
        has_bracket: hasBracket,
        first_60_chars: first60,
        error: (e2 as any).message
      },
      priority: 0.9
    });

    return defaultVal;
  }
};
