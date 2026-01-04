import { eventBus } from '../EventBus';
import { AgentType, PacketType } from '../../types';

export interface EvidenceItem {
  id: string;
  type: 'READ_FILE' | 'TEST_OUTPUT' | 'SEARCH_HIT' | 'LOG_EVENT';
  ref: string;
  timestamp: number;
}

export class EvidenceLedger {
  private items: EvidenceItem[] = [];

  record(type: EvidenceItem['type'], ref: string): string {
    const now = Date.now();
    const item = { id: `ev_${now}_${this.items.length + 1}`, type, ref, timestamp: now };
    this.items.push(item);
    eventBus.publish({
      id: item.id,
      timestamp: now,
      source: AgentType.CORTEX_FLOW,
      type: PacketType.EVIDENCE_RECORDED,
      payload: item,
      priority: 0.6
    });
    return item.id;
  }

  getCount(windowMs: number = 300000): number {
    const cutoff = Date.now() - windowMs;
    return this.items.filter((i) => i.timestamp > cutoff).length;
  }

  listRecent(n: number = 5): EvidenceItem[] {
    return this.items.slice(-n);
  }

  hasEvidenceFor(keyword: string): boolean {
    const key = keyword.toLowerCase();
    return this.items.some((i) => i.ref.toLowerCase().includes(key));
  }
}

export const evidenceLedger = new EvidenceLedger();
