export function buildDeepResearchPrompt(input: { query: string; context: string }): string {
  const { query, context } = input;

  return `
                      ROLE: You are AK-FLOW, an advanced intelligence.
                      TASK: Conduct a Deep Research Sweep on: "${query}"
                      CONTEXT: ${context}
                      INSTRUCTIONS:
                      1. USE the Google Search tool to find REAL, verifyable facts.
                      2. DO NOT be vague. Extract specific data points, dates, and figures.
                      3. SYNTHESIZE the findings into a high-density "Intelligence Briefing".
                      OUTPUT FORMAT: Raw, dense text. No markdown formatting like bold/italics.
                  `;
}
