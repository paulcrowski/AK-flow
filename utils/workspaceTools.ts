import type { ToolParserDeps } from './toolParser';
import {
  downloadLibraryDocumentText,
  findLibraryDocumentByName,
  getLibraryChunkByIndex,
  searchLibraryChunks
} from '../services/LibraryService';
import { AgentType, PacketType } from '../types';
import { withTimeout } from './toolRuntime';

export const WORKSPACE_TAG_REGEX = /\[(SEARCH_LIBRARY|READ_LIBRARY_CHUNK|READ_LIBRARY_DOC|SEARCH_IN_REPO|READ_FILE|READ_FILE_CHUNK):\s*([^\]]+?)\]/i;

export async function consumeWorkspaceTags(params: {
  cleanText: string;
  deps: Pick<ToolParserDeps, 'setCurrentThought' | 'addMessage'>;
  timeoutMs: number;
  makeId: () => string;
  publish: (packet: any) => void;
}): Promise<string> {
  const { deps, timeoutMs, makeId, publish } = params;
  let cleanText = params.cleanText;

  const normalizeArg = (raw: string) => {
    let s = String(raw || '').trim();
    if ((s.startsWith('<') && s.endsWith('>')) || (s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
      s = s.slice(1, -1).trim();
    }
    // common user typo: extra spaces in filename
    s = s.replace(/\s+/g, ' ');
    return s;
  };

  const isUuidLike = (s: string) => /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(s);

  const executeWorkspaceTool = async (toolRaw: string, argRaw: string) => {
    const tool0 = String(toolRaw || '').toUpperCase();
    const tool = tool0 === 'SEARCH_IN_REPO'
      ? 'SEARCH_LIBRARY'
      : tool0 === 'READ_FILE'
        ? 'READ_LIBRARY_DOC'
        : tool0 === 'READ_FILE_CHUNK'
          ? 'READ_LIBRARY_CHUNK'
          : tool0;

    const arg = normalizeArg(argRaw);

    const intentId = makeId();
    publish({
      id: intentId,
      timestamp: Date.now(),
      source: AgentType.CORTEX_FLOW,
      type: PacketType.TOOL_INTENT,
      payload: { tool, arg },
      priority: 0.8
    });

    try {
      if (tool === 'SEARCH_LIBRARY') {
        deps.addMessage('assistant', `Invoking SEARCH_LIBRARY for: "${arg}"`, 'action');
        deps.setCurrentThought(`Workspace search: ${arg}...`);

        const res: any = await withTimeout<any>(searchLibraryChunks({ query: arg, limit: 8 }) as any, timeoutMs, tool);
        if (res.ok === false) throw new Error(res.error);

        const text = res.hits.length === 0
          ? `SEARCH_LIBRARY: no hits for "${arg}".`
          : [
              `SEARCH_LIBRARY hits for "${arg}":`,
              ...res.hits.slice(0, 8).map((h: any, i: number) =>
                `#${i + 1} doc=${h.document_id} chunk=${h.chunk_index} :: ${String(h.snippet || '').replace(/\s+/g, ' ').slice(0, 280)}`
              )
            ].join('\n');

        publish({
          id: makeId(),
          timestamp: Date.now(),
          source: AgentType.CORTEX_FLOW,
          type: PacketType.TOOL_RESULT,
          payload: { tool, arg, intentId, hitsCount: res.hits.length },
          priority: 0.8
        });

        deps.addMessage('assistant', text, 'tool_result');
        return;
      }

      if (tool === 'READ_LIBRARY_CHUNK') {
        const m = arg.match(/^([0-9a-fA-F-]{16,})\s*#\s*(\d+)$/);
        if (!m) throw new Error('READ_LIBRARY_CHUNK arg must be <docId>#<chunkIndex>');
        const documentId = m[1];
        const chunkIndex = Number(m[2]);
        deps.addMessage('assistant', `Invoking READ_LIBRARY_CHUNK for: ${documentId}#${chunkIndex}`, 'action');
        deps.setCurrentThought(`Workspace read chunk: ${chunkIndex}...`);

        const res: any = await withTimeout<any>(getLibraryChunkByIndex({ documentId, chunkIndex }) as any, timeoutMs, tool);
        if (res.ok === false) throw new Error(res.error);
        if (!res.chunk) throw new Error('CHUNK_NOT_FOUND');

        const chunkText = String(res.chunk.content || '').trim();
        const text = [
          `READ_LIBRARY_CHUNK ${documentId}#${chunkIndex}:`,
          chunkText.slice(0, 8000)
        ].join('\n');

        publish({
          id: makeId(),
          timestamp: Date.now(),
          source: AgentType.CORTEX_FLOW,
          type: PacketType.TOOL_RESULT,
          payload: { tool, arg, intentId, length: chunkText.length },
          priority: 0.8
        });

        deps.addMessage('assistant', text, 'tool_result');
        return;
      }

      if (tool === 'READ_LIBRARY_DOC') {
        let documentId = arg;
        if (!isUuidLike(documentId)) {
          const found: any = await withTimeout<any>(findLibraryDocumentByName({ name: documentId }) as any, timeoutMs, 'FIND_LIBRARY_DOC');
          if (found.ok === false) throw new Error(found.error);
          if (!found.document) throw new Error(`DOC_NOT_FOUND_BY_NAME: ${documentId}`);
          documentId = String(found.document.id);
        }

        deps.addMessage('assistant', `Invoking READ_LIBRARY_DOC for: ${documentId}`, 'action');
        deps.setCurrentThought('Workspace read document...');

        const res: any = await withTimeout<any>(downloadLibraryDocumentText({ documentId }) as any, timeoutMs, tool);
        if (res.ok === false) throw new Error(res.error);

        const raw = String(res.text || '');
        const originalName = String(res.doc?.original_name || '').trim();

        const looksLikeJson = originalName.toLowerCase().endsWith('.json') || raw.trim().startsWith('{') || raw.trim().startsWith('[');
        let summaryBlock = '';
        if (looksLikeJson) {
          try {
            const parsed: any = JSON.parse(raw);
            if (parsed && typeof parsed === 'object') {
              const keys = Array.isArray(parsed) ? [] : Object.keys(parsed);
              const tasks = Array.isArray(parsed?.tasks) ? parsed.tasks : [];
              const countsByType: Record<string, number> = {};
              const countsByPriority: Record<string, number> = {};
              const openCritical: any[] = [];
              for (const t of tasks) {
                const type = String(t?.type ?? 'UNKNOWN');
                const prio = String(t?.priority ?? 'UNKNOWN');
                countsByType[type] = (countsByType[type] || 0) + 1;
                countsByPriority[prio] = (countsByPriority[prio] || 0) + 1;
                if (prio === 'CRITICAL' && t?.isCompleted === false) openCritical.push(t);
              }

              summaryBlock = [
                'JSON_SUMMARY:',
                `- keys: ${keys.slice(0, 40).join(', ')}${keys.length > 40 ? ' ...' : ''}`,
                `- version: ${String(parsed?.version ?? '')}`,
                `- project: ${String(parsed?.project ?? '')}`,
                `- dailyGoal: ${String(parsed?.dailyGoal ?? '')}`,
                `- tasks.total: ${tasks.length}`,
                `- tasks.byType: ${Object.entries(countsByType).map(([k, v]) => `${k}=${v}`).join(', ')}`,
                `- tasks.byPriority: ${Object.entries(countsByPriority).map(([k, v]) => `${k}=${v}`).join(', ')}`,
                `- openCritical: ${openCritical.slice(0, 5).map((t) => String(t?.id ?? t?.content ?? 'task')).join(', ')}${openCritical.length > 5 ? ' ...' : ''}`
              ].join('\n');
            }
          } catch {
            // fall back to raw excerpt
          }
        }

        const excerptLimit = looksLikeJson ? 2500 : 8000;
        const excerpt = raw.slice(0, excerptLimit);
        const text = [
          `READ_LIBRARY_DOC ${documentId} (${originalName || 'unknown'}):`,
          summaryBlock ? summaryBlock : '',
          'EXCERPT:',
          excerpt
        ]
          .filter(Boolean)
          .join('\n');

        publish({
          id: makeId(),
          timestamp: Date.now(),
          source: AgentType.CORTEX_FLOW,
          type: PacketType.TOOL_RESULT,
          payload: { tool, arg, intentId, length: raw.length, summarized: !!summaryBlock },
          priority: 0.8
        });

        deps.addMessage('assistant', text, 'tool_result');
        return;
      }

      throw new Error(`Unsupported workspace tool: ${tool}`);
    } catch (error: any) {
      const msg = error?.message || String(error);
      const isTimeout = typeof msg === 'string' && msg.startsWith('TOOL_TIMEOUT:');

      publish({
        id: makeId(),
        timestamp: Date.now(),
        source: AgentType.CORTEX_FLOW,
        type: isTimeout ? PacketType.TOOL_TIMEOUT : PacketType.TOOL_ERROR,
        payload: { tool, arg, intentId, error: msg },
        priority: 0.9
      });

      deps.addMessage(
        'assistant',
        `WORKSPACE_${isTimeout ? 'TIMEOUT' : 'ERROR'}: ${tool} :: ${arg} :: ${msg}`,
        'thought'
      );
    }
  };

  while (true) {
    const match = cleanText.match(WORKSPACE_TAG_REGEX);
    if (!match) break;
    const toolRaw = match[1];
    const argRaw = match[2];
    cleanText = cleanText.replace(match[0], '').trim();
    await executeWorkspaceTool(toolRaw, argRaw);
  }

  return cleanText;
}
