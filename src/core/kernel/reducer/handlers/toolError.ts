import type { KernelEvent, KernelOutput, KernelReducerResult, KernelState, ToolErrorPayload } from '../../types';

const asString = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : undefined;

const getToolDomain = (tool: string): 'WORLD' | 'LIBRARY' | 'ARTIFACT' | null => {
  const t = (tool || '').toUpperCase();
  if (t.startsWith('READ_FILE') || t.startsWith('WRITE_FILE') || t.startsWith('LIST_DIR')) return 'WORLD';
  if (t.startsWith('READ_LIBRARY') || t.startsWith('SEARCH')) return 'LIBRARY';
  if (t.startsWith('READ_ARTIFACT') || t.startsWith('WRITE_ARTIFACT') || t.startsWith('EDIT_ARTIFACT')) return 'ARTIFACT';
  return null;
};

const parseDocIdFromArg = (arg?: string): string | undefined => {
  if (!arg) return undefined;
  const trimmed = arg.trim();
  if (!trimmed) return undefined;
  const hashIndex = trimmed.indexOf('#');
  return (hashIndex >= 0 ? trimmed.slice(0, hashIndex) : trimmed).trim() || undefined;
};

const parseArtifactIdFromArg = (arg?: string): string | undefined => {
  const trimmed = (arg || '').trim();
  return trimmed.startsWith('art-') ? trimmed : undefined;
};

const shouldClearAnchorForError = (error: string): boolean => {
  const message = error.toUpperCase();
  return message.includes('NOT_FOUND') || message.includes('ACCESS_DENIED');
};

export function handleToolError(
  state: KernelState,
  event: KernelEvent,
  outputs: KernelOutput[]
): KernelReducerResult {
  const payload = event.payload as ToolErrorPayload | undefined;
  const toolName = payload?.tool || 'UNKNOWN';
  const domainActual = payload?.domainActual ?? getToolDomain(toolName);
  const domainExpected = payload?.domainExpected ?? state.activeDomain;
  const rawPayload = (payload?.payload ?? {}) as Record<string, unknown>;
  const errorMessage =
    asString(payload?.error) ?? asString(rawPayload.error) ?? 'UNKNOWN_ERROR';

  let nextState: KernelState = {
    ...state,
    ticksSinceLastReward: 0,
    lastTool: {
      tool: toolName,
      ok: false,
      at: event.timestamp,
      domainExpected,
      domainActual,
      domainMatch: Boolean(domainExpected && domainActual && domainExpected === domainActual)
    }
  };

  if (shouldClearAnchorForError(errorMessage)) {
    const docId = asString(rawPayload.docId) ?? parseDocIdFromArg(asString(rawPayload.arg));
    const path = asString(rawPayload.path) ?? asString(rawPayload.arg);
    const artifactId = asString(rawPayload.artifactId) ?? parseArtifactIdFromArg(asString(rawPayload.arg));

    if (docId && nextState.focus.domain === 'LIBRARY' && nextState.focus.id === docId) {
      nextState = {
        ...nextState,
        focus: { domain: null, id: null, label: null },
        cursor: {},
        lastLibraryDocId: null,
        lastLibraryDocName: null,
        lastLibraryDocChunkCount: null,
        activeDomain: nextState.activeDomain === 'LIBRARY' ? null : nextState.activeDomain
      };
    }

    if (path && nextState.focus.domain === 'WORLD' && nextState.focus.id === path) {
      nextState = {
        ...nextState,
        focus: { domain: null, id: null, label: null },
        lastWorldPath: null,
        activeDomain: nextState.activeDomain === 'WORLD' ? null : nextState.activeDomain
      };
    }

    if (artifactId && nextState.focus.domain === 'ARTIFACT' && nextState.focus.id === artifactId) {
      nextState = {
        ...nextState,
        focus: { domain: null, id: null, label: null },
        lastArtifactId: null,
        lastArtifactName: null,
        activeDomain: nextState.activeDomain === 'ARTIFACT' ? null : nextState.activeDomain
      };
    }
  }

  outputs.push({
    type: 'LOG',
    payload: { message: `TOOL_ERROR: ${toolName} :: ${errorMessage}` }
  });

  return { nextState, outputs };
}
