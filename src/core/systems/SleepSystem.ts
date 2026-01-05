import { eventBus } from '../EventBus';
import { AgentType, PacketType } from '../../types';
import type { SchemaStore } from '../memory/SchemaStore';
import type { TensionRegistry } from './TensionRegistry';

type FsModule = typeof import('fs/promises');
const IS_NODE =
  typeof process !== 'undefined' &&
  Boolean((process as { versions?: { node?: string } }).versions?.node);

const getFs = async (): Promise<FsModule | null> => {
  if (!IS_NODE) return null;
  return import('fs/promises');
};

const normalizePath = (input: string): string => String(input || '').replace(/\\/g, '/');
const joinPaths = (...parts: string[]): string =>
  normalizePath(parts.filter(Boolean).join('/')).replace(/\/+/g, '/');

export interface SleepUpdate {
  timestamp: number;
  reinforced: string[];
  decayed: string[];
  modified: { id: string; reason: string }[];
  deprecated: string[];
  selectedTensionForTomorrow: string | null;
}

export async function performSleepCycle(input: {
  store: SchemaStore;
  usedSchemaIds: string[];
  tensionRegistry: TensionRegistry;
  errors: string[];
}): Promise<SleepUpdate> {
  const result: SleepUpdate = {
    timestamp: Date.now(),
    reinforced: [],
    decayed: [],
    modified: [],
    deprecated: [],
    selectedTensionForTomorrow: null
  };

  const allIds = await input.store.list();

  for (const id of allIds) {
    const schema = await input.store.load(id);
    if (!schema) continue;

    if (input.usedSchemaIds.includes(id)) {
      schema.confidence = Math.min(1, schema.confidence + 0.1);
      await input.store.save(schema);
      result.reinforced.push(id);
    } else if (schema.confidence < 0.4 && schema.usageCount < 3) {
      schema.confidence = Math.max(0, schema.confidence - 0.05);
      await input.store.save(schema);
      result.decayed.push(id);

      if (schema.confidence <= 0) {
        result.deprecated.push(id);
      }
    }
  }

  for (const error of input.errors) {
    const match = String(error).match(/schema:([a-z0-9_-]+)/i);
    if (match?.[1]) {
      result.modified.push({ id: match[1], reason: String(error).slice(0, 120) });
    }
  }

  const topTension = input.tensionRegistry.top(1)[0];
  result.selectedTensionForTomorrow = topTension?.key || null;
  input.tensionRegistry.setSelectedForTomorrow(result.selectedTensionForTomorrow);

  const fs = await getFs();
  if (fs) {
    const logDir = joinPaths(input.store.getWorldRoot(), 'experiments', 'sleep_logs');
    await fs.mkdir(logDir, { recursive: true });
    const logPath = joinPaths(
      logDir,
      `${new Date().toISOString().replace(/:/g, '-')}.json`
    );
    await fs.writeFile(logPath, JSON.stringify(result, null, 2));
  } else {
    console.warn('[SleepSystem] FS unavailable, skipping sleep log write.');
  }

  eventBus.publish({
    id: `sleep_cycle_${Date.now()}`,
    timestamp: Date.now(),
    source: AgentType.MEMORY_EPISODIC,
    type: PacketType.SLEEP_CYCLE_COMPLETE,
    payload: result,
    priority: 0.6
  });

  return result;
}
