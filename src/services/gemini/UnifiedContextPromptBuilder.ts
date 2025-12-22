import type { ContextMode, UnifiedContext } from '../../core/context';
import { PromptComposer } from './PromptComposer';
import { formatStyleConstraints } from './formatters/formatStyleConstraints';
import { buildHardFactsBlock } from './promptTemplates/hardFactsBlock';
import { buildIdentityBlock } from './promptTemplates/identityBlock';
import { buildStateBlock } from './promptTemplates/stateBlock';
import { buildSessionBlock } from './promptTemplates/sessionBlock';
import { buildContextBlock } from './promptTemplates/contextBlock';
import { buildChatBlock } from './promptTemplates/chatBlock';
import { buildGoalBlock } from './promptTemplates/goalBlock';
import { buildTaskBlock } from './promptTemplates/taskBlock';

export type UnifiedContextPromptBudgets = {
  contextMaxChars?: number;
  recentChatMaxChars?: number;
  sessionMemoryMaxChars?: number;
  taskMaxChars?: number;
};

const DEFAULT_BUDGETS: Required<UnifiedContextPromptBudgets> = {
  contextMaxChars: 8000,
  recentChatMaxChars: 6000,
  sessionMemoryMaxChars: 2000,
  taskMaxChars: 2500
};

export const UnifiedContextPromptBuilder = {
  build(ctx: UnifiedContext, mode: ContextMode, budgets?: UnifiedContextPromptBudgets): string {
    const b = { ...DEFAULT_BUDGETS, ...(budgets || {}) };

    const hardFactsBlock = buildHardFactsBlock(ctx);
    const identityBlock = buildIdentityBlock(ctx);
    const styleBlock = PromptComposer.section('STYLE CONSTRAINTS (MUST FOLLOW)', [formatStyleConstraints(ctx)]);
    const stateBlock = buildStateBlock(ctx);
    const sessionBlock = buildSessionBlock(ctx, b.sessionMemoryMaxChars);
    const contextBlock = buildContextBlock(ctx, b.contextMaxChars);
    const chatBlock = buildChatBlock(ctx, b.recentChatMaxChars);
    const goalBlock = buildGoalBlock(ctx);
    const taskBlock = buildTaskBlock(ctx, mode, b.taskMaxChars);

    return PromptComposer.join([
      hardFactsBlock,
      identityBlock,
      styleBlock,
      stateBlock,
      sessionBlock,
      contextBlock,
      chatBlock,
      goalBlock,
      taskBlock
    ]);
  }
};
