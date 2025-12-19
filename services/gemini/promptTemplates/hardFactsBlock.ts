import type { UnifiedContext } from '../../../core/context';
import { PromptComposer } from '../PromptComposer';

export function buildHardFactsBlock(ctx: UnifiedContext): string {
  const hardFacts = ctx.hardFacts;
  return PromptComposer.section('HARD FACTS (immutable)', [
    `- Date: ${hardFacts.date}`,
    `- Time: ${hardFacts.time}`,
    `- Agent: ${hardFacts.agentName}`,
    `- Language: ${String((hardFacts as any).language || 'English')}`,
    `- Energy: ${hardFacts.energy.toFixed(0)}%`,
    `- Mode: ${hardFacts.mode}`
  ]);
}
