import { WORLD_ROOT, normalizePath } from '../../core/systems/WorldAccess';

export const normalizeFsPath = (input: string) => normalizePath(input).replace(/\/+/g, '/');

export const isAbsolutePath = (value: string) => /^[A-Za-z]:[\\/]/.test(value) || value.startsWith('/');

export const joinPaths = (...parts: string[]) =>
  normalizeFsPath(parts.filter(Boolean).join('/'));

export const dirname = (value: string) => {
  const norm = normalizeFsPath(value);
  const idx = norm.lastIndexOf('/');
  if (idx < 0) return norm;
  if (idx === 0) return '/';
  const head = norm.slice(0, idx);
  if (/^[A-Za-z]:$/.test(head)) return `${head}/`;
  return head;
};

export const splitRelativePath = (value: string) =>
  normalizeFsPath(value).split('/').filter(Boolean);

export const WORLD_ROOT_PATH = normalizeFsPath(WORLD_ROOT);
