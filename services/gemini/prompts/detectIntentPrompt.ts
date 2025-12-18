export function buildDetectIntentPrompts(input: { userInput: string }): { basePrompt: string; strictRetryPrompt: string } {
  const { userInput } = input;

  const basePrompt = `
                TASK: Analyze user input for implicit intents.
                INPUT: "${userInput}"
                
                CLASSIFY:
                1. Style Preference: POETIC, SIMPLE, ACADEMIC, or NEUTRAL (default).
                2. Command Type: NONE, SEARCH, VISUALIZE, SYSTEM_CONTROL.
                3. Urgency: LOW, MEDIUM, HIGH.
                
                EXAMPLES:
                "Stop speaking in riddles!" -> { "style": "SIMPLE", "command": "NONE", "urgency": "HIGH" }
                "Show me a dream of mars" -> { "style": "NEUTRAL", "command": "VISUALIZE", "urgency": "MEDIUM" }
                "Explain quantum physics like a professor" -> { "style": "ACADEMIC", "command": "NONE", "urgency": "LOW" }
                "Hello" -> { "style": "NEUTRAL", "command": "NONE", "urgency": "LOW" }

                OUTPUT JSON ONLY.
        `;

  const strictRetryPrompt = `
                OUTPUT RULES (CRITICAL):
                - Output ONLY a raw JSON object. No prose. No markdown.
                - First character MUST be '{'.
                - Keys must be: style, command, urgency.
                
        ${basePrompt}
        `;

  return { basePrompt, strictRetryPrompt };
}
