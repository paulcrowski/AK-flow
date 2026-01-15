import type { UnifiedContext } from '../../../core/context';
import { PromptComposer } from '../PromptComposer';

export function buildWorkingMemoryBlock(ctx: UnifiedContext): string {
  const memory = ctx.workingMemory;
  const lines: string[] = [];
  if (!memory) return '';

  const libId = memory.lastLibraryDocId ?? null;
  const libName = memory.lastLibraryDocName ?? null;
  const libCount = memory.lastLibraryDocChunkCount ?? null;
  const worldPath = memory.lastWorldPath ?? null;
  const artId = memory.lastArtifactId ?? null;
  const artName = memory.lastArtifactName ?? null;
  const activeDomain = memory.activeDomain ?? null;
  const lastTool = memory.lastTool ?? null;

  if (activeDomain) {
    lines.push(`Domain: ${activeDomain}`);
  }

  if (libId) {
    const display = libName || libId;
    const countSuffix = typeof libCount === 'number' ? `, chunks=${libCount}` : '';
    lines.push(`Library: "${display}" (id=${libId}${countSuffix})`);
  }

  if (worldPath) {
    lines.push(`World path: ${worldPath}`);
  }

  if (artId) {
    const display = artName || artId;
    lines.push(`Artifact: "${display}" (id=${artId})`);
  }

  if (lastTool?.tool) {
    const okStr = lastTool.ok ? 'ok' : 'fail';
    const domainMatch = lastTool.domainExpected && lastTool.domainActual
      ? (lastTool.domainExpected === lastTool.domainActual ? ' domain-ok' : ' domain-mismatch')
      : '';
    lines.push(`Last tool: ${lastTool.tool} ${okStr}${domainMatch}`);
  }

  if (lines.length === 0) return '';

  lines.push('Capabilities: WORLD/LIBRARY/ARTIFACTS');

  return PromptComposer.section('WORKING MEMORY', lines);
}
