import type { LimbicState, TraitVector } from '../../types';
import type { ConsolidationEpisode, TraitVectorProposal } from './types';

export async function proposeTraitChanges(deps: {
  episodes: ConsolidationEpisode[];
  lessons: string[];
  currentTraits: TraitVector;
  agentId: string | null;
  timestamp: string;
  initialLimbic: LimbicState;
  eventBus: { publish: (packet: any) => void };
  memoryService: { storeMemory: (payload: any) => Promise<any> };
  generateUUID: () => string;
  agentTypeCortexFlow: any;
  packetTypeSystemAlert: any;
}): Promise<TraitVectorProposal | null> {
  const {
    episodes,
    lessons,
    currentTraits,
    agentId,
    timestamp,
    initialLimbic,
    eventBus,
    memoryService,
    generateUUID,
    agentTypeCortexFlow,
    packetTypeSystemAlert
  } = deps;

  if (episodes.length < 2) return null;

  const avgEmotions = episodes.reduce(
    (acc, ep) => ({
      fear: acc.fear + ep.emotionAfter.fear / episodes.length,
      curiosity: acc.curiosity + ep.emotionAfter.curiosity / episodes.length,
      frustration: acc.frustration + ep.emotionAfter.frustration / episodes.length,
      satisfaction: acc.satisfaction + ep.emotionAfter.satisfaction / episodes.length
    }),
    { fear: 0, curiosity: 0, frustration: 0, satisfaction: 0 }
  );

  const proposedDeltas: Partial<TraitVector> = {};
  let reasoning = '';

  if (avgEmotions.curiosity > 0.6) {
    proposedDeltas.curiosity = 0.02;
    reasoning += 'High curiosity in episodes suggests reinforcing exploratory nature. ';
  }

  if (avgEmotions.frustration > 0.4) {
    proposedDeltas.conscientiousness = 0.01;
    reasoning += 'Frustration episodes suggest need for more careful approach. ';
  }

  if (avgEmotions.satisfaction > 0.6 && currentTraits.arousal < 0.4) {
    proposedDeltas.arousal = -0.01;
    reasoning += 'Satisfaction in calm state suggests this is working well. ';
  }

  if (avgEmotions.fear > 0.5) {
    proposedDeltas.arousal = (proposedDeltas.arousal || 0) - 0.01;
    reasoning += 'Fear episodes suggest becoming more cautious. ';
  }

  if (Object.keys(proposedDeltas).length === 0) {
    reasoning = "No significant trait changes suggested based on today's episodes.";
  }

  const proposal: TraitVectorProposal = {
    timestamp,
    agentId: agentId || 'unknown',
    currentTraits,
    proposedDeltas,
    reasoning: reasoning.trim(),
    episodesSummary: `${episodes.length} episodes with avg emotions: curiosity=${avgEmotions.curiosity.toFixed(2)}, satisfaction=${avgEmotions.satisfaction.toFixed(2)}, frustration=${avgEmotions.frustration.toFixed(2)}, fear=${avgEmotions.fear.toFixed(2)}`
  };

  console.log('🧬 [DreamConsolidation] TRAIT PROPOSAL (not applied):', proposal);

  eventBus.publish({
    id: generateUUID(),
    timestamp: Date.now(),
    source: agentTypeCortexFlow,
    type: packetTypeSystemAlert,
    payload: {
      event: 'TRAIT_EVOLUTION_PROPOSAL',
      proposal,
      message: '🧬 Trait change proposed (requires manual approval)'
    },
    priority: 0.7
  });

  try {
    await memoryService.storeMemory({
      id: generateUUID(),
      content: `[TRAIT_PROPOSAL] ${proposal.reasoning}\nDeltas: ${JSON.stringify(proposal.proposedDeltas)}`,
      emotionalContext: { ...initialLimbic, curiosity: 0.5 },
      timestamp: proposal.timestamp
    });
  } catch (err) {
    console.error('[DreamConsolidation] Failed to store trait proposal:', err);
  }

  return proposal;
}
