import type { UnifiedContext } from '../../../core/context';

export function formatMemories(ctx: UnifiedContext): string {
  const episodes = ctx.memoryAnchor?.episodes ?? [];
  const matches = ctx.memoryAnchor?.semanticMatches ?? [];
  const lines = [...episodes.map((e) => `[EPISODE]: ${e}`), ...matches.map((m) => `[MEMORY]: ${m}`)];
  return lines.join('\n') || 'No relevant memories';
}
