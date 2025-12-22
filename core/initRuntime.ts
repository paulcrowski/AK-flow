import { eventBus } from './EventBus';
import * as ConfessionModule from '../services/ConfessionService';

export interface RuntimeHandle {
  dispose(): void;
}

type RuntimeState = {
  handle: RuntimeHandle | null;
};

function getRuntimeState(): RuntimeState {
  const g = globalThis as any;
  if (!g.__AKFLOW_RUNTIME__) {
    g.__AKFLOW_RUNTIME__ = { handle: null } satisfies RuntimeState;
  }
  return g.__AKFLOW_RUNTIME__ as RuntimeState;
}

export function initRuntime(): RuntimeHandle {
  const state = getRuntimeState();
  if (state.handle) return state.handle;

  const confession: any = (ConfessionModule as any).initConfessionService
    ? (ConfessionModule as any).initConfessionService(eventBus)
    : (ConfessionModule as any).confessionService;

  console.log('[Runtime] initialized');

  const handle: RuntimeHandle = {
    dispose() {
      try {
        confession?.dispose?.();
      } finally {
        state.handle = null;
      }
    }
  };

  state.handle = handle;
  return handle;
}
