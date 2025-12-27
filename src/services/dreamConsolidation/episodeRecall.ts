import type { ConsolidationEpisode } from './types';

export async function recallMostImpactfulEpisodes(deps: {
  agentId: string | null;
  supabase: any;
  minNeuralStrength: number;
  maxEpisodes: number;
}): Promise<ConsolidationEpisode[]> {
  const { agentId, supabase, minNeuralStrength, maxEpisodes } = deps;
  if (!agentId) return [];

  try {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from('memories')
      .select('*')
      .eq('agent_id', agentId)
      .gte('created_at', oneDayAgo)
      .gte('neural_strength', minNeuralStrength)
      .order('neural_strength', { ascending: false })
      .limit(maxEpisodes);

    if (error) {
      console.error('[DreamConsolidation] Error fetching episodes:', error);
      return [];
    }

    return (data || []).map((m: any) => {
      const metaEmotion =
        m?.metadata && typeof m.metadata === 'object'
          ? (m.metadata.emotionAfter || m.metadata.emotional_context || m.metadata.emotion || {})
          : {};

      const emotionAfter = {
        fear: typeof metaEmotion.fear === 'number' ? metaEmotion.fear : 0,
        curiosity: typeof metaEmotion.curiosity === 'number' ? metaEmotion.curiosity : 0,
        frustration: typeof metaEmotion.frustration === 'number' ? metaEmotion.frustration : 0,
        satisfaction: typeof metaEmotion.satisfaction === 'number' ? metaEmotion.satisfaction : 0
      };

      return {
        id: m.id,
        timestamp: m.created_at || new Date().toISOString(),
        event: m.raw_text || '[No content]',
        emotionAfter,
        emotionalDelta: typeof m.neural_strength === 'number' ? m.neural_strength : 0,
        lesson: typeof m.lesson === 'string' ? m.lesson : '',
        tags: Array.isArray(m.tagged_emotions) ? m.tagged_emotions : []
      };
    });
  } catch (err) {
    console.error('[DreamConsolidation] Exception:', err);
    return [];
  }
}
