export type WorldToolName = 'LIST_DIR' | 'READ_FILE' | 'WRITE_FILE' | 'APPEND_FILE';

export type WorldToolResult = {
  ok: boolean;
  path: string;
  content?: string;
  entries?: string[];
  preview?: string;
  hash?: string;
  length?: number;
  error?: string;
  evidenceId?: string;
};

export type WorldDirEntry = {
  name: string;
  type: 'file' | 'dir';
};
