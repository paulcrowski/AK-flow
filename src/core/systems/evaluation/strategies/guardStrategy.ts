import type { EvaluationEvent, EvaluationTag } from '@/types';
import { createEvaluationEvent } from '../createEvaluationEvent';

export function createGuardEvent(
  action: 'PASS' | 'RETRY' | 'SOFT_FAIL' | 'HARD_FAIL',
  issues: Array<{ type: string; field?: string; expected?: unknown; actual?: string }>,
  context?: { input?: string; output?: string; hardFacts?: Record<string, unknown> }
): EvaluationEvent {
  const tags: EvaluationTag[] = [];
  let severity = 0;

  for (const issue of issues) {
    if (issue.type === 'fact_mutation') {
      tags.push('fact_mutation');
      severity = Math.max(severity, 0.8);
    }
    if (issue.type === 'fact_approximation') {
      tags.push('fact_approximation');
      severity = Math.max(severity, 0.5);
    }
    if (issue.type === 'persona_drift') {
      tags.push('persona_drift');
      severity = Math.max(severity, 0.6);
    }
    if (issue.type === 'identity_leak') {
      tags.push('identity_leak');
      severity = Math.max(severity, 0.7);
    }
  }

  if (action === 'RETRY') tags.push('retry_triggered');
  if (action === 'SOFT_FAIL') tags.push('soft_fail');

  const valence = action === 'PASS' ? 'positive' : 'negative';

  return createEvaluationEvent('GUARD', 'PRISM', severity, valence, tags, 1.0, { context });
}
