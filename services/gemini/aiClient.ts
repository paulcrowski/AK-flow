import { GoogleGenAI } from '@google/genai';

export function createGeminiClient() {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;

  if (!apiKey) {
    console.error('[Gemini] Brak VITE_GEMINI_API_KEY w .env.local – CortexService nie ma klucza.');
    throw new Error('Brak VITE_GEMINI_API_KEY w env (frontend).');
  }

  return new GoogleGenAI({ apiKey });
}
