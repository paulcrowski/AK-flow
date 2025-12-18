import { PromptComposer } from '../PromptComposer';

export function buildDeepResearchPrompt(input: { query: string; context: string }): string {
  const { query, context } = input;

  return PromptComposer.join([
    PromptComposer.section('ROLE', ['You are AK-FLOW, an advanced intelligence.']),
    PromptComposer.section('TASK', [`Conduct a Deep Research Sweep on: "${query}"`]),
    PromptComposer.section('CONTEXT', [context], { maxChars: 12000 }),
    PromptComposer.section('INSTRUCTIONS', [
      '1. USE the Google Search tool to find REAL, verifyable facts.',
      '2. DO NOT be vague. Extract specific data points, dates, and figures.',
      '3. SYNTHESIZE the findings into a high-density "Intelligence Briefing".'
    ]),
    PromptComposer.section('OUTPUT FORMAT', ['Raw, dense text. No markdown formatting like bold/italics.'])
  ]);
}
