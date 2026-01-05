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

export function normalizeAgentFolderName(name: string): string {
  const raw = String(name || '').trim();
  if (!raw) return '';
  const noSeparators = raw.replace(/[\\/]+/g, '_');
  const noTraversal = noSeparators.replace(/\.\.+/g, '_');
  return noTraversal.trim();
}

export function getAgentFolderName(agentId: string, agentName?: string | null): string {
  const normalized = normalizeAgentFolderName(agentName || '');
  if (normalized) return normalized;
  if (agentId) return agentId;
  return DEFAULT_AGENT_ID;
}

export function getAgentWorldRoot(agentId: string, agentName?: string | null): string {
  const folder = getAgentFolderName(agentId, agentName);
  return `${WORLD_ROOT}/${folder}`;
}

export function isPathAllowed(path: string, agentId: string, agentName?: string | null): boolean {
  const raw = normalizePath(path);
  if (raw.includes('..')) return false;

  const folder = getAgentFolderName(agentId, agentName);
  const inWorld = ALLOWED_ROOTS.some((root) => raw.startsWith(`${root}/${folder}`));
  const inReadonly = READONLY_ROOTS.some((r) => raw.startsWith(r));

  return inWorld || inReadonly;
}
