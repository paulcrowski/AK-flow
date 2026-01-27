import { eventBus } from '../../../EventBus';
import { AgentType, PacketType } from '../../../../types';
import { generateUUID } from '../../../../utils/uuid';
import { buildToolCommitDetails, formatToolCommitMessage } from '../../../utils/toolCommit';
import { emitToolResult as emitToolResultContract } from '../../../telemetry/toolContract';
import { validateToolResult } from '../../../tools/validateToolResult';

export type ToolCommitParams = {
  action: 'CREATE' | 'APPEND' | 'REPLACE';
  artifactId: string;
  artifactName: string;
  beforeContent?: string;
  afterContent?: string;
  deltaText?: string;
};

export const emitToolCommit = (params: ToolCommitParams): void => {
  const details = buildToolCommitDetails(params);
  if (!details) return;
  const message = formatToolCommitMessage(details);
  eventBus.publish({
    id: generateUUID(),
    timestamp: Date.now(),
    source: AgentType.CORTEX_FLOW,
    type: PacketType.SYSTEM_ALERT,
    payload: {
      event: 'TOOL_COMMIT',
      message,
      ...details
    },
    priority: 0.7
  });
};

export const emitSystemAlert = (event: string, payload: Record<string, unknown>, priority = 0.6): void => {
  eventBus.publish({
    id: generateUUID(),
    timestamp: Date.now(),
    source: AgentType.CORTEX_FLOW,
    type: PacketType.SYSTEM_ALERT,
    payload: { event, ...payload },
    priority
  });
};

export const toolResultOptions = { priority: 0.8 };
export const toolErrorOptions = { priority: 0.9 };

export const emitToolResult = (
  tool: string,
  intentId: string,
  payload?: Record<string, unknown>,
  options: { priority: number } = toolResultOptions
): void => {
  const normalized: Record<string, unknown> = { ...(payload ?? {}) };
  if (typeof normalized.id === 'string' && typeof normalized.artifactId !== 'string') {
    if (tool === 'CREATE' || tool === 'APPEND' || tool === 'REPLACE' || tool === 'READ_ARTIFACT') {
      normalized.artifactId = normalized.id;
    }
  }
  if (typeof normalized.name === 'string' && typeof normalized.artifactName !== 'string') {
    normalized.artifactName = normalized.name;
  }
  validateToolResult(tool, normalized);
  emitToolResultContract(tool, intentId, normalized, options);
};
