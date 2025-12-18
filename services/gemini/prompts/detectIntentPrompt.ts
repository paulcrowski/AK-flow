import { PromptComposer } from '../PromptComposer';

export function buildDetectIntentPrompts(input: { userInput: string }): { basePrompt: string; strictRetryPrompt: string } {
  const { userInput } = input;

  const basePrompt = PromptComposer.join([
    PromptComposer.section('TASK', ['Analyze user input for implicit intents.']),
    PromptComposer.section('INPUT', [`"${userInput}"`]),
    PromptComposer.section('CLASSIFY', [
      '1. Style Preference: POETIC, SIMPLE, ACADEMIC, or NEUTRAL (default).',
      '2. Command Type: NONE, SEARCH, VISUALIZE, SYSTEM_CONTROL.',
      '3. Urgency: LOW, MEDIUM, HIGH.'
    ]),
    PromptComposer.section('EXAMPLES', [
      '"Stop speaking in riddles!" -> { "style": "SIMPLE", "command": "NONE", "urgency": "HIGH" }',
      '"Show me a dream of mars" -> { "style": "NEUTRAL", "command": "VISUALIZE", "urgency": "MEDIUM" }',
      '"Explain quantum physics like a professor" -> { "style": "ACADEMIC", "command": "NONE", "urgency": "LOW" }',
      '"Hello" -> { "style": "NEUTRAL", "command": "NONE", "urgency": "LOW" }'
    ]),
    PromptComposer.section('OUTPUT', ['OUTPUT JSON ONLY.'])
  ]);

  const strictRetryPrompt = PromptComposer.join([
    PromptComposer.section('OUTPUT RULES (CRITICAL)', [
      '- Output ONLY a raw JSON object. No prose. No markdown.',
      "- First character MUST be '{'.",
      '- Keys must be: style, command, urgency.'
    ]),
    basePrompt
  ]);

  return { basePrompt, strictRetryPrompt };
}
