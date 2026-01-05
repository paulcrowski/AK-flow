import { DEFAULT_AGENT_ID, normalizeAgentFolderName } from '../core/systems/WorldAccess';

export type WorldDirectoryMode = 'world' | 'agent';

export type WorldDirectoryStatus = {
  ok: boolean;
  mode?: WorldDirectoryMode;
  name?: string;
  agentId?: string;
  detail?: string;
  reason?: 'UNSUPPORTED' | 'NOT_SELECTED' | 'PERMISSION_DENIED' | 'CANCELLED' | 'NAME_MISMATCH' | 'ERROR';
};

type StoredHandle = {
  handle: FileSystemDirectoryHandle;
  name: string;
};

const isSupported = () =>
  typeof window !== 'undefined' && typeof (window as { showDirectoryPicker?: () => unknown }).showDirectoryPicker === 'function';

const normalizeName = (name: string) => name.trim().toLowerCase();
const DEFAULT_AGENT_FOLDER = normalizeName(DEFAULT_AGENT_ID);
const isWorldRootName = (name: string) => normalizeName(name) === '_world';

let sharedWorldRoot: StoredHandle | null = null;
const agentRoots = new Map<string, StoredHandle>();

export type WorldDirectorySelection = {
  mode: WorldDirectoryMode;
  name: string;
};

const toShortId = (input: string) => {
  const raw = String(input || '').trim();
  let hash = 2166136261;
  for (let i = 0; i < raw.length; i += 1) {
    hash ^= raw.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const hex = (hash >>> 0).toString(16).padStart(8, '0');
  return `ak-flow-world-${hex}`.slice(0, 32);
};

const ensurePermission = async (
  handle: FileSystemDirectoryHandle,
  mode: FileSystemPermissionMode
): Promise<boolean> => {
  if (typeof handle.queryPermission !== 'function') return true;
  const status = await handle.queryPermission({ mode });
  return status === 'granted';
};

const isSecure = () => typeof window !== 'undefined' && window.isSecureContext === true;

export const canUseFileSystemAccess = () => isSupported() && isSecure();

export const getWorldDirectoryStatus = (agentId: string | null): WorldDirectoryStatus => {
  if (!isSupported()) {
    return { ok: false, reason: 'UNSUPPORTED' };
  }
  if (sharedWorldRoot) {
    return { ok: true, mode: 'world', name: sharedWorldRoot.name, agentId: agentId ?? undefined };
  }
  if (agentId) {
    const entry = agentRoots.get(agentId);
    if (entry) {
      return { ok: true, mode: 'agent', name: entry.name, agentId };
    }
  }
  return { ok: false, reason: 'NOT_SELECTED' };
};

export const getWorldDirectorySelection = (agentId: string): WorldDirectorySelection | null => {
  if (sharedWorldRoot) {
    return { mode: 'world', name: sharedWorldRoot.name };
  }
  const entry = agentRoots.get(agentId);
  if (entry) {
    return { mode: 'agent', name: entry.name };
  }
  return null;
};

export const requestWorldDirectoryHandle = async (
  agentId: string,
  agentName?: string | null
): Promise<WorldDirectoryStatus> => {
  if (!isSupported()) {
    return { ok: false, reason: 'UNSUPPORTED' };
  }
  try {
    const picker = (window as { showDirectoryPicker?: (options?: any) => Promise<FileSystemDirectoryHandle> })
      .showDirectoryPicker;
    if (!picker) return { ok: false, reason: 'UNSUPPORTED' };
    const handle = await (window as any).showDirectoryPicker({ id: toShortId(agentId) });
    const name = String(handle?.name || '').trim();
    const normalized = normalizeName(name);
    const worldRoot = isWorldRootName(name);
    const normalizedAgentName = normalizeName(normalizeAgentFolderName(agentName || ''));
    const matchesAgentName = normalizedAgentName ? normalized === normalizedAgentName : false;
    const matchesAgentId = normalized === normalizeName(agentId);
    const matchesDefault = !normalizedAgentName && normalized === DEFAULT_AGENT_FOLDER;
    const expectedName = worldRoot ? '_world' : (normalizeAgentFolderName(agentName || '') || agentId || DEFAULT_AGENT_ID);
    if (!worldRoot && !matchesAgentName && !matchesAgentId && !matchesDefault) {
      return { ok: false, reason: 'NAME_MISMATCH' };
    }
    if (typeof handle.requestPermission === 'function') {
      const status = await handle.requestPermission({ mode: 'readwrite' });
      if (status !== 'granted') {
        return { ok: false, reason: 'PERMISSION_DENIED' };
      }
    }
    if (worldRoot) {
      sharedWorldRoot = { handle, name: name || expectedName };
    } else {
      agentRoots.set(agentId, { handle, name: name || expectedName });
    }
    return {
      ok: true,
      mode: worldRoot ? 'world' : 'agent',
      name: name || expectedName,
      agentId: worldRoot ? undefined : agentId
    };
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      return { ok: false, reason: 'CANCELLED' };
    }
    if (error?.name === 'NotAllowedError' || error?.name === 'SecurityError') {
      return { ok: false, reason: 'PERMISSION_DENIED' };
    }
    const detail = [error?.name, error?.message].filter(Boolean).join(': ');
    console.warn('[WorldDirectoryAccess] showDirectoryPicker failed', error);
    return { ok: false, reason: 'ERROR', detail: detail || undefined };
  }
};

export const getWorldDirectoryHandle = async (params: {
  agentId: string;
  agentFolderName?: string;
  create?: boolean;
  mode?: FileSystemPermissionMode;
}): Promise<FileSystemDirectoryHandle | null> => {
  if (!isSupported()) return null;
  const mode = params.mode ?? 'read';
  const folderName = params.agentFolderName || params.agentId;
  if (sharedWorldRoot) {
    const allowed = await ensurePermission(sharedWorldRoot.handle, mode);
    if (!allowed) return null;
    try {
      return await sharedWorldRoot.handle.getDirectoryHandle(folderName, { create: Boolean(params.create) });
    } catch {
      return null;
    }
  }
  const entry = agentRoots.get(params.agentId);
  if (!entry) return null;
  const allowed = await ensurePermission(entry.handle, mode);
  return allowed ? entry.handle : null;
};
