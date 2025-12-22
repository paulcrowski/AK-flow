import type { LimbicState } from '../../types';

export async function storeSelfSummary(deps: {
  summary: string;
  limbic: LimbicState;
  memoryService: { storeMemory: (payload: any) => Promise<any> };
  generateUUID: () => string;
}): Promise<void> {
  const { summary, limbic, memoryService, generateUUID } = deps;

  try {
    await memoryService.storeMemory({
      id: generateUUID(),
      content: `[SELF-SUMMARY] ${summary}`,
      emotionalContext: limbic,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('[DreamConsolidation] Failed to store self-summary:', err);
  }
}
