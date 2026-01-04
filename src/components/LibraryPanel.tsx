import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FileUp, RefreshCw, Loader2, Sparkles, ChevronDown, ChevronUp, Layers, Trash2 } from 'lucide-react';
import { useSession } from '../contexts/SessionContext';
import { eventBus } from '../core/EventBus';
import { PacketType } from '../types';
import { deleteLibraryDocument, listLibraryDocuments, uploadLibraryFile, type LibraryDocument } from '../services/LibraryService';
import { ingestLibraryDocument } from '../services/LibraryIngestService';
import { LibraryConfigModal } from './LibraryConfigModal';

export function LibraryPanel() {
  const { authUserId, userEmail, agentId } = useSession();
  const [documents, setDocuments] = useState<LibraryDocument[]>([]);
  const [error, setError] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [ingestingById, setIngestingById] = useState<Record<string, boolean>>({});
  const [ingestErrorById, setIngestErrorById] = useState<Record<string, string>>({});
  const [ingestProgressById, setIngestProgressById] = useState<Record<string, { processedChunks: number; totalChunks: number }>>({});
  const [expandedSummaryById, setExpandedSummaryById] = useState<Record<string, boolean>>({});
  const [expandedDocById, setExpandedDocById] = useState<Record<string, boolean>>({});
  const [deletingById, setDeletingById] = useState<Record<string, boolean>>({});
  const [deleteErrorById, setDeleteErrorById] = useState<Record<string, string>>({});
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [configDoc, setConfigDoc] = useState<LibraryDocument | null>(null);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canUse = Boolean(authUserId && userEmail);
  const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

  const filteredDocs = useMemo(() => {
    if (!agentId) return documents;
    return documents.filter((d) => (d.agent_id || null) === agentId);
  }, [documents, agentId]);

  const refresh = useCallback(async () => {
    if (!canUse) return;
    setIsLoading(true);
    setError('');
    const res = await listLibraryDocuments({ limit: 25 });
    if (res.ok === false) {
      setError(res.error);
      setDocuments([]);
      setIsLoading(false);
      return;
    }
    setDocuments(res.documents);
    setIsLoading(false);
  }, [canUse]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const unsubscribe = eventBus.subscribe(PacketType.SYSTEM_ALERT, (packet) => {
      if (packet.payload?.event !== 'LIBRARY_UPLOAD_OK') return;
      const docAgentId = packet.payload?.document?.agent_id ?? null;
      if (agentId && docAgentId && docAgentId !== agentId) return;
      void refresh();
    });
    return () => unsubscribe();
  }, [agentId, refresh]);

  const onChooseFile = () => fileInputRef.current?.click();

  const onIngest = async (doc: LibraryDocument) => {
    if (!canUse) return;
    setIngestErrorById((prev) => ({ ...prev, [doc.id]: '' }));
    setIngestingById((prev) => ({ ...prev, [doc.id]: true }));
    setIngestProgressById((prev) => ({ ...prev, [doc.id]: { processedChunks: 0, totalChunks: 0 } }));
    const res = await ingestLibraryDocument({
      document: doc,
      onProgress: (progress) => {
        setIngestProgressById((prev) => ({
          ...prev,
          [doc.id]: { processedChunks: progress.processedChunks, totalChunks: progress.totalChunks }
        }));
      }
    });
    if (res.ok === false) {
      setIngestErrorById((prev) => ({ ...prev, [doc.id]: res.error }));
      setIngestingById((prev) => ({ ...prev, [doc.id]: false }));
      setIngestProgressById((prev) => {
        const next = { ...prev };
        delete next[doc.id];
        return next;
      });
      return;
    }
    await refresh();
    setIngestingById((prev) => ({ ...prev, [doc.id]: false }));
    setIngestProgressById((prev) => {
      const next = { ...prev };
      delete next[doc.id];
      return next;
    });
  };

  const toggleSummary = (docId: string) => {
    setExpandedSummaryById((prev) => ({ ...prev, [docId]: !prev[docId] }));
  };

  const toggleDoc = (docId: string) => {
    setExpandedDocById((prev) => ({ ...prev, [docId]: !prev[docId] }));
  };

  const openConfig = useCallback((doc: LibraryDocument) => {
    setConfigDoc(doc);
    setIsConfigOpen(true);
  }, []);

  const closeConfig = useCallback(() => {
    setIsConfigOpen(false);
  }, []);

  const onDelete = async (doc: LibraryDocument) => {
    if (!canUse) return;
    const name = doc.original_name || doc.id;
    const shouldDelete = typeof window === 'undefined'
      ? true
      : window.confirm(`Delete "${name}"? This removes the file and its chunks.`);
    if (!shouldDelete) return;

    setDeleteErrorById((prev) => ({ ...prev, [doc.id]: '' }));
    setDeletingById((prev) => ({ ...prev, [doc.id]: true }));
    const res = await deleteLibraryDocument({ document: doc });
    if (res.ok === false) {
      setDeleteErrorById((prev) => ({ ...prev, [doc.id]: res.error }));
      setDeletingById((prev) => ({ ...prev, [doc.id]: false }));
      return;
    }

    if (configDoc?.id === doc.id) {
      setIsConfigOpen(false);
      setConfigDoc(null);
    }

    await refresh();
    setDeletingById((prev) => {
      const next = { ...prev };
      delete next[doc.id];
      return next;
    });
    setDeleteErrorById((prev) => {
      const next = { ...prev };
      delete next[doc.id];
      return next;
    });
    setIngestProgressById((prev) => {
      const next = { ...prev };
      delete next[doc.id];
      return next;
    });
    setIngestErrorById((prev) => {
      const next = { ...prev };
      delete next[doc.id];
      return next;
    });
  };

  const onFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const file = e.target.files?.[0] || null;
      e.target.value = '';

      if (!file) return;
      if (!canUse) {
        setError('Brak sesji Supabase (authUserId/userEmail)');
        return;
      }

      const lower = file.name.toLowerCase();
      const isText =
        lower.endsWith('.txt') ||
        lower.endsWith('.md') ||
        lower.endsWith('.json');
      const isImage =
        lower.endsWith('.png') ||
        lower.endsWith('.jpg') ||
        lower.endsWith('.jpeg') ||
        lower.endsWith('.webp');

      if (!isText && !isImage) {
        setError('Allowed: .txt, .md, .json, .png, .jpg, .jpeg, .webp');
        return;
      }
      if (isImage && file.size > MAX_IMAGE_BYTES) {
        setError('Image too large (max 10MB).');
        return;
      }

      setIsUploading(true);
      setError('');

      const res = await uploadLibraryFile({
        file,
        authUserId: authUserId as string,
        userEmail: userEmail as string,
        agentId: agentId ?? null
      });

      if (res.ok === false) {
        setError(res.error);
        setIsUploading(false);
        return;
      }

      await refresh();
      setIsUploading(false);
    } catch (err: any) {
      setError(String(err?.message ?? err));
      setIsUploading(false);
    }
  };

  return (
    <div className="p-4 border-b border-gray-800">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[10px] font-mono tracking-widest text-gray-500">LIBRARY</div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsCollapsed((v) => !v)}
            className="text-gray-500 hover:text-gray-300 transition-colors"
            title={isCollapsed ? 'Expand' : 'Collapse'}
          >
            {isCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          </button>
          <button
            onClick={refresh}
            className="text-gray-500 hover:text-gray-300 transition-colors"
            title="Refresh"
            disabled={!canUse || isLoading}
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".txt,.md,.json,.png,.jpg,.jpeg,.webp,text/plain,text/markdown,application/json,image/png,image/jpeg,image/webp"
        onChange={onFileSelected}
        className="hidden"
      />

      {!isCollapsed && (
        <div className="grid grid-cols-1 gap-2">
        <button
          onClick={onChooseFile}
          disabled={!canUse || isUploading}
          className="flex items-center justify-between px-3 py-2 rounded-lg border border-gray-700 bg-gray-900/30 text-[11px] font-mono text-gray-300 hover:bg-gray-900/60 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title={!canUse ? 'Log in via Supabase Auth' : 'Upload .txt/.md/.json/.png/.jpg/.webp'}
        >
          <span className="flex items-center gap-2"><FileUp size={12} /> UPLOAD .TXT/.MD/.JSON/.PNG/.JPG/.WEBP</span>
          <span>{isUploading ? '...' : ''}</span>
        </button>

        {error && (
          <div className="text-[11px] text-red-400 break-words">{error}</div>
        )}

        <div className="text-[10px] text-gray-600 font-mono">
          {canUse ? (userEmail || '—') : 'Not authenticated'}
        </div>

        <div className="space-y-2 max-h-[42vh] overflow-y-auto pr-1 custom-scrollbar">
          {(filteredDocs || []).slice(0, 10).map((d) => (
            <div
              key={d.id}
              className="rounded-lg border border-gray-800 bg-gray-900/20 px-3 py-2"
              title={d.storage_path}
            >
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-[11px] text-gray-200 truncate">{d.original_name}</div>
                <div
                  className={d.status === 'ingested'
                    ? 'text-[9px] font-mono text-emerald-400'
                    : 'text-[9px] font-mono text-gray-600'}
                  title={d.status === 'ingested' ? 'Ingested (chunks ready)' : 'Uploaded (not ingested)'}
                >
                  {d.status}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => toggleDoc(d.id)}
                  className="p-1 rounded-md border border-gray-800/60 text-gray-500 hover:text-gray-200 hover:bg-gray-800/30 transition-colors"
                  title={expandedDocById[d.id] ? 'Collapse details' : 'Expand details'}
                >
                  {expandedDocById[d.id] ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                </button>
                <button
                  onClick={() => onDelete(d)}
                  disabled={!canUse || Boolean(deletingById[d.id])}
                  className="p-1 rounded-md border border-gray-800/60 text-gray-500 hover:text-red-300 hover:bg-gray-800/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Delete file"
                >
                  {deletingById[d.id] ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                </button>
                <button
                  onClick={() => openConfig(d)}
                  className="p-1 rounded-md border border-gray-800/60 text-gray-500 hover:text-gray-200 hover:bg-gray-800/30 transition-colors"
                  title="Open config"
                >
                  <Layers size={12} />
                </button>
                <button
                  onClick={() => onIngest(d)}
                  disabled={!canUse || Boolean(ingestingById[d.id]) || Boolean(deletingById[d.id])}
                  className="px-2 py-1 rounded-md border border-gray-700 bg-gray-900/30 text-[9px] font-mono text-gray-300 hover:bg-gray-900/60 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Ingest: chunking + summaries"
                >
                  <span className="flex items-center gap-1">
                    {ingestingById[d.id] ? (
                      <Loader2 size={10} className="animate-spin" />
                    ) : (
                      <Sparkles size={10} />
                    )}
                    INGEST
                  </span>
                </button>
              </div>
            </div>
              <div className="mt-1 text-[9px] text-gray-600 font-mono">
                {Math.round((d.byte_size || 0) / 1024)}kb
            </div>

              {ingestProgressById[d.id] && ingestingById[d.id] && (
                <div className="mt-1 text-[9px] text-gray-600 font-mono">
                  ingest: {ingestProgressById[d.id].processedChunks}/{ingestProgressById[d.id].totalChunks}
                </div>
              )}

              {expandedDocById[d.id] && (
                <>
                  <div className="mt-2 text-[9px] text-gray-600 font-mono truncate">{d.storage_path}</div>

                  {d.ingested_at && (
                    <div className="mt-2 text-[9px] text-gray-600 font-mono">
                      ingested: {new Date(d.ingested_at).toLocaleString()}
                    </div>
                  )}

                  {(d.global_summary && String(d.global_summary).trim()) && (
                    <div className="mt-2">
                      <div
                        className={`text-[10px] text-gray-400 leading-snug break-words whitespace-pre-wrap ${expandedSummaryById[d.id] ? 'max-h-40 overflow-y-auto pr-1' : ''}`}
                      >
                        {expandedSummaryById[d.id]
                          ? String(d.global_summary)
                          : `${String(d.global_summary).slice(0, 220)}${String(d.global_summary).length > 220 ? '...' : ''}`}
                      </div>
                    </div>
                  )}

                  {(d.status === 'ingested' || Boolean(d.ingested_at) || (d.global_summary && String(d.global_summary).trim())) && (
                    <div className="mt-2">
                      {d.global_summary && String(d.global_summary).length > 220 && (
                        <button
                          onClick={() => toggleSummary(d.id)}
                          className="text-[9px] font-mono text-gray-500 hover:text-gray-300 transition-colors"
                          title={expandedSummaryById[d.id] ? 'Collapse' : 'Expand'}
                        >
                          <span className="flex items-center gap-1">
                            {expandedSummaryById[d.id] ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                            {expandedSummaryById[d.id] ? 'LESS' : 'MORE'}
                          </span>
                        </button>
                      )}
                    </div>
                  )}
                </>
              )}

              {ingestErrorById[d.id] && (
                <div className="mt-2 text-[10px] text-red-400 break-words">
                  {ingestErrorById[d.id]}
                </div>
              )}
              {deleteErrorById[d.id] && (
                <div className="mt-2 text-[10px] text-red-400 break-words">
                  {deleteErrorById[d.id]}
                </div>
              )}
            </div>
          ))}

          {(filteredDocs || []).length === 0 && (
            <div className="text-[11px] text-gray-600 italic">No documents yet.</div>
          )}
        </div>
        </div>
      )}

      <LibraryConfigModal doc={configDoc} isOpen={isConfigOpen} onClose={closeConfig} />
    </div>
  );
}
