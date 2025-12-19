import type { UnifiedContext } from '../../../core/context';
import { PromptComposer } from '../PromptComposer';

export function buildGoalBlock(ctx: UnifiedContext): string {
  if (!ctx.activeGoal) return '';
  return PromptComposer.section(`ACTIVE GOAL (${String(ctx.activeGoal.source).toUpperCase()})`, [
    `- Description: ${ctx.activeGoal.description}`,
    `- Priority: ${Number(ctx.activeGoal.priority).toFixed(2)}`
  ]);
}
