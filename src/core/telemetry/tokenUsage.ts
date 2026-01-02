type TokenUsageCounts = {
  tokens_in: number;
  tokens_out: number;
  tokens_total: number;
  tokens_total_reported?: number;
  tokens_total_computed?: number;
};

export type TokenUsagePayload = TokenUsageCounts & {
  op?: string;
  model?: string;
  status?: string;
  traceId?: string;
};

const clampTokenCount = (value: unknown): number => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : 0;
};

const pickRawField = (payload: any, keys: string[]): { found: boolean; value?: unknown } => {
  if (!payload || typeof payload !== 'object') return { found: false };
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(payload, key)) {
      return { found: true, value: (payload as Record<string, unknown>)[key] };
    }
  }
  return { found: false };
};

const buildCounts = (params: {
  tokensIn?: unknown;
  tokensOut?: unknown;
  tokensTotal?: unknown;
  hasTokensTotal?: boolean;
}): TokenUsageCounts => {
  const tokens_in = clampTokenCount(params.tokensIn);
  const tokens_out = clampTokenCount(params.tokensOut);
  const tokens_total_computed = tokens_in + tokens_out;
  const tokens_total_reported = clampTokenCount(params.tokensTotal);
  const payload: TokenUsageCounts = {
    tokens_in,
    tokens_out,
    tokens_total: tokens_total_computed
  };

  if ((params.hasTokensTotal ?? params.tokensTotal !== undefined) && tokens_total_reported !== tokens_total_computed) {
    payload.tokens_total_reported = tokens_total_reported;
    payload.tokens_total_computed = tokens_total_computed;
  }

  return payload;
};

export const buildTokenUsagePayload = (params: {
  tokensIn?: unknown;
  tokensOut?: unknown;
  tokensTotal?: unknown;
  op?: string;
  model?: string;
  status?: string;
  traceId?: string;
}): TokenUsagePayload => {
  const counts = buildCounts({
    tokensIn: params.tokensIn,
    tokensOut: params.tokensOut,
    tokensTotal: params.tokensTotal,
    hasTokensTotal: params.tokensTotal !== undefined
  });

  return {
    ...counts,
    op: params.op,
    model: params.model,
    status: params.status,
    traceId: params.traceId
  };
};

export const normalizeTokenUsagePayload = (
  payload: any,
  fallback?: { traceId?: string }
): TokenUsagePayload => {
  const tokensInField = pickRawField(payload, [
    'tokens_in',
    'input_tokens',
    'promptTokens',
    'in',
    'prompt_tokens'
  ]);
  const tokensOutField = pickRawField(payload, [
    'tokens_out',
    'output_tokens',
    'outputTokens',
    'out',
    'completion_tokens'
  ]);
  const tokensTotalField = pickRawField(payload, [
    'tokens_total',
    'total_tokens',
    'totalTokens',
    'total'
  ]);

  const counts = buildCounts({
    tokensIn: tokensInField.value,
    tokensOut: tokensOutField.value,
    tokensTotal: tokensTotalField.value,
    hasTokensTotal: tokensTotalField.found
  });

  return {
    ...counts,
    op: payload?.op ?? payload?.operation,
    model: payload?.model ?? payload?.modelName,
    status: payload?.status ?? payload?.state,
    traceId: payload?.traceId ?? fallback?.traceId
  };
};

export const extractTokenUsageFromResponse = (response: any): TokenUsageCounts => {
  const usageMetadata = response?.usageMetadata;
  if (usageMetadata && typeof usageMetadata === 'object') {
    return buildCounts({
      tokensIn: usageMetadata.promptTokenCount,
      tokensOut: usageMetadata.candidatesTokenCount,
      tokensTotal: usageMetadata.totalTokenCount,
      hasTokensTotal: Object.prototype.hasOwnProperty.call(usageMetadata, 'totalTokenCount')
    });
  }

  const usage = response?.usage;
  if (usage && typeof usage === 'object') {
    return buildCounts({
      tokensIn: usage.prompt_tokens,
      tokensOut: usage.completion_tokens,
      tokensTotal: usage.total_tokens,
      hasTokensTotal: Object.prototype.hasOwnProperty.call(usage, 'total_tokens')
    });
  }

  return buildCounts({});
};
