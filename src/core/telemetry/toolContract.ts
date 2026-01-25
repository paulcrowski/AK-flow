import { eventBus } from '../EventBus';
import { AgentType, PacketType } from '../../types';
import { generateUUID } from '../../utils/uuid';

export type ToolPublishFn = (packet: any) => void;
export type ToolMakeIdFn = () => string;

export type ToolContractOptions = {
  publish?: ToolPublishFn;
  makeId?: ToolMakeIdFn;
  source?: AgentType;
  priority?: number;
};

export type ToolDomain = 'LIBRARY' | 'WORLD' | 'ARTIFACT';

export interface ToolResultNormalized {
  type: 'TOOL_RESULT';
  intentId: string;
  traceId?: string;
  tool: string;
  ok: true;
  domainActual: ToolDomain | 'UNKNOWN';
  domainExpected: ToolDomain | 'UNKNOWN';
  result: {
    docId?: string;
    docName?: string;
    chunkCount?: number;
    chunkId?: string;
    chunkIndex?: number;
    path?: string;
    artifactId?: string;
    artifactName?: string;
  };
}

export interface ToolErrorNormalized {
  type: 'TOOL_ERROR';
  intentId: string;
  traceId?: string;
  tool: string;
  ok: false;
  domainActual: ToolDomain | 'UNKNOWN';
  domainExpected: ToolDomain | 'UNKNOWN';
  error: {
    code: string;
    message?: string;
    docId?: string;
    path?: string;
    artifactId?: string;
  };
  echoArgs?: Record<string, unknown>;
}

const defaultPublish = (packet: any) => eventBus.publish(packet);
const defaultMakeId = () => generateUUID();

const resolvePublish = (opts?: ToolContractOptions) => opts?.publish ?? defaultPublish;
const resolveMakeId = (opts?: ToolContractOptions) => opts?.makeId ?? defaultMakeId;
const resolveSource = (opts?: ToolContractOptions) => opts?.source ?? AgentType.CORTEX_FLOW;

export const emitToolIntent = (
  tool: string,
  arg: string,
  payload?: Record<string, unknown>,
  options?: ToolContractOptions
): string => {
  const publish = resolvePublish(options);
  const makeId = resolveMakeId(options);
  const intentId = makeId();
  publish({
    id: intentId,
    timestamp: Date.now(),
    source: resolveSource(options),
    type: PacketType.TOOL_INTENT,
    payload: { tool, arg, intentId, ...(payload ?? {}) },
    priority: options?.priority ?? 0.8
  });
  return intentId;
};

export const emitToolResult = (
  tool: string,
  intentId: string,
  payload?: Record<string, unknown>,
  options?: ToolContractOptions
): void => {
  const publish = resolvePublish(options);
  const makeId = resolveMakeId(options);
  publish({
    id: makeId(),
    timestamp: Date.now(),
    source: resolveSource(options),
    type: PacketType.TOOL_RESULT,
    payload: { tool, intentId, ...(payload ?? {}) },
    priority: options?.priority ?? 0.7
  });
};

export const emitToolError = (
  tool: string,
  intentId: string,
  payload: Record<string, unknown> | undefined,
  error: string,
  options?: ToolContractOptions
): void => {
  const publish = resolvePublish(options);
  const makeId = resolveMakeId(options);
  publish({
    id: makeId(),
    timestamp: Date.now(),
    source: resolveSource(options),
    type: PacketType.TOOL_ERROR,
    payload: { tool, intentId, ...(payload ?? {}), error },
    priority: options?.priority ?? 0.8
  });
};

export async function withToolContract<T>(
  tool: string,
  arg: string,
  fn: () => Promise<T>,
  options?: ToolContractOptions
): Promise<{ ok: true; result: T; intentId: string } | { ok: false; error: string; intentId: string }> {
  const intentId = emitToolIntent(tool, arg, undefined, options);
  try {
    const result = await fn();
    emitToolResult(tool, intentId, { result }, options);
    return { ok: true, result, intentId };
  } catch (error: any) {
    const errorMsg = error?.message || 'UNKNOWN_ERROR';
    emitToolError(tool, intentId, { arg }, errorMsg, options);
    return { ok: false, error: errorMsg, intentId };
  }
}
