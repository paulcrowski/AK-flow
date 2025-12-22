import type { UnifiedContext } from '../../../core/context';
import { PromptComposer } from '../PromptComposer';
import { formatRecentChat } from '../formatters/formatRecentChat';

export function buildChatBlock(ctx: UnifiedContext, maxChars: number): string {
  const recentChat = formatRecentChat(ctx) || 'No prior conversation';
  return PromptComposer.section('RECENT CONVERSATION', [recentChat], { maxChars });
}
