import { Type } from '@google/genai';

export const DETECT_INTENT_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    style: { type: Type.STRING, enum: ['POETIC', 'SIMPLE', 'ACADEMIC', 'NEUTRAL'] },
    command: { type: Type.STRING, enum: ['NONE', 'SEARCH', 'VISUALIZE', 'SYSTEM_CONTROL'] },
    urgency: { type: Type.STRING, enum: ['LOW', 'MEDIUM', 'HIGH'] }
  },
  required: ['style', 'command', 'urgency']
};
