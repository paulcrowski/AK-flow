import type { CoreBeliefKey } from './CoreBeliefs';
import type { Intention } from './IntentionSystem';

export type ActionType = 'observe' | 'note' | 'suggest' | 'rest';

export function selectAction(input: {
  intention: Intention | null;
  drive: CoreBeliefKey;
  readiness: number;
  energy: number;
  evidenceCount: number;
  hasUserInput?: boolean;
  pendingToolIntent?: boolean;
}): { action: ActionType; reason: string } {
  if (input.energy < 30) {
    return { action: 'rest', reason: 'energy_critical' };
  }

  if (input.hasUserInput) {
    return { action: 'suggest', reason: 'user_input_priority' };
  }

  if (input.pendingToolIntent) {
    return { action: 'suggest', reason: 'pending_tool_intent' };
  }

  if (input.intention) {
    if (input.evidenceCount === 0) {
      return { action: 'observe', reason: 'intention_requires_evidence' };
    }
    if (input.readiness > 0.7 && input.evidenceCount >= 2) {
      return { action: 'suggest', reason: 'intention_ready' };
    }
    if (input.readiness < 0.5) {
      return { action: 'observe', reason: 'intention_readiness_low' };
    }
    return { action: 'note', reason: 'intention_capture' };
  }

  if (input.drive === 'truth' && input.evidenceCount === 0) {
    return { action: 'observe', reason: 'TRUTH_REQUIRES_EVIDENCE' };
  }

  if (input.evidenceCount === 0) {
    return { action: 'observe', reason: 'no_evidence_available' };
  }

  if (input.readiness < 0.5) {
    return { action: 'observe', reason: 'readiness_low' };
  }

  if (input.evidenceCount < 2) {
    return { action: 'observe', reason: 'insufficient_evidence' };
  }

  if (input.readiness > 0.7 && input.evidenceCount >= 2) {
    return { action: 'suggest', reason: 'ready_with_evidence' };
  }

  return { action: 'note', reason: 'capture_current_state' };
}
