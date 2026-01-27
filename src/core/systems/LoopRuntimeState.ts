import type { Schema } from '../memory/SchemaStore';
import type { DecisionGateRuntime } from './DecisionGate';
import type { MemorySpaceRuntime } from './MemorySpace';
import type { DeepResearchRuntime } from './cortex/deepResearch';
import { createDecisionGateRuntime } from './DecisionGate';
import { createMemorySpaceRuntime } from './MemorySpace';
import { createDeepResearchRuntime } from './cortex/deepResearch';

export type SchemaStoreLike = {
  load(id: string): Promise<Schema | null>;
  save(schema: Schema): Promise<void>;
  incrementUsage(
    id: string,
    evidenceRef?: string,
    mutate?: (schema: Schema) => void
  ): Promise<Schema | null>;
};

export type EventLoopRuntimeState = {
  schemaStores: Map<string, SchemaStoreLike>;
  pendingWakeObserve: { key: string | null };
  schemaStoreCtor: (new (worldRoot: string) => SchemaStoreLike) | null;
};

export type LoopRuntimeState = {
  decisionGate: DecisionGateRuntime;
  memorySpace: MemorySpaceRuntime;
  deepResearch: DeepResearchRuntime;
  eventLoop: EventLoopRuntimeState;
};

export const createEventLoopRuntimeState = (): EventLoopRuntimeState => ({
  schemaStores: new Map(),
  pendingWakeObserve: { key: null },
  schemaStoreCtor: null
});

export const createLoopRuntimeState = (): LoopRuntimeState => ({
  decisionGate: createDecisionGateRuntime(),
  memorySpace: createMemorySpaceRuntime(),
  deepResearch: createDeepResearchRuntime(),
  eventLoop: createEventLoopRuntimeState()
});
