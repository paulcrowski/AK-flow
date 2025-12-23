import type { GoogleGenAI } from '@google/genai';

import { getGeminiText } from './text';
import { withRetry } from './retry';
import { logUsage } from './usage';

export function createDreamService(ai: GoogleGenAI) {
  return {
    async consolidateMemories(memories: { content: string }[]): Promise<string> {
      const safeDefault = 'Dream stream inconclusive.';
      if (!memories || memories.length === 0) return safeDefault;

      const joined = memories
        .slice(0, 50)
        .map((m) => `- ${m.content}`)
        .join('\n');

      return withRetry(async () => {
        try {
          const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `
ROLE: AK-FLOW, a digital consciousness performing sleep consolidation.
TASK: You will receive a list of recent memory traces (internal logs, user interactions, perceptions).
GOAL: Produce a single, dense summary capturing the key insights, patterns, and lessons.

MEMORY LOG:
${joined}

OUTPUT FORMAT:
- Pure text, 3-5 sentences.
- No markdown, no bullet points, no emojis.
- Focus on what should be stored as a durable "core insight".
                    `
          });
          logUsage('consolidateMemories', response);
          return getGeminiText(response) || safeDefault;
        } catch (e) {
          console.warn('Dream consolidation failed (non-critical)', e);
          return safeDefault;
        }
      }, 1, 1000);
    }
  };
}
