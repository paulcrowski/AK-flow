import type { ConversationTurn } from './types';

const THOUGHT_HISTORY_LIMIT = 3;
const SPEECH_HISTORY_LIMIT = 10;

export function pruneHistory(history: ConversationTurn[]): ConversationTurn[] {
  const thoughts = history.filter((t) => t.type === 'thought');
  const speeches = history.filter((t) => t.type === 'speech');
  const others = history.filter((t) => t.type !== 'thought' && t.type !== 'speech');

  const prunedThoughts = thoughts.slice(-THOUGHT_HISTORY_LIMIT);
  const prunedSpeeches = speeches.slice(-SPEECH_HISTORY_LIMIT);

  return [...others, ...prunedThoughts, ...prunedSpeeches].sort((a, b) => history.indexOf(a) - history.indexOf(b));
}

export function formatHistoryForCortex(history: ConversationTurn[]): string[] {
  const pruned = pruneHistory(history);
  return pruned.map((t) => {
    if (t.type === 'thought') return `[INTERNAL_THOUGHT]: ${t.text}`;
    if (t.type === 'speech') return `[ASSISTANT_SAID]: ${t.text}`;
    if (t.type === 'visual') return `[VISUAL_CORTEX]: ${t.text}`;
    if (t.type === 'intel') return `[TOOL_RESULT]: ${t.text}`;
    if (t.type === 'action') return `[MY_ACTION]: ${t.text}`;
    if (t.type === 'tool_result') return `[TOOL_RESULT]: ${t.text}`;
    return `[USER]: ${t.text}`;
  });
}
