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

    return (data || []).map((m: any) => ({
      id: m.id,
      timestamp: m.created_at || new Date().toISOString(),
      event: m.raw_text || '[No content]',
      emotionAfter: {
        fear: m.emotional_context?.fear || 0,
        curiosity: m.emotional_context?.curiosity || 0,
        frustration: m.emotional_context?.frustration || 0,
        satisfaction: m.emotional_context?.satisfaction || 0
      },
      emotionalDelta: typeof m.neural_strength === 'number' ? m.neural_strength : 0.5,
      lesson: m.lesson || '',
      tags: m.tags || []
    }));
  } catch (err) {
    console.error('[DreamConsolidation] Exception:', err);
    return [];
  }
}
