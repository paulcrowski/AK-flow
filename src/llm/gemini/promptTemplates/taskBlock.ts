import type { ContextMode, UnifiedContext } from '../../../core/context';
import { PromptComposer } from '../PromptComposer';
import { formatTask } from '../formatters/formatTask';

export function buildTaskBlock(ctx: UnifiedContext, mode: ContextMode, taskMaxChars: number): string {
  return PromptComposer.block([formatTask(ctx, mode)], { maxChars: taskMaxChars });
}
