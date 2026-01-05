import { eventBus } from '../EventBus';
import { AgentType, PacketType } from '../../types';

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

const normalizePath = (input: string): string => String(input || '').replace(/\\/g, '/');
const joinPaths = (...parts: string[]): string =>
  normalizePath(parts.filter(Boolean).join('/')).replace(/\/+/g, '/');

export interface Schema {
  id: string;
  concept: string;
  attributes: string[];
  relations: { type: string; targetId: string; weight: number }[];
  confidence: number;
  usageCount: number;
  revision: number;
  evidenceRefs: string[];
  createdAt: number;
  updatedAt: number;
}

export class SchemaStore {
  constructor(private worldRoot: string) {}

  getWorldRoot(): string {
    return this.worldRoot;
  }

  private schemasPath(): string {
    return joinPaths(this.worldRoot, 'knowledge', 'schemas');
  }

  private historyPath(id: string): string {
    return joinPaths(this.schemasPath(), '_history', id);
  }

  private schemaFile(id: string): string {
    return joinPaths(this.schemasPath(), `${id}.json`);
  }

  async list(): Promise<string[]> {
    try {
      const fs = await getFs();
      if (!fs) return [];
      const entries = await fs.readdir(this.schemasPath(), { withFileTypes: true });
      return entries
        .filter((e) => e.isFile() && e.name.endsWith('.json'))
        .map((e) => e.name.replace(/\.json$/, ''));
    } catch {
      return [];
    }
  }

  async load(id: string): Promise<Schema | null> {
    try {
      const fs = await getFs();
      if (!fs) return null;
      const raw = await fs.readFile(this.schemaFile(id), 'utf8');
      return JSON.parse(raw) as Schema;
    } catch {
      return null;
    }
  }

  async save(schema: Schema): Promise<void> {
    const fs = await getFs();
    if (!fs) return;
    await fs.mkdir(this.schemasPath(), { recursive: true });

    const existing = await this.load(schema.id);
    const now = Date.now();

    if (existing) {
      await this.saveHistory(existing);
      schema.revision = existing.revision + 1;
      schema.createdAt = existing.createdAt;
    } else if (!schema.revision) {
      schema.revision = 1;
      schema.createdAt = now;
    }

    schema.updatedAt = now;

    await fs.writeFile(this.schemaFile(schema.id), JSON.stringify(schema, null, 2));

    eventBus.publish({
      id: `schema_${existing ? 'modified' : 'created'}_${schema.id}_${now}`,
      timestamp: now,
      source: AgentType.MEMORY_EPISODIC,
      type: existing ? PacketType.SCHEMA_MODIFIED : PacketType.SCHEMA_CREATED,
      payload: schema,
      priority: 0.6
    });
  }

  private async saveHistory(schema: Schema): Promise<void> {
    const fs = await getFs();
    if (!fs) return;
    const dir = this.historyPath(schema.id);
    await fs.mkdir(dir, { recursive: true });
    const filename = `${schema.revision}_${Date.now()}.json`;
    await fs.writeFile(joinPaths(dir, filename), JSON.stringify(schema, null, 2));
  }

  async incrementUsage(
    id: string,
    evidenceRef?: string,
    mutate?: (schema: Schema) => void
  ): Promise<Schema | null> {
    const schema = await this.load(id);
    if (!schema) return null;
    schema.usageCount += 1;
    if (evidenceRef) schema.evidenceRefs.push(evidenceRef);
    if (mutate) mutate(schema);
    await this.save(schema);
    return schema;
  }
}
