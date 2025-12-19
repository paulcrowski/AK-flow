import type { UnifiedContext } from '../../../core/context';

export function formatRecentChat(ctx: UnifiedContext): string {
  const turns = ctx.dialogueAnchor?.recentTurns ?? [];
  return turns.map((t) => `${String((t as any).role || 'unknown').toUpperCase()}: ${String((t as any).text || '')}`).join('\n');
}
