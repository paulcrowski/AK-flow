import type { CoreBeliefKey } from '../systems/CoreBeliefs';

export interface ChunkRef {
  id: string;
  summary: string;
  relevance: number;
  type: 'schema' | 'observation' | 'memory';
}

export interface Tension {
  key: string;
  belief: CoreBeliefKey;
  severity: number;
  evidenceCount: number;
}

export interface WitnessFrame {
  activeChunks: ChunkRef[];
  dominantTension: Tension | null;
  dominantDrive: CoreBeliefKey;
  energyBudget: number;
  contextPressure: number;
  readinessToAct: number;
  timestamp: number;
}
