import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import { PacketType } from '@/types';

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

describe('workspaceTools FS access', () => {
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
    const codeDir = new FakeDirHandle();
    codeDir.addFile('README.md', 'hello from code');
    rootHandle.addDir('code', codeDir);
  });

  it('aliases /code paths for fs access', async () => {
    vi.resetModules();
    const [{ executeWorldTool }, { eventBus }] = await Promise.all([
      import('@tools/workspaceTools'),
      import('@core/EventBus')
    ]);
    eventBus.clear();

    const result = await executeWorldTool({
      tool: 'READ_FILE',
      path: '/code/README.md',
      agentId: 'agent-1'
    });

    expect(result.ok).toBe(true);
    expect(result.path).toBe('/_world/Alpha/code/README.md');

    const toolResults = eventBus.getHistory().filter((p) => p.type === PacketType.TOOL_RESULT);
    expect(toolResults.length).toBe(1);
  });

  it('falls back to known dirs when file is requested from root', async () => {
    vi.resetModules();
    const [{ executeWorldTool }, { eventBus }] = await Promise.all([
      import('@tools/workspaceTools'),
      import('@core/EventBus')
    ]);
    eventBus.clear();

    const result = await executeWorldTool({
      tool: 'READ_FILE',
      path: 'README.md',
      agentId: 'agent-1'
    });

    expect(result.ok).toBe(true);
    expect(result.path).toBe('/_world/Alpha/code/README.md');

    const toolResults = eventBus.getHistory().filter((p) => p.type === PacketType.TOOL_RESULT);
    const payload = toolResults[0]?.payload as { foundIn?: string };
    expect(payload?.foundIn).toBe('code');
  });
});
