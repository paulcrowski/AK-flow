import type { KernelEvent, KernelOutput, KernelReducerResult, KernelState, ToolResultPayload } from '../../types';
import { handleWorkingSetAdvance } from './workingSet';

function getToolDomain(tool: string): 'WORLD' | 'LIBRARY' | 'ARTIFACT' | null {
  const t = (tool || '').toUpperCase();
  if (t.startsWith('READ_FILE') || t.startsWith('WRITE_FILE') || t.startsWith('LIST_DIR')) return 'WORLD';
  if (t.startsWith('READ_LIBRARY') || t.startsWith('SEARCH')) return 'LIBRARY';
  if (t.startsWith('READ_ARTIFACT') || t.startsWith('WRITE_ARTIFACT') || t.startsWith('EDIT_ARTIFACT')) return 'ARTIFACT';
  return null;
}

export function handleToolResult(state: KernelState, event: KernelEvent, outputs: KernelOutput[]): KernelReducerResult {
  const payload = event.payload as ToolResultPayload | undefined;

  const toolName = payload?.tool || 'UNKNOWN';
  const ok = payload?.success ?? false;
  const domainActual = getToolDomain(toolName);
  const domainExpected = state.activeDomain;

  let nextState: KernelState = {
    ...state,
    ticksSinceLastReward: 0,
    lastTool: {
      tool: toolName,
      ok,
      at: event.timestamp,
      domainExpected,
      domainActual,
      domainMatch: Boolean(domainExpected && domainActual && domainExpected === domainActual)
    }
  };

  if (ok && nextState.workingSet) {
    const r = handleWorkingSetAdvance(
      nextState,
      { type: 'WORKING_SET_ADVANCE', timestamp: event.timestamp } as KernelEvent,
      []
    );
    // Ensure lastTool is preserved if handleWorkingSetAdvance doesn't carry it (it should as it spreads state)
    nextState = { ...r.nextState };
    outputs.push({ type: 'LOG', payload: { message: 'WORKING_SET_AUTO_ADVANCE' } });
  }

  outputs.push({
    type: 'LOG',
    payload: { message: 'TOOL_REWARD: Tool result received, resetting ticksSinceLastReward' }
  });

  return { nextState, outputs };
}
