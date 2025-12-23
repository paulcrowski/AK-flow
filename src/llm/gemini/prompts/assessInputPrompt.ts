import { PromptComposer } from '../PromptComposer';

export function buildAssessInputPrompt(input: { userInput: string; currentPrediction: string }): string {
  const { userInput, currentPrediction } = input;

  return PromptComposer.join([
    PromptComposer.section('TASK', ['Analyze this user input.']),
    PromptComposer.section('INPUT', [`"${userInput}"`]),
    PromptComposer.section('PREDICTED INPUT WAS', [`"${currentPrediction}"`]),
    PromptComposer.section('OUTPUT JSON', ['complexity, surprise, sentiment_valence, keywords'])
  ]);
}
