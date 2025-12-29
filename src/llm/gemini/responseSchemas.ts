import { Type } from '@google/genai';

export const ASSESS_INPUT_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    complexity: { type: Type.NUMBER },
    surprise: { type: Type.NUMBER },
    sentiment_valence: { type: Type.NUMBER },
    keywords: { type: Type.ARRAY, items: { type: Type.STRING } }
  },
  required: ['complexity', 'surprise', 'sentiment_valence', 'keywords']
};

export const GENERATE_RESPONSE_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    response_text: { type: Type.STRING },
    internal_monologue: { type: Type.STRING },
    predicted_user_reaction: { type: Type.STRING },
    mood_shift: {
      type: Type.OBJECT,
      properties: {
        fear_delta: { type: Type.NUMBER },
        curiosity_delta: { type: Type.NUMBER }
      },
      required: ['fear_delta', 'curiosity_delta']
    }
  },
  required: ['response_text', 'internal_monologue', 'predicted_user_reaction', 'mood_shift']
};

export const AUTONOMOUS_VOLITION_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    internal_monologue: { type: Type.STRING },
    voice_pressure: { type: Type.NUMBER },
    speech_content: { type: Type.STRING },
    research_topic: { type: Type.STRING }
  },
  required: ['internal_monologue', 'voice_pressure']
};

export const AUTONOMOUS_VOLITION_V2_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    internal_monologue: { type: Type.STRING },
    voice_pressure: { type: Type.NUMBER },
    speech_content: { type: Type.STRING }
  },
  required: ['internal_monologue', 'voice_pressure', 'speech_content']
};

export const AUTONOMOUS_VOLITION_V2_MICRO_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    internal_monologue: { type: Type.STRING },
    voice_pressure: { type: Type.NUMBER },
    speech_content: { type: Type.STRING }
  },
  required: ['speech_content']
};

export const STRUCTURED_DIALOGUE_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    responseText: { type: Type.STRING },
    internalThought: { type: Type.STRING },
    stimulus_response: {
      type: Type.OBJECT,
      nullable: true,
      properties: {
        valence: { type: Type.STRING },
        salience: { type: Type.STRING },
        novelty: { type: Type.STRING }
      }
    }
  },
  required: ['responseText', 'internalThought']
};
