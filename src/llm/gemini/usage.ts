import { eventBus } from '../../core/EventBus';
import { AgentType, PacketType } from '../../types';
import { generateUUID } from '../../utils/uuid';
import { getCurrentAgentId } from '../../services/supabase';
import { TokenUsageLedger } from '../../core/telemetry/TokenUsageLedger';
import { extractTokenUsageFromResponse } from '../../core/telemetry/tokenUsage';
import { generateExternalTraceId, getCurrentTraceId } from '../../core/trace/TraceContext';

export function logUsage(
  operation: string,
  response: any,
  meta?: { model?: string; status?: string; traceId?: string }
) {
  if (!response) return;

  const usageCounts = extractTokenUsageFromResponse(response);
  const traceId = meta?.traceId ?? getCurrentTraceId() ?? generateExternalTraceId();
  const model =
    meta?.model ??
    response?.model ??
    response?.modelName ??
    response?.modelVersion ??
    'unknown';
  const status = meta?.status ?? 'success';

  TokenUsageLedger.record({
    agentId: getCurrentAgentId(),
    op: operation,
    inTokens: usageCounts.tokens_in,
    outTokens: usageCounts.tokens_out,
    totalTokens: usageCounts.tokens_total,
    at: Date.now()
  });

  eventBus.publish({
    id: generateUUID(),
    traceId,
    timestamp: Date.now(),
    source: AgentType.SOMA,
    type: PacketType.PREDICTION_ERROR,
    payload: {
      metric: 'TOKEN_USAGE',
      traceId,
      op: operation,
      model,
      status,
      ...usageCounts
    },
    priority: 0.1
  });
}
