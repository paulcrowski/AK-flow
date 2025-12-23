import type { EvaluationEvent, EvaluationTag, FailureSource } from '@/types';
import { createEvaluationEvent } from '../createEvaluationEvent';

export function confessionToEvaluation(confession: {
  severity: number;
  pain?: number;
  failure_attribution?: FailureSource;
  risk_flags: string[];
}): EvaluationEvent {
  const tags: EvaluationTag[] = [];

  if (confession.risk_flags.includes('possible_hallucination')) tags.push('hallucination');
  if (confession.risk_flags.includes('ignored_system_instruction')) tags.push('offtopic');

  const isNegative = confession.severity > 3;

  return createEvaluationEvent(
    'CONFESSION',
    'PRISM',
    confession.pain || confession.severity / 10,
    isNegative ? 'negative' : 'positive',
    tags,
    0.8,
    { attribution: confession.failure_attribution }
  );
}
