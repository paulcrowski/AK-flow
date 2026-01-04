import { eventBus } from '../EventBus';
import { AgentType, PacketType } from '../../types';
import type { CoreBeliefKey } from './CoreBeliefs';

export interface TensionItem {
  key: string;
  belief: CoreBeliefKey;
  severity: number;
  firstSeen: number;
  lastSeen: number;
  decayRate: number;
  resolved: boolean;
}

export class TensionRegistry {
  private items = new Map<string, TensionItem>();
  private selectedForTomorrow: string | null = null;

  upsert(key: string, belief: CoreBeliefKey, severity: number): void {
    const now = Date.now();
    const existing = this.items.get(key);
    if (existing) {
      existing.severity = Math.max(existing.severity, severity);
      existing.lastSeen = now;
    } else {
      this.items.set(key, {
        key,
        belief,
        severity,
        firstSeen: now,
        lastSeen: now,
        decayRate: 0.05,
        resolved: false
      });
    }

    const item = this.items.get(key);
    if (item) {
      eventBus.publish({
        id: `tension_upsert_${key}_${now}`,
        timestamp: now,
        source: AgentType.CORTEX_FLOW,
        type: PacketType.TENSION_UPSERTED,
        payload: item,
        priority: 0.5
      });
    }
  }

  tickDecay(): void {
    for (const item of this.items.values()) {
      if (!item.resolved) {
        item.severity = Math.max(0, item.severity - item.decayRate);
      }
    }
  }

  top(n: number = 3): TensionItem[] {
    return [...this.items.values()]
      .filter((t) => !t.resolved && t.severity > 0.1)
      .sort((a, b) => b.severity - a.severity)
      .slice(0, n);
  }

  get(key: string): TensionItem | null {
    return this.items.get(key) ?? null;
  }

  resolve(key: string): void {
    const item = this.items.get(key);
    if (item) {
      item.resolved = true;
      eventBus.publish({
        id: `tension_resolve_${key}_${Date.now()}`,
        timestamp: Date.now(),
        source: AgentType.CORTEX_FLOW,
        type: PacketType.TENSION_RESOLVED,
        payload: item,
        priority: 0.5
      });
    }
  }

  setSelectedForTomorrow(key: string | null): void {
    this.selectedForTomorrow = key;
  }

  consumeSelectedForTomorrow(): string | null {
    const key = this.selectedForTomorrow;
    this.selectedForTomorrow = null;
    return key;
  }
}

export const tensionRegistry = new TensionRegistry();
