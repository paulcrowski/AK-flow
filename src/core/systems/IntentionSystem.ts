import { eventBus } from '../EventBus';
import { AgentType, PacketType } from '../../types';
import type { CoreBeliefKey } from './CoreBeliefs';
import type { TensionItem } from './TensionRegistry';

export interface Intention {
  id: string;
  tensionKey: string;
  belief: CoreBeliefKey;
  readiness: number;
  deferred: boolean;
  activation?: { type: 'energy' | 'time' | 'context'; value: any };
  createdAt: number;
}

export function formIntention(
  tension: TensionItem | null,
  energy: number,
  readiness: number
): Intention | null {
  if (!tension || tension.severity < 0.4) return null;

  const intention: Intention = {
    id: `int_${Date.now()}`,
    tensionKey: tension.key,
    belief: tension.belief,
    readiness,
    deferred: false,
    createdAt: Date.now()
  };

  if (energy < 40) {
    intention.deferred = true;
    intention.activation = { type: 'energy', value: 40 };
  } else if (readiness < 0.5) {
    intention.deferred = true;
    intention.activation = { type: 'time', value: Date.now() + 60000 };
  }

  eventBus.publish({
    id: intention.id,
    timestamp: Date.now(),
    source: AgentType.CORTEX_FLOW,
    type: intention.deferred ? PacketType.INTENTION_DEFERRED : PacketType.INTENTION_FORMED,
    payload: intention,
    priority: 0.6
  });

  return intention;
}
