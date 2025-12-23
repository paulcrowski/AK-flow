import type { GoogleGenAI } from '@google/genai';

import { getGeminiText } from './text';
import { withRetry } from './retry';
import { logUsage } from './usage';

export function createVisualCortex(ai: GoogleGenAI) {
  return {
    async generateVisualThought(prompt: string): Promise<string | null> {
      try {
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash-image',
          contents: {
            parts: [
              {
                text: `Abstract, dreamlike, neural network visualization, ethereal, cinematic lighting, 8k resolution, artistic interpretation of: ${prompt}`
              }
            ]
          },
          config: {
            imageConfig: {
              aspectRatio: '16:9'
            }
          }
        });

        if (response.candidates?.[0]?.content?.parts) {
          for (const part of response.candidates[0].content.parts) {
            if (part.inlineData && part.inlineData.data) {
              return `data:image/jpeg;base64,${part.inlineData.data}`;
            }
          }
        }
        return null;
      } catch (e) {
        console.warn('Visual Cortex Glitch (Ignored):', e);
        return null;
      }
    },

    async analyzeVisualInput(base64Data: string): Promise<string> {
      return withRetry(async () => {
        const cleanBase64 = base64Data.replace(/^data:image\/(png|jpeg|webp);base64,/, '');

        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: {
            parts: [
              { inlineData: { mimeType: 'image/jpeg', data: cleanBase64 } },
              {
                text: "You created this image based on your internal state. Look at it closely. Describe the colors, shapes, and the 'feeling' of this image in 1 sentence. How does this visualization reflect your current emotion?"
              }
            ]
          }
        });
        logUsage('analyzeVisualInput', response);
        return getGeminiText(response) || 'Visual perception unclear.';
      });
    }
  };
}
