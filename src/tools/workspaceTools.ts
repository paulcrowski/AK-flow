import type { ToolParserDeps } from './toolParser';
import {
  downloadLibraryDocumentText,
  findLibraryDocumentByName,
  getLibraryChunkByIndex,
  listLibraryChunks,
  searchLibraryChunks
} from '../services/LibraryService';
import { MemoryService, getCurrentAgentId, getCurrentAgentName } from '../services/supabase';
import { AgentType, PacketType } from '../types';
import { withTimeout } from './toolRuntime';
import { useArtifactStore } from '../stores/artifactStore';
import { getCognitiveState } from '../stores/cognitiveStore';
import { eventBus } from '../core/EventBus';
import { emitToolError, emitToolIntent, emitToolResult as emitToolResultContract } from '../core/telemetry/toolContract';
import { validateToolResult } from '../core/tools/validateToolResult';
import { evidenceLedger } from '../core/systems/EvidenceLedger';
import { DEFAULT_AGENT_ID, WORLD_ROOT, getAgentFolderName, getAgentWorldRoot, isPathAllowed, normalizePath } from '../core/systems/WorldAccess';
import { generateUUID } from '../utils/uuid';
import { getWorldDirectoryHandle, getWorldDirectorySelection } from './worldDirectoryAccess';

export const WORKSPACE_TAG_REGEX = /\[(SEARCH_LIBRARY|LIST_LIBRARY_CHUNKS|READ_LIBRARY_CHUNK|READ_LIBRARY_DOC|READ_LIBRARY_RANGE|SEARCH_IN_REPO|READ_FILE|READ_FILE_CHUNK|READ_FILE_RANGE|LIST_DIR|LIST_FILES|READ_WORLD_FILE|READ_WORLD|WRITE_WORLD_FILE|APPEND_WORLD_FILE):\s*([^\]]+?)\]/i;

export type WorldToolName = 'LIST_DIR' | 'READ_FILE' | 'WRITE_FILE' | 'APPEND_FILE';

export type WorldToolResult = {
  ok: boolean;
  path: string;
  content?: string;
  entries?: string[];
  error?: string;
  evidenceId?: string;
};

const emitToolResult = (
  tool: string,
  intentId: string,
  payload?: Record<string, unknown>,
  options?: { publish?: (packet: any) => void; makeId?: () => string; priority?: number }
): void => {
  validateToolResult(tool, payload ?? {});
  emitToolResultContract(tool, intentId, payload, options);
};

type FsModule = typeof import('fs/promises');
let fsModule: FsModule | null = null;
const IS_NODE =
  typeof process !== 'undefined' &&
  Boolean((process as { versions?: { node?: string } }).versions?.node);

const getFs = async (): Promise<FsModule | null> => {
  if (!IS_NODE) return null;
  if (!fsModule) {
    fsModule = await import('fs/promises');
  }
  return fsModule;
};

const normalizeFsPath = (input: string) => normalizePath(input).replace(/\/+/g, '/');
const isAbsolutePath = (value: string) => /^[A-Za-z]:[\\/]/.test(value) || value.startsWith('/');
const joinPaths = (...parts: string[]) =>
  normalizeFsPath(parts.filter(Boolean).join('/'));
const dirname = (value: string) => {
  const norm = normalizeFsPath(value);
  const idx = norm.lastIndexOf('/');
  if (idx < 0) return norm;
  if (idx === 0) return '/';
  const head = norm.slice(0, idx);
  if (/^[A-Za-z]:$/.test(head)) return `${head}/`;
  return head;
};
const splitRelativePath = (value: string) => normalizeFsPath(value).split('/').filter(Boolean);
const WORLD_ROOT_PATH = normalizeFsPath(WORLD_ROOT);

const updateWorldAnchor = (path: string) => {
  try {
    const state = getCognitiveState();
    if (state?.hydrate) state.hydrate({ lastWorldPath: path, activeDomain: 'WORLD' });
  } catch {
    // ignore state sync issues
  }
};

const updateLibraryAnchor = (
  documentId: string,
  documentName?: string | null,
  chunkCount?: number | null
) => {
  try {
    const state = getCognitiveState();
    if (state?.hydrate) {
      const previousDocId = state.lastLibraryDocId ?? null;
      const shouldResetChunkCount =
        Boolean(previousDocId) && previousDocId !== documentId && typeof chunkCount !== 'number';
      const patch: Record<string, unknown> = {
        lastLibraryDocId: documentId,
        activeDomain: 'LIBRARY'
      };
      if (documentName !== undefined) {
        patch.lastLibraryDocName = documentName;
      }
      if (typeof chunkCount === 'number') {
        patch.lastLibraryDocChunkCount = chunkCount;
      } else if (shouldResetChunkCount) {
        patch.lastLibraryDocChunkCount = null;
      }
      state.hydrate(patch);
    }
  } catch {
    // ignore state sync issues
  }
};

const shouldClearAnchorForError = (error: string) => {
  const message = String(error || '').toUpperCase();
  return (
    message.includes('NOT_FOUND') ||
    message.includes('NO_DOC') ||
    message.includes('NO_CHUNKS') ||
    message.includes('MISSING_DOC') ||
    message.includes('CHUNK_NOT_FOUND') ||
    message.includes('CHUNKS_MISSING')
  );
};

const clearWorldAnchorIfMatches = (path: string, error: string) => {
  if (!shouldClearAnchorForError(error)) return;
  try {
    const state = getCognitiveState();
    if (!state?.hydrate) return;
    const current = state.lastWorldPath ?? null;
    if (!current) return;
    if (normalizeFsPath(current) !== normalizeFsPath(path)) return;
    const patch: Record<string, unknown> = { lastWorldPath: null };
    if (state.activeDomain === 'WORLD') {
      patch.activeDomain = null;
    }
    state.hydrate(patch);
  } catch {
    // ignore state sync issues
  }
};

const clearLibraryAnchorIfMatches = (documentId: string, error: string) => {
  if (!shouldClearAnchorForError(error)) return;
  try {
    const state = getCognitiveState();
    if (!state?.hydrate) return;
    if (state.lastLibraryDocId !== documentId) return;
    const patch: Record<string, unknown> = {
      lastLibraryDocId: null,
      lastLibraryDocName: null,
      lastLibraryDocChunkCount: null
    };
    if (state.activeDomain === 'LIBRARY') {
      patch.activeDomain = null;
    }
    state.hydrate(patch);
  } catch {
    // ignore state sync issues
  }
};

const toWorldAnchorPath = (tool: string, path: string) =>
  tool === 'READ_FILE' ? dirname(path) : path;

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

type NormalizePathResult =
  | { ok: true; path: string }
  | { ok: false; error: string };

const normalizeWorldPath = (input: string): NormalizePathResult => {
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
  const hasPolish = /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/.test(trimmed);
  const tooShort = trimmed.length <= 2;

  if (hasSpaces || hasPolish || tooShort) {
    return { ok: false, error: `PATH_AMBIGUOUS: "${trimmed}"` };
  }

  return { ok: true, path: trimmed };
};
const resolveDirectoryHandle = async (
  root: FileSystemDirectoryHandle,
  segments: string[],
  create: boolean
): Promise<FileSystemDirectoryHandle | null> => {
  let current = root;
  for (const segment of segments) {
    if (!segment) continue;
    try {
      current = await current.getDirectoryHandle(segment, { create });
    } catch {
      return null;
    }
  }
  return current;
};

const readFileViaHandle = async (params: {
  dirHandle: FileSystemDirectoryHandle;
  fileName: string;
  resolvedPath: string;
  intentId: string;
  foundIn?: string;
}): Promise<WorldToolResult> => {
  const { dirHandle, fileName, resolvedPath, intentId, foundIn } = params;
  try {
    const fileHandle = await dirHandle.getFileHandle(fileName);
    const file = await fileHandle.getFile();
    const content = await file.text();
    const evidenceId = evidenceLedger.record('READ_FILE', resolvedPath);
    emitToolResult('READ_FILE', intentId, {
      path: resolvedPath,
      length: content.length,
      ...(foundIn ? { foundIn } : {})
    });
    updateWorldAnchor(toWorldAnchorPath('READ_FILE', resolvedPath));
    return { ok: true, path: resolvedPath, content, evidenceId };
  } catch {
    return { ok: false, path: resolvedPath, error: 'FILE_READ_ERROR' };
  }
};

const executeWorldToolWithFsAccess = async (params: {
  input: { tool: WorldToolName; path: string; content?: string };
  agentId: string;
}): Promise<WorldToolResult> => {
  const { input, agentId } = params;
  console.log(`[WORLD_TOOL] Entry: ${input.tool} path="${input.path}" via=fsAccess`);
  const selection = getWorldDirectorySelection(agentId);
  const normalizedPath = normalizeWorldPath(input.path);
  const rawInputPath = normalizedPath.ok ? normalizedPath.path : String(input.path || '').trim();
  let rawPath = normalizeFsPath(rawInputPath);
  if (selection) {
    const TOP_LEVEL_ALIASES = ['code', 'docs', 'notes', 'engineering', 'research', 'vision', 'todolist'];
    for (const alias of TOP_LEVEL_ALIASES) {
      const withSlash = `/${alias}`;
      if (rawPath === withSlash || rawPath.startsWith(`${withSlash}/`)) {
        rawPath = rawPath.slice(1);
        break;
      }
    }
  }
  if (!selection) {
    return { ok: false, path: rawPath || input.path, error: 'WORLD_ROOT_NOT_SELECTED' };
  }
  const agentName = getCurrentAgentName();
  const resolvedAgentFolder = selection.mode === 'agent'
    ? selection.name
    : getAgentFolderName(agentId, agentName);
  const handleAgentId = selection.mode === 'agent' ? agentId : resolvedAgentFolder;
  const basePath = joinPaths(WORLD_ROOT_PATH, resolvedAgentFolder);
  const resolved = isAbsolutePath(rawPath) ? rawPath : joinPaths(basePath, rawPath);
  const allowed = resolved.startsWith(basePath);
  if (!allowed) {
    return { ok: false, path: resolved, error: 'PATH_NOT_ALLOWED' };
  }
  const relative = resolved.slice(basePath.length).replace(/^\/+/, '');

  const intentId = emitToolIntent(input.tool, resolved, { path: resolved });

  const errorReturn = (tool: string, path: string, error: string): WorldToolResult => {
    emitToolError(tool, intentId, { path }, error);
    clearWorldAnchorIfMatches(path, error);
    return { ok: false, path, error };
  };

  const successReturn = (
    tool: string,
    path: string,
    result: Partial<WorldToolResult>,
    payloadExtra: Record<string, unknown> = {}
  ): WorldToolResult => {
    if (tool === 'LIST_DIR' || tool === 'READ_FILE') {
      updateWorldAnchor(toWorldAnchorPath(tool, path));
    }
    emitToolResult(tool, intentId, { path, ...payloadExtra });
    return { ok: true, path, ...result };
  };

  if (!normalizedPath.ok) {
    return errorReturn(input.tool, resolved, normalizedPath.error);
  }

  const writeOp = input.tool === 'WRITE_FILE' || input.tool === 'APPEND_FILE';
  const rootHandle = await getWorldDirectoryHandle({
    agentId: handleAgentId,
    agentFolderName: resolvedAgentFolder,
    create: writeOp,
    mode: writeOp ? 'readwrite' : 'read'
  });
  if (!rootHandle) {
    return errorReturn(input.tool, resolved, 'WORLD_ROOT_NOT_SELECTED');
  }

  try {
    if (input.tool === 'LIST_DIR') {
      const dirSegments = splitRelativePath(relative);
      const dirHandle = await resolveDirectoryHandle(rootHandle, dirSegments, false);
      if (!dirHandle) return errorReturn(input.tool, resolved, 'NOT_FOUND');
      const entries: string[] = [];
      for await (const [name, handle] of dirHandle.entries()) {
        entries.push(handle.kind === 'directory' ? `${name}/` : name);
      }
      evidenceLedger.record('LOG_EVENT', `LIST_DIR:${resolved}`);
      return successReturn(input.tool, resolved, { entries }, { count: entries.length });
    }

    if (input.tool === 'READ_FILE') {
      const segments = splitRelativePath(relative);
      const fileName = segments.pop();
      if (!fileName) return errorReturn(input.tool, resolved, 'PATH_IS_DIRECTORY');
      const dirHandle = await resolveDirectoryHandle(rootHandle, segments, false);
      if (dirHandle) {
        const primary = await readFileViaHandle({
          dirHandle,
          fileName,
          resolvedPath: resolved,
          intentId
        });
        if (primary.ok) return primary;
      }

      if (segments.length === 0) {
        const KNOWN_DIRS = ['code', 'docs', 'notes', 'engineering', 'research', 'vision', 'todolist'];
        for (const knownDir of KNOWN_DIRS) {
          try {
            const tryDir = await rootHandle.getDirectoryHandle(knownDir, { create: false });
            await tryDir.getFileHandle(fileName, { create: false });
            const newResolved = joinPaths(basePath, knownDir, fileName);
            const fallback = await readFileViaHandle({
              dirHandle: tryDir,
              fileName,
              resolvedPath: newResolved,
              intentId,
              foundIn: knownDir
            });
            if (fallback.ok) return fallback;
          } catch {
            continue;
          }
        }
      }

      return errorReturn(input.tool, resolved, 'NOT_FOUND');
    }

    if (input.tool === 'WRITE_FILE') {
      if (!isWriteAllowed(resolved, agentId)) {
        return errorReturn(input.tool, resolved, 'WRITE_NOT_ALLOWED');
      }
      const content = String(input.content ?? '');
      if (shouldValidateNote(resolved) && !validateNoteFormat(content)) {
        eventBus.publish({
          id: generateUUID(),
          timestamp: Date.now(),
          source: AgentType.CORTEX_FLOW,
          type: PacketType.NOTE_REJECTED,
          payload: { path: resolved, reason: 'INVALID_NOTE_FORMAT' },
          priority: 0.7
        });
        return errorReturn(input.tool, resolved, 'INVALID_NOTE_FORMAT');
      }
      const segments = splitRelativePath(relative);
      const fileName = segments.pop();
      if (!fileName) return errorReturn(input.tool, resolved, 'PATH_IS_DIRECTORY');
      const dirHandle = await resolveDirectoryHandle(rootHandle, segments, true);
      if (!dirHandle) return errorReturn(input.tool, resolved, 'NOT_FOUND');
      const fileHandle = await dirHandle.getFileHandle(fileName, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(content);
      await writable.close();
      return successReturn(input.tool, resolved, {});
    }

    if (input.tool === 'APPEND_FILE') {
      if (!isWriteAllowed(resolved, agentId)) {
        return errorReturn(input.tool, resolved, 'WRITE_NOT_ALLOWED');
      }
      const content = String(input.content ?? '');
      const segments = splitRelativePath(relative);
      const fileName = segments.pop();
      if (!fileName) return errorReturn(input.tool, resolved, 'PATH_IS_DIRECTORY');
      const dirHandle = await resolveDirectoryHandle(rootHandle, segments, true);
      if (!dirHandle) return errorReturn(input.tool, resolved, 'NOT_FOUND');
      const fileHandle = await dirHandle.getFileHandle(fileName, { create: true });
      const file = await fileHandle.getFile();
      const writable = await fileHandle.createWritable();
      await writable.seek(file.size);
      await writable.write(content);
      await writable.close();
      return successReturn(input.tool, resolved, {});
    }

    return errorReturn(input.tool, resolved, 'UNKNOWN_TOOL');
  } catch (error: any) {
    const message = error?.message || String(error);
    return errorReturn(input.tool, resolved, message);
  }
};

const resolveWorldPath = (rawPath: string, agentId: string): string => {
  const normalized = normalizePath(rawPath);
  if (!normalized) return normalized;
  if (isAbsolutePath(normalized)) return normalizeFsPath(normalized);
  const base = getAgentWorldRoot(agentId, getCurrentAgentName());
  return joinPaths(base, normalized);
};

const isWriteAllowed = (resolvedPath: string, agentId: string): boolean => {
  const norm = normalizePath(resolvedPath);
  return norm.startsWith(`${getAgentWorldRoot(agentId, getCurrentAgentName())}`);
};

const validateNoteFormat = (content: string): boolean => {
  const hasClaim = /^claim:/mi.test(content);
  const hasEvidence = /^evidence:/mi.test(content);
  const hasNext = /^next:/mi.test(content);
  return hasClaim && hasEvidence && hasNext;
};

const shouldValidateNote = (resolvedPath: string): boolean => {
  const norm = normalizePath(resolvedPath);
  return norm.includes('/notes/');
};

export async function executeWorldTool(input: {
  tool: WorldToolName;
  path: string;
  content?: string;
  agentId?: string | null;
}): Promise<WorldToolResult> {
  console.log(`[WORLD_TOOL] Wrapper called: ${input.tool} path="${input.path}"`);
  const agentId = input.agentId || getCurrentAgentId() || DEFAULT_AGENT_ID;
  const agentName = getCurrentAgentName();
  if (normalizePath(input.path).includes('..')) {
    return { ok: false, path: input.path, error: 'PATH_TRAVERSAL' };
  }
  const fs = await getFs();
  if (!fs) {
    return executeWorldToolWithFsAccess({ input, agentId });
  }

  const normalizedPath = normalizeWorldPath(input.path);
  const inputPath = normalizedPath.ok ? normalizedPath.path : String(input.path || '').trim();
  const resolved = resolveWorldPath(inputPath, agentId);

  const intentId = emitToolIntent(input.tool, resolved, { path: resolved });

  const errorReturn = (tool: string, path: string, error: string): WorldToolResult => {
    emitToolError(tool, intentId, { path }, error);
    clearWorldAnchorIfMatches(path, error);
    return { ok: false, path, error };
  };

  const successReturn = (
    tool: string,
    path: string,
    result: Partial<WorldToolResult>,
    payloadExtra: Record<string, unknown> = {}
  ): WorldToolResult => {
    if (tool === 'LIST_DIR' || tool === 'READ_FILE') {
      updateWorldAnchor(toWorldAnchorPath(tool, path));
    }
    emitToolResult(tool, intentId, { path, ...payloadExtra });
    return { ok: true, path, ...result };
  };

  if (!normalizedPath.ok) {
    return errorReturn(input.tool, resolved, normalizedPath.error);
  }

  if (!isPathAllowed(resolved, agentId, agentName)) {
    return errorReturn(input.tool, resolved, 'PATH_NOT_ALLOWED');
  }

  try {
    if (input.tool === 'LIST_DIR') {
      const entries = await fs.readdir(resolved, { withFileTypes: true });
      const names = entries.map((e) => (e.isDirectory() ? `${e.name}/` : e.name));
      evidenceLedger.record('LOG_EVENT', `LIST_DIR:${resolved}`);
      return successReturn(input.tool, resolved, { entries: names }, { count: names.length });
    }

    if (input.tool === 'READ_FILE') {
      const content = await fs.readFile(resolved, 'utf8');
      const evidenceId = evidenceLedger.record('READ_FILE', resolved);
      return successReturn(
        input.tool,
        resolved,
        { content, evidenceId },
        { length: content.length }
      );
    }

    if (input.tool === 'WRITE_FILE') {
      if (!isWriteAllowed(resolved, agentId)) {
        return errorReturn(input.tool, resolved, 'WRITE_NOT_ALLOWED');
      }
      const content = String(input.content ?? '');
      if (shouldValidateNote(resolved) && !validateNoteFormat(content)) {
        eventBus.publish({
          id: generateUUID(),
          timestamp: Date.now(),
          source: AgentType.CORTEX_FLOW,
          type: PacketType.NOTE_REJECTED,
          payload: { path: resolved, reason: 'INVALID_NOTE_FORMAT' },
          priority: 0.7
        });
        return errorReturn(input.tool, resolved, 'INVALID_NOTE_FORMAT');
      }
      await fs.mkdir(dirname(resolved), { recursive: true });
      await fs.writeFile(resolved, content);
      return successReturn(input.tool, resolved, {});
    }

    if (input.tool === 'APPEND_FILE') {
      if (!isWriteAllowed(resolved, agentId)) {
        return errorReturn(input.tool, resolved, 'WRITE_NOT_ALLOWED');
      }
      const content = String(input.content ?? '');
      await fs.mkdir(dirname(resolved), { recursive: true });
      await fs.appendFile(resolved, content);
      return successReturn(input.tool, resolved, {});
    }

    return errorReturn(input.tool, resolved, 'UNKNOWN_TOOL');
  } catch (error: any) {
    const message = error?.message || String(error);
    return errorReturn(input.tool, resolved, message);
  }
}

export const listDir = (path: string, agentId?: string | null) =>
  executeWorldTool({ tool: 'LIST_DIR', path, agentId });

export const readFile = (path: string, agentId?: string | null) =>
  executeWorldTool({ tool: 'READ_FILE', path, agentId });

export const writeFile = (path: string, content: string, agentId?: string | null) =>
  executeWorldTool({ tool: 'WRITE_FILE', path, content, agentId });

export const appendFile = (path: string, content: string, agentId?: string | null) =>
  executeWorldTool({ tool: 'APPEND_FILE', path, content, agentId });

export async function consumeWorkspaceTags(params: {
  cleanText: string;
  deps: Pick<ToolParserDeps, 'setCurrentThought' | 'addMessage'>;
  timeoutMs: number;
  makeId: () => string;
  publish: (packet: any) => void;
}): Promise<string> {
  const { deps, timeoutMs, makeId, publish } = params;
  let cleanText = params.cleanText;

  const normalizeArg = (raw: string) => {
    let s = String(raw || '').trim();
    if ((s.startsWith('<') && s.endsWith('>')) || (s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
      s = s.slice(1, -1).trim();
    }
    // common user typo: extra spaces in filename
    s = s.replace(/\s+/g, ' ');
    return s;
  };

  const isUuidLike = (s: string) => /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(s);

  const hashText = (s: string) => {
    // FNV-1a 32-bit (fast, stable, good enough for etag-ish hint)
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0).toString(16).padStart(8, '0');
  };

  const boostReadMemory = async (params: {
    tool: string;
    documentId: string;
    kind: 'WORKSPACE_DOC_SUMMARY' | 'WORKSPACE_CHUNK_SUMMARY';
    delta?: number;
    chunkIndex?: number;
  }) => {
    try {
      const delta = params.delta ?? 2;
      const memoryId = await MemoryService.findMemoryIdByDocumentId(params.documentId, params.kind);
      if (memoryId) {
        void MemoryService.boostMemoryStrength(memoryId, delta);
      }
      const docMemoryId = await MemoryService.findMemoryIdByDocumentId(params.documentId, 'DOCUMENT_INGESTED');
      if (docMemoryId) {
        void MemoryService.boostMemoryStrength(docMemoryId, delta);
      }
      console.log('[MEMORY_READ_BOOST]', {
        tool: params.tool,
        documentId: params.documentId,
        chunkIndex: params.chunkIndex,
        kind: params.kind,
        delta,
        memoryId,
        docMemoryId
      });
    } catch {
      // ignore boost errors
    }
  };

  const emitLibraryIngestMissing = (params: { documentId: string; name?: string; reason: string }) => {
    publish({
      id: makeId(),
      timestamp: Date.now(),
      source: AgentType.CORTEX_FLOW,
      type: PacketType.SYSTEM_ALERT,
      payload: {
        event: 'LIBRARY_INGEST_MISSING',
        docId: params.documentId,
        name: params.name ?? null,
        reason: params.reason
      },
      priority: 0.7
    });
    deps.addMessage('assistant', 'Ten dokument nie jest jeszcze zindeksowany (brak chunkow).', 'speech');
  };

  const executeWorkspaceTool = async (toolRaw: string, argRaw: string) => {
    const tool0 = String(toolRaw || '').toUpperCase();
    const worldTool =
      tool0 === 'LIST_DIR' || tool0 === 'LIST_FILES'
        ? 'LIST_DIR'
        : tool0 === 'READ_WORLD_FILE' || tool0 === 'READ_WORLD'
          ? 'READ_FILE'
          : tool0 === 'WRITE_WORLD_FILE'
            ? 'WRITE_FILE'
            : tool0 === 'APPEND_WORLD_FILE'
              ? 'APPEND_FILE'
              : null;

    if (worldTool) {
      const raw = String(argRaw || '').trim();
      const arg = normalizeArg(raw);
      let path = arg;
      let content = '';
      if (worldTool === 'WRITE_FILE' || worldTool === 'APPEND_FILE') {
        const splitAt = raw.indexOf(',');
        if (splitAt >= 0) {
          path = normalizeArg(raw.slice(0, splitAt));
          content = String(raw.slice(splitAt + 1)).trim();
        } else {
          deps.addMessage(
            'assistant',
            `WORLD_TOOL_ERROR: ${worldTool} :: missing content (use "[WRITE_WORLD_FILE: path, content]")`,
            'thought'
          );
          return;
        }
      }

      deps.addMessage('assistant', `Invoking ${worldTool} for: "${path}"`, 'action');
      deps.setCurrentThought(`World ${worldTool.toLowerCase()}...`);

      const res = await executeWorldTool({ tool: worldTool as WorldToolName, path, content });
      if (!res.ok) {
        deps.addMessage(
          'assistant',
          `WORLD_TOOL_ERROR: ${worldTool} :: ${path} :: ${res.error || 'unknown'}`,
          'thought'
        );
        return;
      }

      if (worldTool === 'LIST_DIR') {
        const entries = res.entries || [];
        const text = `LIST_DIR ${res.path}\n${entries.join('\n')}`;
        deps.addMessage('assistant', text, 'tool_result');
        return;
      }

      if (worldTool === 'READ_FILE') {
        const excerpt = String(res.content || '').slice(0, 8000);
        const text = `READ_FILE ${res.path}\n${excerpt}`;
        deps.addMessage('assistant', text, 'tool_result');
        return;
      }

      deps.addMessage('assistant', `${worldTool} OK: ${res.path}`, 'tool_result');
      return;
    }

    const tool = tool0 === 'SEARCH_IN_REPO'
      ? 'SEARCH_LIBRARY'
      : tool0 === 'READ_FILE'
        ? 'READ_LIBRARY_DOC'
        : tool0 === 'READ_FILE_CHUNK'
          ? 'READ_LIBRARY_CHUNK'
          : tool0 === 'READ_FILE_RANGE'
            ? 'READ_LIBRARY_RANGE'
          : tool0;

    const arg = normalizeArg(argRaw);
    let docIdForError: string | null = null;

    const intentId = emitToolIntent(tool, arg, undefined, { publish, makeId });

    try {
      if (tool === 'SEARCH_LIBRARY') {
        deps.addMessage('assistant', `Invoking SEARCH_LIBRARY for: "${arg}"`, 'action');
        deps.setCurrentThought(`Workspace search: ${arg}...`);

        const res: any = await withTimeout<any>(searchLibraryChunks({ query: arg, limit: 8 }) as any, timeoutMs, tool);
        if (res.ok === false) throw new Error(res.error);

        const text = res.hits.length === 0
          ? `SEARCH_LIBRARY: no hits for "${arg}".`
          : [
              `SEARCH_LIBRARY hits for "${arg}":`,
              ...res.hits.slice(0, 8).map((h: any, i: number) =>
                `#${i + 1} doc=${h.document_id} chunk=${h.chunk_index} :: ${String(h.snippet || '').replace(/\s+/g, ' ').slice(0, 280)}`
              )
            ].join('\n');

        if (res.hits.length > 0) {
          evidenceLedger.record('SEARCH_HIT', arg);
        }

        emitToolResult(tool, intentId, { arg, hitsCount: res.hits.length }, { publish, makeId });

        deps.addMessage('assistant', text, 'tool_result');
        return;
      }

      if (tool === 'LIST_LIBRARY_CHUNKS') {
        const match = arg.match(/^(.+?)(?:#(\d+))?$/);
        const docRef = String(match?.[1] || arg).trim();
        const limit = Number(match?.[2] || 20);
        if (!docRef) throw new Error('LIST_LIBRARY_CHUNKS arg must be <docIdOrName>#<limit?>');

        let documentId = docRef;
        let documentName: string | null = null;
        if (!isUuidLike(documentId)) {
          const found: any = await withTimeout<any>(
            findLibraryDocumentByName({ name: documentId }) as any,
            timeoutMs,
            'FIND_LIBRARY_DOC'
          );
          if (found.ok === false) throw new Error(found.error);
          if (!found.document) throw new Error(`DOC_NOT_FOUND_BY_NAME: ${documentId}`);
          documentId = String(found.document.id);
          const nameCandidate = String(found.document.original_name || '').trim();
          documentName = nameCandidate || null;
        }
        docIdForError = documentId;

        deps.addMessage('assistant', `Invoking LIST_LIBRARY_CHUNKS for: ${documentId}`, 'action');
        deps.setCurrentThought('Workspace list chunks...');

        const res: any = await withTimeout<any>(
          listLibraryChunks({ documentId, limit: limit + 1 }) as any,
          timeoutMs,
          tool
        );
        if (res.ok === false) throw new Error(res.error);

        const chunks = Array.isArray(res.chunks) ? res.chunks : [];
        const hasMore = chunks.length > limit;
        const visible = chunks.slice(0, limit);
        const chunkCount = typeof res.chunkCount === 'number' ? res.chunkCount : chunks.length;

        emitToolResult(tool, intentId, {
          arg,
          docId: documentId,
          chunkCount,
          shown: visible.length,
          hasMore
        }, { publish, makeId });

        if (visible.length === 0) {
          emitLibraryIngestMissing({ documentId, reason: 'chunks_missing' });
          deps.addMessage('assistant', 'Brak chunkow dla tego dokumentu.', 'tool_result');
          updateLibraryAnchor(documentId, documentName ?? undefined, chunkCount);
          return;
        }

        const summaries = visible.map((chunk: any) => {
          const preview = String(chunk.content || '').replace(/\s+/g, ' ').slice(0, 100);
          return `#${chunk.chunk_index}: ${preview}...`;
        });

        const countInfo = hasMore
          ? `Pokazuje pierwsze ${limit} chunkow (jest wiecej):`
          : `Dokument ma ${visible.length} chunkow:`;

        const text = `${countInfo}\n${summaries.join('\n')}\n\nKtory chunk? [READ_LIBRARY_CHUNK: ${documentId}#N]`;
        deps.addMessage('assistant', text, 'tool_result');
        updateLibraryAnchor(documentId, documentName ?? undefined, chunkCount);
        return;
      }

      if (tool === 'READ_LIBRARY_RANGE') {
        const MAX_RANGE_CHARS = 20000;
        const m = arg.match(/^(.+?)\s*#\s*(\d+)\s*:\s*(\d+)$/);
        if (!m) throw new Error('READ_LIBRARY_RANGE arg must be <docIdOrName>#<start>:<end>');

        const docRef = String(m[1] || '').trim();
        const start = Number(m[2]);
        const endRequested = Number(m[3]);
        if (!Number.isFinite(start) || !Number.isFinite(endRequested)) throw new Error('RANGE_INVALID');
        if (start < 0) throw new Error('RANGE_START_NEGATIVE');
        if (endRequested <= start) throw new Error('RANGE_END_LEQ_START');
        if (endRequested - start > MAX_RANGE_CHARS) throw new Error(`RANGE_TOO_LARGE: max=${MAX_RANGE_CHARS}`);

        let documentId = docRef;
        if (!isUuidLike(documentId)) {
          const found: any = await withTimeout<any>(
            findLibraryDocumentByName({ name: documentId }) as any,
            timeoutMs,
            'FIND_LIBRARY_DOC'
          );
          if (found.ok === false) throw new Error(found.error);
          if (!found.document) throw new Error(`DOC_NOT_FOUND_BY_NAME: ${documentId}`);
          documentId = String(found.document.id);
        }
        docIdForError = documentId;

        deps.addMessage(
          'assistant',
          `Invoking READ_LIBRARY_RANGE for: ${documentId}#${start}:${endRequested}`,
          'action'
        );
        deps.setCurrentThought('Workspace read range...');

        const res: any = await withTimeout<any>(downloadLibraryDocumentText({ documentId }) as any, timeoutMs, tool);
        if (res.ok === false) throw new Error(res.error);

        const raw = String(res.text || '');
        const originalName = String(res.doc?.original_name || '').trim();
        if (!res.doc?.ingested_at) {
          emitLibraryIngestMissing({
            documentId,
            name: originalName,
            reason: 'ingested_at_missing'
          });
        }
        const totalLength = raw.length;
        const end = Math.min(endRequested, totalLength);
        if (end <= start) throw new Error('RANGE_OUT_OF_BOUNDS');

        const textChunk = raw.slice(start, end);
        const hash = hashText(textChunk);
        evidenceLedger.record('READ_FILE', `${documentId}#${start}:${end}`);

        try {
          useArtifactStore.getState().addEvidence({
            kind: 'library_range',
            ts: Date.now(),
            docId: documentId,
            name: originalName || 'unknown',
            start,
            end,
            hash
          });
        } catch {
          // ignore
        }

        const nextStart = end;
        const nextEnd = Math.min(nextStart + MAX_RANGE_CHARS, totalLength);
        const nextRangeHint = end < totalLength ? { start: nextStart, end: nextEnd } : null;

        const text = [
          `READ_LIBRARY_RANGE ${documentId} (${originalName || 'unknown'}):`,
          `docId=${documentId}`,
          `name=${originalName || 'unknown'}`,
          `range.start=${start}`,
          `range.end=${end}`,
          `totalLength=${totalLength}`,
          `hash=${hash}`,
          `nextRangeHint=${nextRangeHint ? `${nextRangeHint.start}:${nextRangeHint.end}` : 'null'}`,
          'TEXT:',
          textChunk
        ].join('\n');

        emitToolResult(tool, intentId, {
          arg,
          docId: documentId,
          name: originalName,
          range: { start, end },
          totalLength,
          hash,
          nextRangeHint
        }, { publish, makeId });

        deps.addMessage('assistant', text, 'tool_result');
        updateLibraryAnchor(documentId);
        await boostReadMemory({
          tool,
          documentId,
          kind: 'WORKSPACE_DOC_SUMMARY',
          delta: 2
        });
        return;
      }

      if (tool === 'READ_LIBRARY_CHUNK') {
        const m = arg.match(/^([0-9a-fA-F-]{16,})\s*#\s*(\d+)$/);
        if (!m) throw new Error('READ_LIBRARY_CHUNK arg must be <docId>#<chunkIndex>');
        const documentId = m[1];
        const chunkIndex = Number(m[2]);
        docIdForError = documentId;
        deps.addMessage('assistant', `Invoking READ_LIBRARY_CHUNK for: ${documentId}#${chunkIndex}`, 'action');
        deps.setCurrentThought(`Workspace read chunk: ${chunkIndex}...`);

        const res: any = await withTimeout<any>(getLibraryChunkByIndex({ documentId, chunkIndex }) as any, timeoutMs, tool);
        if (res.ok === false) throw new Error(res.error);
        if (!res.chunk) {
          const listRes: any = await withTimeout<any>(listLibraryChunks({ documentId, limit: 1 }) as any, timeoutMs, 'LIST_LIBRARY_CHUNKS');
          if (listRes.ok && listRes.chunks.length === 0) {
            emitLibraryIngestMissing({ documentId, reason: 'chunks_missing' });
            throw new Error('CHUNKS_MISSING');
          }
          throw new Error('CHUNK_NOT_FOUND');
        }

        const chunkId = String(res.chunk?.id || '').trim();
        if (!chunkId) {
          throw new Error('CHUNK_ID_MISSING');
        }
        const chunkText = String(res.chunk.content || '').trim();
        evidenceLedger.record('READ_FILE', `${documentId}#${chunkIndex}`);
        const text = [
          `READ_LIBRARY_CHUNK ${documentId}#${chunkIndex}:`,
          chunkText.slice(0, 8000)
        ].join('\n');

        emitToolResult(tool, intentId, {
          arg,
          docId: documentId,
          chunkId,
          chunkIndex,
          length: chunkText.length
        }, { publish, makeId });

        deps.addMessage('assistant', text, 'tool_result');
        updateLibraryAnchor(documentId);
        await boostReadMemory({
          tool,
          documentId,
          kind: 'WORKSPACE_CHUNK_SUMMARY',
          delta: 2,
          chunkIndex
        });
        return;
      }

      if (tool === 'READ_LIBRARY_DOC') {
        let documentId = arg;
        if (!isUuidLike(documentId)) {
          const found: any = await withTimeout<any>(findLibraryDocumentByName({ name: documentId }) as any, timeoutMs, 'FIND_LIBRARY_DOC');
          if (found.ok === false) throw new Error(found.error);
          if (!found.document) throw new Error(`DOC_NOT_FOUND_BY_NAME: ${documentId}`);
          documentId = String(found.document.id);
        }
        docIdForError = documentId;

        deps.addMessage('assistant', `Invoking READ_LIBRARY_DOC for: ${documentId}`, 'action');
        deps.setCurrentThought('Workspace read document...');

        const res: any = await withTimeout<any>(downloadLibraryDocumentText({ documentId }) as any, timeoutMs, tool);
        if (res.ok === false) throw new Error(res.error);

        const raw = String(res.text || '');
        const originalName = String(res.doc?.original_name || '').trim();
        if (!res.doc?.ingested_at) {
          emitLibraryIngestMissing({
            documentId,
            name: originalName,
            reason: 'ingested_at_missing'
          });
        }

        const looksLikeJson = originalName.toLowerCase().endsWith('.json') || raw.trim().startsWith('{') || raw.trim().startsWith('[');
        let summaryBlock = '';
        if (looksLikeJson) {
          try {
            const parsed: any = JSON.parse(raw);
            if (parsed && typeof parsed === 'object') {
              const keys = Array.isArray(parsed) ? [] : Object.keys(parsed);
              const tasks = Array.isArray(parsed?.tasks) ? parsed.tasks : [];
              const countsByType: Record<string, number> = {};
              const countsByPriority: Record<string, number> = {};
              const openCritical: any[] = [];
              for (const t of tasks) {
                const type = String(t?.type ?? 'UNKNOWN');
                const prio = String(t?.priority ?? 'UNKNOWN');
                countsByType[type] = (countsByType[type] || 0) + 1;
                countsByPriority[prio] = (countsByPriority[prio] || 0) + 1;
                if (prio === 'CRITICAL' && t?.isCompleted === false) openCritical.push(t);
              }

              summaryBlock = [
                'JSON_SUMMARY:',
                `- keys: ${keys.slice(0, 40).join(', ')}${keys.length > 40 ? ' ...' : ''}`,
                `- version: ${String(parsed?.version ?? '')}`,
                `- project: ${String(parsed?.project ?? '')}`,
                `- dailyGoal: ${String(parsed?.dailyGoal ?? '')}`,
                `- tasks.total: ${tasks.length}`,
                `- tasks.byType: ${Object.entries(countsByType).map(([k, v]) => `${k}=${v}`).join(', ')}`,
                `- tasks.byPriority: ${Object.entries(countsByPriority).map(([k, v]) => `${k}=${v}`).join(', ')}`,
                `- openCritical: ${openCritical.slice(0, 5).map((t) => String(t?.id ?? t?.content ?? 'task')).join(', ')}${openCritical.length > 5 ? ' ...' : ''}`
              ].join('\n');
            }
          } catch {
            // fall back to raw excerpt
          }
        }

        const excerptLimit = looksLikeJson ? 2500 : 8000;
        const excerpt = raw.slice(0, excerptLimit);
        const text = [
          `READ_LIBRARY_DOC ${documentId} (${originalName || 'unknown'}):`,
          summaryBlock ? summaryBlock : '',
          'EXCERPT:',
          excerpt
        ]
          .filter(Boolean)
          .join('\n');

        evidenceLedger.record('READ_FILE', originalName || documentId);

        emitToolResult(tool, intentId, {
          arg,
          docId: documentId,
          name: originalName,
          length: raw.length,
          summarized: !!summaryBlock
        }, { publish, makeId });

        deps.addMessage('assistant', text, 'tool_result');
        updateLibraryAnchor(documentId, originalName || undefined);
        await boostReadMemory({
          tool,
          documentId,
          kind: 'WORKSPACE_DOC_SUMMARY',
          delta: 2
        });
        return;
      }

      throw new Error(`Unsupported workspace tool: ${tool}`);
    } catch (error: any) {
      const msg = error?.message || String(error);
      const isTimeout = typeof msg === 'string' && msg.startsWith('TOOL_TIMEOUT:');

      if (isTimeout) {
        publish({
          id: makeId(),
          timestamp: Date.now(),
          source: AgentType.CORTEX_FLOW,
          type: PacketType.TOOL_TIMEOUT,
          payload: { tool, arg, intentId, error: msg },
          priority: 0.9
        });
      }
      emitToolError(tool, intentId, { arg }, msg, { publish, makeId });
      if (docIdForError) {
        clearLibraryAnchorIfMatches(docIdForError, msg);
      }

      deps.addMessage(
        'assistant',
        `WORKSPACE_${isTimeout ? 'TIMEOUT' : 'ERROR'}: ${tool} :: ${arg} :: ${msg}`,
        'thought'
      );
    }
  };

  while (true) {
    const match = cleanText.match(WORKSPACE_TAG_REGEX);
    if (!match) break;
    const toolRaw = match[1];
    const argRaw = match[2];
    cleanText = cleanText.replace(match[0], '').trim();
    await executeWorkspaceTool(toolRaw, argRaw);
  }

  return cleanText;
}
