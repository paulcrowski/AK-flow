import type {
  EvaluationEvent,
  EvaluationSource,
  EvaluationStage,
  EvaluationTag,
  FailureSource
} from '../../../types';
import { clamp01 } from '../../../utils/math';

let eventIdCounter = 0;

export function createEvaluationEvent(
  source: EvaluationSource,
  stage: EvaluationStage,
  severity: number,
  valence: 'positive' | 'negative',
  tags: EvaluationTag[],
  confidence: number,
  options?: {
    attribution?: FailureSource;
    context?: EvaluationEvent['context'];
  }
): EvaluationEvent {
  return {
    id: `eval-${Date.now()}-${++eventIdCounter}`,
    timestamp: Date.now(),
    source,
    stage,
    severity: clamp01(severity),
    valence,
    tags,
    confidence: clamp01(confidence),
    attribution: options?.attribution,
    context: options?.context
  };
}
