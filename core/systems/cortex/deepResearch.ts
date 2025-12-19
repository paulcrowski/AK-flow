import { CortexService } from '../../../services/gemini';
import { createLogger } from '../../services/LoggerService';

const log = createLogger('DeepResearch');

const inFlightTopics = new Set<string>();
const completedTopics = new Set<string>();

export async function performDeepResearch(topic: string, context: string) {
  if (completedTopics.has(topic) || inFlightTopics.has(topic)) {
    log.debug(`Skipping duplicate/in-flight topic: ${topic}`);
    return null;
  }

  inFlightTopics.add(topic);
  try {
    const result = await CortexService.performDeepResearch(topic, context);
    completedTopics.add(topic);
    return result;
  } finally {
    inFlightTopics.delete(topic);
  }
}
