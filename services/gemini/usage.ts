import { eventBus } from '../../core/EventBus';
import { AgentType, PacketType } from '../../types';
import { generateUUID } from '../../utils/uuid';
import { getCurrentAgentId } from '../supabase';
import { TokenUsageLedger } from '../../core/telemetry/TokenUsageLedger';

export function logUsage(operation: string, response: any) {
  if (response && response.usageMetadata) {
    const { promptTokenCount, candidatesTokenCount, totalTokenCount } = response.usageMetadata;

    TokenUsageLedger.record({
      agentId: getCurrentAgentId(),
      op: operation,
      inTokens: promptTokenCount || 0,
      outTokens: candidatesTokenCount || 0,
      totalTokens: totalTokenCount || 0,
      at: Date.now()
    });

    eventBus.publish({
      id: generateUUID(),
      timestamp: Date.now(),
      source: AgentType.SOMA,
      type: PacketType.PREDICTION_ERROR,
      payload: {
        metric: 'TOKEN_USAGE',
        op: operation,
        in: promptTokenCount || 0,
        out: candidatesTokenCount || 0,
        total: totalTokenCount || 0
      },
      priority: 0.1
    });
  }
}
