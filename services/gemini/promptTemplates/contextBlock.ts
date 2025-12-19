import type { UnifiedContext } from '../../../core/context';
import { PromptComposer } from '../PromptComposer';
import { formatMemories } from '../formatters/formatMemories';

export function buildContextBlock(ctx: UnifiedContext, maxChars: number): string {
  return PromptComposer.section('CONTEXT', [formatMemories(ctx)], { maxChars });
}
