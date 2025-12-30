import type { LimbicState, TraitVector } from '../../types';

export interface ConsolidationEpisode {
  id: string;
  event: string;
  emotionAfter: LimbicState;
  emotionalDelta: number;
  lesson: string;
  timestamp: string;
  tags: string[];
}

export interface TraitVectorProposal {
  timestamp: string;
  agentId: string;
  currentTraits: TraitVector;
  proposedDeltas: Partial<TraitVector>;
  reasoning: string;
  episodesSummary: string;
}

export interface DreamEpisodeDetail {
  id: string;
  preview: string;
  timestamp?: string;
  neuralStrength?: number;
  tags?: string[];
}

export interface DreamConsolidationResult {
  episodesProcessed: number;
  lessonsGenerated: string[];
  selfSummary: string;
  traitProposal: TraitVectorProposal | null;
  goalsCreated: number;
  episodeDetails?: DreamEpisodeDetail[];
  identityConsolidation?: {
    narrativeSelfUpdated: boolean;
    shardsCreated: number;
    shardsReinforced: number;
    shardsWeakened: number;
  };
  sessionChunkCreated?: boolean;
  decayPrune?: {
    decayed: number;
    pruned: number;
  };
}
