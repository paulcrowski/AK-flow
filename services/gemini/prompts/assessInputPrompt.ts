export function buildAssessInputPrompt(input: { userInput: string; currentPrediction: string }): string {
  const { userInput, currentPrediction } = input;

  return `
                TASK: Analyze this user input.
                INPUT: "${userInput}"
                PREDICTED INPUT WAS: "${currentPrediction}"
                OUTPUT JSON: complexity, surprise, sentiment_valence, keywords
            `;
}
