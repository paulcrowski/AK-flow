import { AgentType, PacketType } from '../../../types';
import { SYSTEM_CONFIG } from '../../config/systemConfig';
import { eventBus } from '../../EventBus';
import { generateUUID } from '../../../utils/uuid';

export type FileScanLimits = { maxDepth: number; maxCount: number };
export type FileScanSummary = {
  requestedDepth: number;
  requestedCount: number;
  visitedCount: number;
  maxDepthReached: number;
  hitCountLimit: boolean;
  hitDepthLimit: boolean;
  foundCount: number;
  query: string;
  target: string;
  scanAvailable?: boolean;
};
export type FileScanResult = {
  resolvedPath: string;
  found: boolean;
  summary: FileScanSummary | null;
};

type FileScanState = {
  visitedCount: number;
  maxDepthReached: number;
  hitCountLimit: boolean;
  hitDepthLimit: boolean;
};

const isNode =
  typeof process !== 'undefined' &&
  Boolean((process as { versions?: { node?: string } }).versions?.node);

export const normalizeFsPath = (input: string) => String(input || '').replace(/\\/g, '/');
export const joinPaths = (...parts: string[]) =>
  normalizeFsPath(parts.filter(Boolean).join('/')).replace(/\/+/g, '/');
const isAbsolutePath = (value: string) => /^[A-Za-z]:[\\/]/.test(value) || value.startsWith('/');
export const baseName = (value: string) => normalizeFsPath(value).split('/').pop() ?? value;

const FILE_REF_REGEX = /([A-Za-z]:[\\/][^\s]+|\/[^\s]+|[A-Za-z0-9._-]+(?:[\\/][A-Za-z0-9._-]+)+\.[A-Za-z0-9]{1,8}|[A-Za-z0-9._-]+\.[A-Za-z0-9]{1,8})/;
const EVIDENCE_QUERY_REGEX = /\b(co jest w|co zawiera|zawartosc|show|what is in|open|read|file|plik)\b/i;
const DIR_QUERY_REGEX = /\b(katalog|folder|directory|dir|lista plikow|list files?)\b/i;
const DIR_TARGET_REGEX = /(?:katalog|folder|directory|dir|lista plikow|list files?(?: in)?)\s+["'`]?([A-Za-z]:[\\/][^\s"'`]+|\/[^\s"'`]+|[A-Za-z0-9._-]+(?:[\\/][A-Za-z0-9._-]+)*)/i;
const DIR_TRAILING_REGEX = /([A-Za-z]:[\\/][^\s"'`]+[\\/]|\/[^\s"'`]+\/|[A-Za-z0-9._-]+(?:[\\/][A-Za-z0-9._-]+)*\/)/;
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'ak-nexus', 'database', '_patches', '_workbench']);
const safeCwd = typeof process !== 'undefined' && typeof process.cwd === 'function' ? process.cwd() : '';
export const getSafeCwd = () => safeCwd;

const fileLookupCache = new Map<string, string>();

export const getFileScanLimits = (): FileScanLimits => {
  const config = (SYSTEM_CONFIG as any).siliconBeing ?? {};
  const depthRaw = Number(config.fileScanMaxDepth);
  const countRaw = Number(config.fileScanMaxCount);
  const maxDepth = Number.isFinite(depthRaw) ? Math.max(0, Math.floor(depthRaw)) : 6;
  const maxCount = Number.isFinite(countRaw) ? Math.max(0, Math.floor(countRaw)) : 2000;
  return { maxDepth, maxCount };
};

type FsModule = typeof import('fs/promises');
let fsPromise: Promise<FsModule | null> | null = null;

const loadFs = async (): Promise<FsModule | null> => {
  if (!isNode) return null;
  if (!fsPromise) {
    fsPromise = import('fs/promises').catch(() => null);
  }
  return fsPromise;
};

export const questionRequiresEvidence = (input: string) => {
  const normalized = String(input || '').toLowerCase();
  if (FILE_REF_REGEX.test(normalized)) return true;
  if (DIR_QUERY_REGEX.test(normalized)) return false;
  return EVIDENCE_QUERY_REGEX.test(normalized);
};

export const extractFileTarget = (input: string | null): string | null => {
  if (!input) return null;
  const match = String(input).match(FILE_REF_REGEX);
  if (!match?.[1]) return null;
  return match[1].replace(/[),.;:!?"']+$/, '');
};

export const extractDirectoryTarget = (input: string | null): string | null => {
  if (!input) return null;
  const raw = String(input);
  const keywordMatch = raw.match(DIR_TARGET_REGEX);
  if (keywordMatch?.[1]) return keywordMatch[1].replace(/[),.;:!?"']+$/, '');
  const trailingMatch = raw.match(DIR_TRAILING_REGEX);
  if (trailingMatch?.[1]) {
    const trimmed = raw.replace(/[),.;:!?"']+$/, '');
    if (trimmed.endsWith(trailingMatch[1])) {
      return trailingMatch[1].replace(/[),.;:!?"']+$/, '');
    }
  }
  return null;
};

const findFileByName = async (
  root: string,
  target: string,
  depth: number,
  limits: FileScanLimits,
  state: FileScanState,
  fsModule: FsModule
): Promise<string | null> => {
  if (depth > limits.maxDepth) {
    state.hitDepthLimit = true;
    state.maxDepthReached = Math.max(state.maxDepthReached, depth);
    return null;
  }
  state.maxDepthReached = Math.max(state.maxDepthReached, depth);
  let entries: any[] = [];
  try {
    entries = await fsModule.readdir(root, { withFileTypes: true });
  } catch {
    return null;
  }
  for (const entry of entries) {
    if (state.visitedCount >= limits.maxCount) {
      state.hitCountLimit = true;
      return null;
    }
    state.visitedCount += 1;
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      const found = await findFileByName(
        joinPaths(root, entry.name),
        target,
        depth + 1,
        limits,
        state,
        fsModule
      );
      if (found) return found;
    } else if (entry.isFile() && entry.name.toLowerCase() === target.toLowerCase()) {
      return joinPaths(root, entry.name);
    }
  }
  return null;
};

const emitFileScanSummary = (summary: FileScanSummary) => {
  eventBus.publish({
    id: generateUUID(),
    timestamp: Date.now(),
    source: AgentType.CORTEX_FLOW,
    type: PacketType.FILE_SCAN_SUMMARY,
    payload: summary,
    priority: 0.5
  });
  if (summary.hitCountLimit || summary.hitDepthLimit) {
    eventBus.publish({
      id: generateUUID(),
      timestamp: Date.now(),
      source: AgentType.CORTEX_FLOW,
      type: PacketType.FILE_SCAN_LIMIT_REACHED,
      payload: summary,
      priority: 0.6
    });
  }
};

export const resolveObservationPath = async (
  rawTarget: string,
  options?: { query?: string; candidateRoots?: string[]; limits?: FileScanLimits }
): Promise<FileScanResult> => {
  const normalized = String(rawTarget || '').trim();
  if (!normalized) {
    return { resolvedPath: normalized, found: false, summary: null };
  }
  if (isAbsolutePath(normalized)) {
    return { resolvedPath: normalized, found: true, summary: null };
  }
  if (normalized.includes('/') || normalized.includes('\\')) {
    return {
      resolvedPath: safeCwd ? joinPaths(safeCwd, normalized) : normalized,
      found: true,
      summary: null
    };
  }
  const cached = fileLookupCache.get(normalized);
  if (cached) {
    return { resolvedPath: cached, found: true, summary: null };
  }
  const limits = options?.limits ?? getFileScanLimits();
  const state: FileScanState = {
    visitedCount: 0,
    maxDepthReached: 0,
    hitCountLimit: false,
    hitDepthLimit: false
  };
  const candidateRoots = options?.candidateRoots ?? (safeCwd ? [joinPaths(safeCwd, 'src'), safeCwd] : []);
  const fsModule = await loadFs();
  if (!fsModule) {
    const summary: FileScanSummary = {
      requestedDepth: limits.maxDepth,
      requestedCount: limits.maxCount,
      visitedCount: 0,
      maxDepthReached: 0,
      hitCountLimit: false,
      hitDepthLimit: false,
      foundCount: 0,
      query: String(options?.query ?? ''),
      target: normalized,
      scanAvailable: false
    };
    emitFileScanSummary(summary);
    const fallback = safeCwd ? joinPaths(safeCwd, normalized) : normalized;
    fileLookupCache.set(normalized, fallback);
    return { resolvedPath: fallback, found: false, summary };
  }
  let foundPath: string | null = null;
  for (const root of candidateRoots) {
    const found = await findFileByName(root, normalized, 0, limits, state, fsModule);
    if (found) {
      foundPath = found;
      break;
    }
  }
  const summary: FileScanSummary = {
    requestedDepth: limits.maxDepth,
    requestedCount: limits.maxCount,
    visitedCount: state.visitedCount,
    maxDepthReached: state.maxDepthReached,
    hitCountLimit: state.hitCountLimit,
    hitDepthLimit: state.hitDepthLimit,
    foundCount: foundPath ? 1 : 0,
    query: String(options?.query ?? ''),
    target: normalized
  };
  emitFileScanSummary(summary);
  const resolvedPath = foundPath || (safeCwd ? joinPaths(safeCwd, normalized) : normalized);
  fileLookupCache.set(normalized, resolvedPath);
  return { resolvedPath, found: Boolean(foundPath), summary };
};
