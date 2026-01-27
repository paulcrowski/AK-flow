export class ToolContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ToolContractError';
  }
}

type Validator = (result: unknown) => void;

const asRecord = (result: unknown): Record<string, unknown> => {
  if (!result || typeof result !== 'object') {
    return {};
  }
  return result as Record<string, unknown>;
};

const requireString = (value: unknown, label: string) => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`requires ${label}`);
  }
};

const requireText = (value: unknown, label: string) => {
  if (typeof value !== 'string') {
    throw new Error(`requires ${label}`);
  }
};

const requireNumber = (value: unknown, label: string) => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    throw new Error(`requires ${label}`);
  }
};

const requireDocIdAndChunkCount: Validator = (result) => {
  const res = asRecord(result);
  requireString(res.docId, 'docId');
  requireNumber(res.chunkCount, 'chunkCount');
};

const requireDocId: Validator = (result) => {
  const res = asRecord(result);
  requireString(res.docId, 'docId');
};

const requireChunkId: Validator = (result) => {
  const res = asRecord(result);
  requireString(res.chunkId, 'chunkId');
};

const requirePath: Validator = (result) => {
  const res = asRecord(result);
  requireString(res.path, 'path');
};

const requireDirEntries: Validator = (result) => {
  const res = asRecord(result);
  requireString(res.path, 'path');
  requireNumber(res.count, 'count');
  if (!Array.isArray(res.entries)) {
    throw new Error('requires entries');
  }
  for (const entry of res.entries) {
    if (!entry || typeof entry !== 'object') {
      throw new Error('requires entries objects');
    }
    const record = entry as Record<string, unknown>;
    requireString(record.name, 'entries.name');
    const type = record.type;
    if (type !== 'file' && type !== 'dir') {
      throw new Error('requires entries.type');
    }
  }
};

const requireFileEvidence: Validator = (result) => {
  const res = asRecord(result);
  requireString(res.path, 'path');
  requireNumber(res.length, 'length');
  requireString(res.hash, 'hash');
  requireText(res.preview, 'preview');
};

const requireSearchLibraryHits: Validator = (result) => {
  const res = asRecord(result);
  requireString(res.arg, 'arg');
  requireNumber(res.hitsCount, 'hitsCount');
  if (!Array.isArray(res.matches)) {
    throw new Error('requires matches');
  }
  for (const entry of res.matches) {
    if (!entry || typeof entry !== 'object') {
      throw new Error('requires matches objects');
    }
    const record = entry as Record<string, unknown>;
    requireString(record.docId, 'matches.docId');
    requireNumber(record.chunkIndex, 'matches.chunkIndex');
    requireText(record.snippet, 'matches.snippet');
  }
};

const requireArtifactId: Validator = (result) => {
  const res = asRecord(result);
  requireString(res.artifactId, 'artifactId');
};

const noop: Validator = () => undefined;

const TOOL_CONTRACTS: Record<string, Validator> = {
  LIST_LIBRARY_CHUNKS: requireDocIdAndChunkCount,
  READ_LIBRARY_CHUNK: requireChunkId,
  READ_LIBRARY_DOC: requireDocId,
  LIST_DIR: requireDirEntries,
  READ_FILE: requireFileEvidence,
  WRITE_FILE: requireFileEvidence,
  APPEND_FILE: requireFileEvidence,
  READ_ARTIFACT: requireArtifactId,
  WRITE_ARTIFACT: requireArtifactId,
  CREATE: requireArtifactId,
  APPEND: requireArtifactId,
  REPLACE: requireArtifactId,
  SNAPSHOT: requireArtifactId,
  PUBLISH: requireArtifactId,
  SEARCH: noop,
  SEARCH_LIBRARY: requireSearchLibraryHits,
  SEARCH_IN_REPO: noop,
  READ_LIBRARY_RANGE: noop,
  READ_FILE_RANGE: noop,
  SPLIT_TODO3: noop,
  VISUALIZE: noop
};

export function validateToolResult(tool: string, result: unknown): void {
  const validator = TOOL_CONTRACTS[tool];
  if (!validator) {
    console.warn(`[CONTRACT] UNKNOWN_TOOL_CONTRACT: ${tool}`);
    return;
  }
  try {
    validator(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new ToolContractError(`${tool}: ${message}`);
  }
}
