export const FILE_EXTENSIONS = /\.(md|txt|ts|js|jsx|tsx|json|yaml|yml|py|log|csv|html|css|sql)$/i;
export const TOP_DIRS = ['code', 'docs', 'notes', 'engineering', 'research', 'vision', 'todolist', 'src'];
export const WORLD_VERBS = ['lista', 'list', 'dir', 'folder', 'katalog', 'directory', 'ls', 'list files', 'list dir'];
export const READ_VERBS = ['przeczytaj', 'pokaz', 'otworz', 'wyswietl', 'read', 'show', 'open', 'display'];
export const LIBRARY_STEMS = ['ksiazk', 'dokument', 'raport', 'pdf', 'book', 'document', 'report', 'bibliotek', 'library'];
const ARTIFACT_ID_PATTERN = /art-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
const UUID_PATTERN = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i;

export function normalizeRoutingInput(input: string): string {
  return String(input || '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\u0142/g, 'l')
    .replace(/\u0141/g, 'l')
    .toLowerCase();
}

export function looksLikeWorldPath(input: string): boolean {
  const x = String(input || '').trim();
  if (!x) return false;
  if (x.startsWith('/')) return true;
  if (x.includes('/')) return true;
  if (TOP_DIRS.some((d) => x === d || x.startsWith(`${d}/`))) return true;
  if (FILE_EXTENSIONS.test(x)) return true;
  return false;
}

export function looksLikeArtifactRef(input: string): boolean {
  const x = String(input || '').trim().toLowerCase();
  if (looksLikeWorldPath(x)) return false;
  if (x.includes('artefakt') || x.includes('artifact')) return true;
  return ARTIFACT_ID_PATTERN.test(x);
}

export function hasWorldIntent(input: string): boolean {
  const lower = normalizeRoutingInput(input);
  return WORLD_VERBS.some((v) => lower.includes(v));
}

export function hasReadIntent(input: string): boolean {
  const lower = normalizeRoutingInput(input);
  return READ_VERBS.some((v) => lower.includes(v));
}

export function looksLikeLibraryIntent(input: string): boolean {
  const lower = normalizeRoutingInput(input);
  return LIBRARY_STEMS.some((stem) => lower.includes(stem));
}

export function routeDomain(input: string, hasWorldAccess: boolean): 'ARTIFACT' | 'WORLD' | 'LIBRARY' {
  const raw = String(input || '').trim();
  if (/[\\/]/.test(raw)) return 'WORLD';
  if (ARTIFACT_ID_PATTERN.test(raw)) return 'ARTIFACT';
  if (UUID_PATTERN.test(raw)) return 'LIBRARY';
  const hasLibraryHint = looksLikeLibraryIntent(raw);
  if (hasLibraryHint && !raw.includes('/')) return 'LIBRARY';
  if (looksLikeWorldPath(raw)) return 'WORLD';
  if (hasLibraryHint) return 'LIBRARY';
  if (hasReadIntent(input)) return 'LIBRARY';
  if (hasWorldAccess && hasWorldIntent(input)) return 'WORLD';
  return 'ARTIFACT';
}
