import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';

const originalVersions = process.versions;

class FakeFile {
  private content: string;
  constructor(content: string) {
    this.content = content;
  }
  async text() {
    return this.content;
  }
}

class FakeFileHandle {
  private content: string;
  constructor(content: string) {
    this.content = content;
  }
  async getFile() {
    return new FakeFile(this.content);
  }
  async createWritable() {
    return {
      write: async () => {},
      close: async () => {},
      seek: async () => {}
    };
  }
}

class FakeDirHandle {
  private dirs = new Map<string, FakeDirHandle>();
  private files = new Map<string, string>();

  addDir(name: string, dir: FakeDirHandle) {
    this.dirs.set(name, dir);
  }

  addFile(name: string, content: string) {
    this.files.set(name, content);
  }

  async getDirectoryHandle(name: string) {
    const dir = this.dirs.get(name);
    if (!dir) throw new Error('NotFoundError');
    return dir;
  }

  async getFileHandle(name: string) {
    const content = this.files.get(name);
    if (content === undefined) throw new Error('NotFoundError');
    return new FakeFileHandle(content);
  }

  async *entries() {
    for (const [name, handle] of this.dirs) {
      yield [name, { kind: 'directory', ...handle }] as const;
    }
    for (const [name] of this.files) {
      yield [name, { kind: 'file' }] as const;
    }
  }
}

let rootHandle: FakeDirHandle | null = null;

vi.mock('@services/supabase', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@services/supabase')>();
  return {
    ...actual,
    getCurrentAgentId: () => 'agent-1',
    getCurrentAgentName: () => 'Alpha'
  };
});

vi.mock('@tools/worldDirectoryAccess', () => ({
  getWorldDirectorySelection: () => ({ mode: 'world', name: '_world' }),
  getWorldDirectoryHandle: async () => rootHandle
}));

describe('World path traversal guard', () => {
  beforeAll(() => {
    Object.defineProperty(process, 'versions', {
      value: { ...originalVersions, node: undefined },
      configurable: true
    });
  });

  afterAll(() => {
    Object.defineProperty(process, 'versions', {
      value: originalVersions,
      configurable: true
    });
  });

  beforeEach(() => {
    rootHandle = new FakeDirHandle();
    const notesDir = new FakeDirHandle();
    notesDir.addFile('a.txt', 'ok');
    rootHandle.addDir('notes', notesDir);
  });

  const runTool = async (tool: 'READ_FILE' | 'WRITE_FILE' | 'LIST_DIR', path: string) => {
    vi.resetModules();
    const { executeWorldTool } = await import('@tools/workspaceTools');
    return executeWorldTool({
      tool,
      path,
      content: 'claim: x\nevidence: y\nnext: z',
      agentId: 'agent-1'
    });
  };

  const traversalPaths = ['../secrets.env', '..\\secrets.env', '%2e%2e/secret', 'a/../../b'];

  it.each(traversalPaths)('blocks READ_FILE traversal: %s', async (path) => {
    const result = await runTool('READ_FILE', path);
    expect(result.ok).toBe(false);
    expect(result.error).toBe('PATH_NOT_ALLOWED');
  });

  it.each(traversalPaths)('blocks WRITE_FILE traversal: %s', async (path) => {
    const result = await runTool('WRITE_FILE', path);
    expect(result.ok).toBe(false);
    expect(result.error).toBe('PATH_NOT_ALLOWED');
  });

  it.each(traversalPaths)('blocks LIST_DIR traversal: %s', async (path) => {
    const result = await runTool('LIST_DIR', path);
    expect(result.ok).toBe(false);
    expect(result.error).toBe('PATH_NOT_ALLOWED');
  });

  it('allows safe relative paths', async () => {
    const result = await runTool('READ_FILE', 'notes/a.txt');
    expect(result.ok).toBe(true);
    expect(result.path).toBe('/_world/Alpha/notes/a.txt');
  });
});
