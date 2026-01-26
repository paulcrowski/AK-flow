export function normalizeToolName(tool: string): string {
  const name = String(tool || '');
  if (name.startsWith('READ_FILE')) return 'READ_FILE';
  if (name.startsWith('LIST_')) return 'LIST_DIR';
  if (name.startsWith('SEARCH')) return 'SEARCH';
  if (name.startsWith('WRITE') || name.startsWith('APPEND')) return 'WRITE_FILE';
  if (name.startsWith('READ_ARTIFACT')) return 'READ_ARTIFACT';
  return 'OTHER';
}

export const TOOL_COST: Record<string, number> = {
  LIST_DIR: 2,
  READ_FILE: 3,
  READ_ARTIFACT: 2,
  SEARCH: 5,
  WRITE_FILE: 4,
  OTHER: 2
};
