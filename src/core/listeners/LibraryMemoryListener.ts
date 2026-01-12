import { eventBus } from '../EventBus';
import { PacketType } from '../../types';
import { MemoryService, getCurrentAgentId } from '../../services/supabase';

let isRegistered = false;

const neutralEmotion = () => ({
  fear: 0,
  curiosity: 0,
  frustration: 0,
  satisfaction: 0
});

export function registerLibraryMemoryListener(): () => void {
  if (isRegistered) return () => {};
  isRegistered = true;

  const onToolResult = (packet: any) => {
    const payload = packet?.payload || {};
    const tool = payload.tool;
    const docId = payload.docId || payload.documentId || payload.arg || null;

    if (!docId || typeof docId !== 'string') return;

    if (tool === 'READ_LIBRARY_DOC' || tool === 'LIST_LIBRARY_CHUNKS') {
      const name = payload.name || payload.original_name || '';
      const chunkCount = payload.chunkCount || payload.shown || null;
      void injectLibraryAwareness(docId, name, chunkCount);
      return;
    }

    if (tool === 'READ_LIBRARY_CHUNK') {
      const chunkIndex = typeof payload.chunkIndex === 'number' ? payload.chunkIndex : null;
      const length = typeof payload.length === 'number' ? payload.length : 0;
      if (chunkIndex !== null && length > 500) {
        void injectChunkMemory(docId, chunkIndex);
      }
    }
  };

  const unsubscribe = eventBus.subscribe(PacketType.TOOL_RESULT, onToolResult);

  return () => {
    unsubscribe();
    isRegistered = false;
  };
}

async function injectLibraryAwareness(docId: string, originalName?: string, chunkCount?: number | null) {
  const agentId = getCurrentAgentId();
  if (!agentId || !docId) return;

  const existing = await MemoryService.findMemoryIdByDocumentId(docId, 'WORKSPACE_DOC_SUMMARY');
  if (existing) return;

  const name = originalName || docId;
  const suffix = chunkCount ? ` (${chunkCount} chunkow)` : '';
  await MemoryService.storeMemory({
    id: `library-doc:${docId}`,
    content: `Mam w bibliotece: "${name}"${suffix}`,
    emotionalContext: neutralEmotion(),
    timestamp: new Date().toISOString(),
    metadata: {
      kind: 'WORKSPACE_DOC_SUMMARY',
      document_id: docId,
      source: 'TOOL_RESULT'
    },
    skipEmbedding: true
  });
}

async function injectChunkMemory(docId: string, chunkIndex: number) {
  const agentId = getCurrentAgentId();
  if (!agentId || !docId) return;

  await MemoryService.storeMemory({
    id: `library-chunk:${docId}:${chunkIndex}`,
    content: `Czytalem chunk #${chunkIndex} dokumentu ${docId}`,
    emotionalContext: neutralEmotion(),
    timestamp: new Date().toISOString(),
    metadata: {
      kind: 'WORKSPACE_CHUNK_READ',
      document_id: docId,
      chunk_index: chunkIndex,
      source: 'TOOL_RESULT'
    },
    skipEmbedding: true
  });
}
