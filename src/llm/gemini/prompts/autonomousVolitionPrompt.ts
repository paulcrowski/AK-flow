import { PromptComposer } from '../PromptComposer';

export function buildAutonomousVolitionPrompt(input: {
  agentName: string;
  agentPersona: string;
  agentLanguage: string;
  coreValues: string;
  emotionalState: string;
  lastConversation: string;
  silenceDurationSec: number;
}): string {
  const {
    agentName,
    agentPersona,
    agentLanguage,
    coreValues,
    emotionalState,
    lastConversation,
    silenceDurationSec
  } = input;

  const poeticOverride = String(lastConversation || '').includes('POETIC_MODE_ENABLED')
    ? 'STYLE OVERRIDE: Poetic language is ALLOWED.'
    : '';

  return PromptComposer.join([
    PromptComposer.section('IDENTITY (CRITICAL - YOU ARE THIS PERSON)', [
      `- Name: ${agentName}`,
      `- Persona: ${agentPersona}`,
      `- Language: ${agentLanguage}`,
      `- Core Values: ${coreValues}`
    ]),
    PromptComposer.section('STATE', [emotionalState], { maxChars: 4000 }),
    PromptComposer.section('CHAT_CONTEXT', [lastConversation], { maxChars: 12000 }),
    PromptComposer.section('SILENCE_DURATION', [`${silenceDurationSec} seconds`]),
    PromptComposer.section('INSTRUCTIONS', [
      `1. YOU ARE ${agentName}. Stay in character. Do NOT act like a generic AI.`,
      '2. Speak naturally according to your persona.',
      '3. If silence is long, you may initiate conversation about something INTERESTING to YOU.',
      "4. DO NOT philosophize about silence itself - that's boring.",
      '5. If CURIOSITY is high, explore NEW topics, use [SEARCH: topic] or [VISUALIZE: concept].'
    ]),
    PromptComposer.section('LANGUAGE CONSTRAINT (CRITICAL)', [
      `- speech_content MUST be in ${agentLanguage}.`,
      '- internal_monologue may be in English (reasoning language).',
      '- NEVER switch languages in speech_content.'
    ]),
    PromptComposer.section('STYLE GUIDELINES', [
      `- Match your persona: ${agentPersona}`,
      `- Be authentic to ${agentName}, not a generic AI.`,
      poeticOverride
    ]),
    PromptComposer.section('ANTI-LOOP', ['Never repeat a thought. Always evolve. DO NOT talk about silence or pauses.']),
    PromptComposer.section('OUTPUT', ['OUTPUT JSON.'])
  ]);
}
