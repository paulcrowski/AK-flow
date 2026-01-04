export const WORLD_ROOT = '/_world';
export const DEFAULT_AGENT_ID = 'americao';

const ALLOWED_ROOTS = [WORLD_ROOT];
const READONLY_ROOTS = [
  typeof process !== 'undefined' && typeof process.cwd === 'function'
    ? process.cwd().replace(/\\/g, '/')
    : ''
].filter(Boolean);

export function normalizePath(input: string): string {
  return String(input || '').replace(/\\/g, '/');
}

export function getAgentWorldRoot(agentId: string): string {
  return `${WORLD_ROOT}/${agentId}`;
}

export function isPathAllowed(path: string, agentId: string): boolean {
  const raw = normalizePath(path);
  if (raw.includes('..')) return false;

  const inWorld = ALLOWED_ROOTS.some((root) => raw.startsWith(`${root}/${agentId}`));
  const inReadonly = READONLY_ROOTS.some((r) => raw.startsWith(r));

  return inWorld || inReadonly;
}
