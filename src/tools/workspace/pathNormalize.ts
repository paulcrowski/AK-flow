export type NormalizePathResult =
  | { ok: true; path: string }
  | { ok: false; error: string };

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

export const normalizeWorldPath = (input: string): NormalizePathResult => {
  const trimmed = String(input || '').trim();
  const lower = trimmed.toLowerCase();

  if (ROOT_ALIASES.includes(lower)) {
    return { ok: true, path: '' };
  }

  if (trimmed.includes('/') || trimmed.includes('.') || trimmed.includes('\\')) {
    return { ok: true, path: trimmed };
  }

  if (KNOWN_SHORT_FOLDERS.includes(lower)) {
    return { ok: true, path: trimmed };
  }

  const hasSpaces = /\s/.test(trimmed);
  const hasPolish = /[\u0105\u0107\u0119\u0142\u0144\xf3\u015b\u017a\u017c\u0104\u0106\u0118\u0141\u0143\xd3\u015a\u0179\u017b]/.test(trimmed);
  const tooShort = trimmed.length <= 2;

  if (hasSpaces || hasPolish || tooShort) {
    return { ok: false, error: `PATH_AMBIGUOUS: "${trimmed}"` };
  }

  return { ok: true, path: trimmed };
};
