import type { UnifiedContext } from '../../../core/context';

export function formatMemories(ctx: UnifiedContext): string {
  const sessionChunks = ctx.memoryAnchor?.sessionChunks ?? [];
  const identityShards = ctx.memoryAnchor?.identityShards ?? [];
  const episodes = ctx.memoryAnchor?.episodes ?? [];
  const matches = ctx.memoryAnchor?.semanticMatches ?? [];
  const lines = [
    ...sessionChunks.map((c) => `[SESSION_CHUNK]: ${c}`),
    ...identityShards.map((s) => `[IDENTITY_SHARD]: ${s}`),
    ...episodes.map((e) => `[EPISODE]: ${e}`),
    ...matches.map((m) => `[MEMORY]: ${m}`)
  ];
  return lines.join('\n') || 'No relevant memories';
}
