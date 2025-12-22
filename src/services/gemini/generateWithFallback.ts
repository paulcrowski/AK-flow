import { eventBus } from '../../core/EventBus';
import { AgentType, PacketType } from '../../types';
import { generateUUID } from '../../utils/uuid';
import { ModelRouter, runWithModelFallback } from '../ModelRouter';

import type { GoogleGenAI } from '@google/genai';

type GenerateWithFallbackArgs = {
  ai: GoogleGenAI;
  operation: string;
  params: any;
};

export async function generateWithFallback(args: GenerateWithFallbackArgs): Promise<any> {
  const { ai, operation, params } = args;

  const task = ModelRouter.routeForOperation(operation);
  const chain = ModelRouter.getModelChain(task);
  try {
    const r = await runWithModelFallback(chain, async (model) => {
      return ai.models.generateContent({
        ...params,
        model
      });
    });

    if (r.attempts > 1) {
      eventBus.publish({
        id: generateUUID(),
        timestamp: Date.now(),
        source: AgentType.CORTEX_FLOW,
        type: PacketType.PREDICTION_ERROR,
        payload: {
          metric: 'MODEL_FALLBACK',
          op: operation,
          task,
          chosenModel: r.model,
          attempts: r.attempts,
          errors: r.errors.slice(0, 6)
        },
        priority: 0.1
      });
    }

    return r.value;
  } catch (e: any) {
    const msg = e?.message ? String(e.message) : String(e);
    eventBus.publish({
      id: generateUUID(),
      timestamp: Date.now(),
      source: AgentType.CORTEX_FLOW,
      type: PacketType.PREDICTION_ERROR,
      payload: {
        metric: 'MODEL_FALLBACK_FAILED',
        op: operation,
        task,
        attemptedModels: chain,
        error: msg
      },
      priority: 0.2
    });
    throw new Error(`MODEL_FALLBACK_FAILED: ${operation} :: ${msg}`);
  }
}
