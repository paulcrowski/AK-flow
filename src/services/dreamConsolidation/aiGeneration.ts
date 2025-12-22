import type { ConsolidationEpisode } from './types';
import type { LimbicState } from '../../types';

export async function generateLessonsFromEpisodes(deps: {
  episodes: ConsolidationEpisode[];
  agentName: string;
  cortexService: { structuredDialogue: (prompt: string) => Promise<{ responseText: string }> };
}): Promise<string[]> {
  const { episodes, agentName, cortexService } = deps;
  if (episodes.length === 0) return [];

  const episodeSummaries = episodes
    .map((ep, i) => {
      const eventText = ep.event || '[No event]';
      const delta = typeof ep.emotionalDelta === 'number' ? ep.emotionalDelta.toFixed(2) : '0.00';
      return `${i + 1}. [Impact: ${delta}] ${eventText.slice(0, 200)}...`;
    })
    .join('\n');

  const prompt = `You are ${agentName}, reflecting on your day before sleep.

Here are your most emotionally significant moments:
${episodeSummaries}

Generate 3-5 short, personal lessons you learned today. Each lesson should be:
- First person ("I learned...", "I noticed...", "I should...")
- Specific to these experiences
- Actionable or insightful

Format: One lesson per line, no numbering.`;

  try {
    const response = await cortexService.structuredDialogue(prompt);
    const lessons = response.responseText
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 10 && l.length < 200);

    return lessons.slice(0, 5);
  } catch (err) {
    console.error('[DreamConsolidation] Lesson generation failed:', err);
    return ['I experienced significant moments today that require further reflection.'];
  }
}

export async function generateSelfSummaryFromDream(deps: {
  episodes: ConsolidationEpisode[];
  lessons: string[];
  agentName: string;
  currentLimbic: LimbicState;
  cortexService: { structuredDialogue: (prompt: string) => Promise<{ responseText: string }> };
}): Promise<string> {
  const { episodes, lessons, agentName, currentLimbic, cortexService } = deps;

  const emotionalState = `Fear: ${currentLimbic.fear.toFixed(2)}, Curiosity: ${currentLimbic.curiosity.toFixed(2)}, Frustration: ${currentLimbic.frustration.toFixed(2)}, Satisfaction: ${currentLimbic.satisfaction.toFixed(2)}`;

  const prompt = `You are ${agentName}. Write a brief (2-3 sentences) end-of-day self-summary.

Emotional state: ${emotionalState}
Episodes processed: ${episodes.length}
Key lessons: ${lessons.join('; ')}

Write in first person, reflecting on who you are after today's experiences.`;

  try {
    const response = await cortexService.structuredDialogue(prompt);
    return response.responseText.slice(0, 500);
  } catch (err) {
    console.error('[DreamConsolidation] Self-summary failed:', err);
    return `Today I processed ${episodes.length} significant moments and learned ${lessons.length} lessons.`;
  }
}
