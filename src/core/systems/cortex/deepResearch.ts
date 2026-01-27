import { CortexService } from '../../../llm/gemini';
import { createLogger } from '../../services/LoggerService';

const log = createLogger('DeepResearch');

export type DeepResearchRuntime = {
  inFlightTopics: Set<string>;
  completedTopics: Set<string>;
};

export const createDeepResearchRuntime = (): DeepResearchRuntime => ({
  inFlightTopics: new Set<string>(),
  completedTopics: new Set<string>()
});

export async function performDeepResearch(topic: string, context: string, runtime?: DeepResearchRuntime) {
  const state = runtime ?? createDeepResearchRuntime();
  if (state.completedTopics.has(topic) || state.inFlightTopics.has(topic)) {
    log.debug(`Skipping duplicate/in-flight topic: ${topic}`);
    return null;
  }

  state.inFlightTopics.add(topic);
  try {
    const result = await CortexService.performDeepResearch(topic, context);
    state.completedTopics.add(topic);
    return result;
  } finally {
    state.inFlightTopics.delete(topic);
  }
}
