import { isAbsolutePath, joinPaths, normalizeFsPath } from './pathUtils';

export type NormalizePathResult =
  | { ok: true; path: string; relative: string; basePath: string }
  | { ok: false; error: string };

export type NormalizePathOptions = {
  basePath: string;
  allowRoots?: string[];
};

const ROOT_ALIASES = ['', '/', '.', 'root', 'world root', 'glowny katalog', 'home', 'start'];

const KNOWN_SHORT_FOLDERS = [
  'src',
  'app',
  'bin',
  'tmp',
  'log',
  'doc',
  'img',
  'docs',
  'code',
  'public',
  'dist',
  'build',
  'data',
  'logs',
  'test',
  'tests',
  'lib',
  'pkg',
  'api'
];

const decodePathValue = (value: string): { ok: true; value: string } | { ok: false; error: string } => {
  if (!value.includes('%')) return { ok: true, value };
  try {
    return { ok: true, value: decodeURIComponent(value) };
  } catch {
    return { ok: false, error: 'PATH_NOT_ALLOWED' };
  }
};

const normalizeSegments = (value: string): { ok: true; normalized: string; segments: string[] } | { ok: false; error: string } => {
  const normalized = normalizeFsPath(value);
  const rawSegments = normalized.split('/');
  const segments: string[] = [];
  for (const seg of rawSegments) {
    if (!seg || seg === '.') continue;
    if (seg === '..') {
      return { ok: false, error: 'PATH_NOT_ALLOWED' };
    }
    segments.push(seg);
  }
  return { ok: true, normalized, segments };
};

export const normalizeWorldPath = (input: string, options: NormalizePathOptions): NormalizePathResult => {
  const trimmed = String(input || '').trim();
  const lower = trimmed.toLowerCase();
  const basePath = normalizeFsPath(options.basePath || '');

  if (!basePath) {
    return { ok: false, error: 'PATH_NOT_ALLOWED' };
  }

  if (ROOT_ALIASES.includes(lower)) {
    return { ok: true, path: basePath, relative: '', basePath };
  }

  let candidate = trimmed;
  const lowerCandidate = candidate.toLowerCase();
  const hasSeparators = candidate.includes('/') || candidate.includes('\\');
  const hasDot = candidate.includes('.');

  if (!hasSeparators && !hasDot && !KNOWN_SHORT_FOLDERS.includes(lowerCandidate)) {
    const hasSpaces = /\s/.test(candidate);
    const hasPolish = /[\u0105\u0107\u0119\u0142\u0144\xf3\u015b\u017a\u017c\u0104\u0106\u0118\u0141\u0143\xd3\u015a\u0179\u017b]/.test(candidate);
    const tooShort = candidate.length <= 2;

    if (hasSpaces || hasPolish || tooShort) {
      return { ok: false, error: `PATH_AMBIGUOUS: "${candidate}"` };
    }
  }

  const decoded = decodePathValue(candidate);
  if (!decoded.ok) return { ok: false, error: decoded.error };

  const normalized = normalizeSegments(decoded.value);
  if (!normalized.ok) return { ok: false, error: normalized.error };

  const absolute = isAbsolutePath(normalized.normalized);
  const allowRoots = [basePath, ...(options.allowRoots || [])]
    .map((root) => normalizeFsPath(root))
    .filter(Boolean);

  if (absolute) {
    const matchedRoot = allowRoots.find(
      (root) => normalized.normalized === root || normalized.normalized.startsWith(`${root}/`)
    );
    if (!matchedRoot) {
      return { ok: false, error: 'PATH_NOT_ALLOWED' };
    }
    const relative = normalized.normalized.slice(matchedRoot.length).replace(/^\/+/, '');
    return { ok: true, path: normalized.normalized, relative, basePath: matchedRoot };
  }

  const relative = normalized.segments.join('/');
  const resolved = relative ? joinPaths(basePath, relative) : basePath;
  if (resolved !== basePath && !resolved.startsWith(`${basePath}/`)) {
    return { ok: false, error: 'PATH_NOT_ALLOWED' };
  }

  return { ok: true, path: resolved, relative, basePath };
};
