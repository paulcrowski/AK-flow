import type { UnifiedContext } from '../../../core/context';
import { PromptComposer } from '../PromptComposer';
import { formatSessionMemory } from '../formatters/formatSessionMemory';

export function buildSessionBlock(ctx: UnifiedContext, maxChars: number): string {
  return PromptComposer.section('SESSION HISTORY (source of truth)', [formatSessionMemory(ctx)], { maxChars });
}
