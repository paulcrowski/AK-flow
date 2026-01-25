import type { UnifiedContext } from '../../../core/context';
import { PromptComposer } from '../PromptComposer';
import { SYSTEM_CONFIG } from '../../../core/config/systemConfig';

function buildFocusLine(memory?: UnifiedContext['workingMemory']): string {
  const focus = memory?.focus;
  const cursor = memory?.cursor;
  if (!focus?.domain) return 'Focus: (none)';

  const debugMode = SYSTEM_CONFIG.mainFeatures.DEBUG_MODE;
  const idDisplay = debugMode ? focus.id : `${focus.id?.slice(0, 8)}...`;

  let line = `Focus: ${focus.domain}`;
  if (focus.label) line += ` "${focus.label}"`;
  if (focus.id) line += ` (id=${idDisplay})`;

  if (focus.domain === 'LIBRARY') {
    if (cursor?.chunkCount !== undefined) line += ` chunks=${cursor.chunkCount}`;
    if (cursor?.chunkIndex !== undefined) line += ` idx=${cursor.chunkIndex}`;
    if (cursor?.lastChunkId) {
      const chunkDisplay = debugMode
        ? cursor.lastChunkId
        : `${cursor.lastChunkId.slice(0, 8)}...`;
      line += ` last=${chunkDisplay}`;
    }
  }

  return line;
}

export function buildWorkingMemoryBlock(ctx: UnifiedContext): string {
  const memory = ctx.workingMemory;
  const lines: string[] = [];
  if (!memory) return '';

  lines.push(buildFocusLine(memory));

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
