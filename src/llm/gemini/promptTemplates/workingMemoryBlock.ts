import type { UnifiedContext } from '../../../core/context';
import { PromptComposer } from '../PromptComposer';

export function buildWorkingMemoryBlock(ctx: UnifiedContext): string {
  const memory = ctx.workingMemory;
  const lines: string[] = [];
  const libId = memory?.lastLibraryDocId ?? null;
  const libName = memory?.lastLibraryDocName ?? null;
  const worldPath = memory?.lastWorldPath ?? null;
  const artId = memory?.lastArtifactId ?? null;
  const artName = memory?.lastArtifactName ?? null;

  if (libId) {
    const display = libName || libId;
    lines.push(`- Active library doc: "${display}" (id=${libId})`);
    lines.push('  Use this id for "this book"/"that document"/"ta ksiazka"/"ten dokument". Do not SEARCH_LIBRARY.');
  } else {
    lines.push('- Active library doc: none');
  }

  if (worldPath) {
    lines.push(`- Last world path: ${worldPath}`);
    lines.push('  Use for "here/there"/"tutaj/tam"/"this folder".');
  } else {
    lines.push('- Last world path: none');
  }

  if (artId) {
    const display = artName || artId;
    lines.push(`- Last artifact: "${display}" (id=${artId})`);
    lines.push('  Use for "this file"/"this artifact"/"ten plik".');
  } else {
    lines.push('- Last artifact: none');
  }

  lines.push('CAPABILITIES:');
  lines.push('- WORLD: LIST_DIR, READ_FILE, WRITE_FILE, APPEND_FILE');
  lines.push('- LIBRARY: READ_LIBRARY_DOC, LIST_LIBRARY_CHUNKS, READ_LIBRARY_CHUNK, READ_LIBRARY_RANGE');
  lines.push('- ARTIFACTS: CREATE, READ_ARTIFACT, APPEND, REPLACE');
  lines.push('RULES:');
  lines.push('- You have WORLD access. Do not claim you cannot access local files.');
  lines.push('- If an active library doc is set, use its id instead of SEARCH_LIBRARY.');

  return PromptComposer.section('WORKING MEMORY (anchors)', lines);
}
