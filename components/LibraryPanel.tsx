import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FileUp, RefreshCw, Loader2, Sparkles, X, ChevronDown, ChevronUp, Layers } from 'lucide-react';
import { useSession } from '../contexts/SessionContext';
import { listLibraryChunks, listLibraryDocuments, uploadLibraryFile, type LibraryChunk, type LibraryDocument } from '../services/LibraryService';
import { ingestLibraryDocument } from '../services/LibraryIngestService';

export function LibraryPanel() {
  const { authUserId, userEmail, agentId } = useSession();
  const [documents, setDocuments] = useState<LibraryDocument[]>([]);
  const [error, setError] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [ingestingById, setIngestingById] = useState<Record<string, boolean>>({});
  const [ingestErrorById, setIngestErrorById] = useState<Record<string, string>>({});
  const [expandedSummaryById, setExpandedSummaryById] = useState<Record<string, boolean>>({});
  const [chunksDoc, setChunksDoc] = useState<LibraryDocument | null>(null);
  const [chunks, setChunks] = useState<LibraryChunk[]>([]);
  const [isChunksLoading, setIsChunksLoading] = useState(false);
  const [chunksError, setChunksError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canUse = Boolean(authUserId && userEmail);

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

  const onChooseFile = () => fileInputRef.current?.click();

  const onIngest = async (doc: LibraryDocument) => {
    if (!canUse) return;
    setIngestErrorById((prev) => ({ ...prev, [doc.id]: '' }));
    setIngestingById((prev) => ({ ...prev, [doc.id]: true }));
    const res = await ingestLibraryDocument({ document: doc });
    if (res.ok === false) {
      setIngestErrorById((prev) => ({ ...prev, [doc.id]: res.error }));
      setIngestingById((prev) => ({ ...prev, [doc.id]: false }));
      return;
    }
    await refresh();
    setIngestingById((prev) => ({ ...prev, [doc.id]: false }));
  };

  const toggleSummary = (docId: string) => {
    setExpandedSummaryById((prev) => ({ ...prev, [docId]: !prev[docId] }));
  };

  const openChunks = async (doc: LibraryDocument) => {
    setChunksDoc(doc);
    setChunks([]);
    setChunksError('');
    setIsChunksLoading(true);
    const res = await listLibraryChunks({ documentId: doc.id, limit: 80 });
    if (res.ok === false) {
      setChunksError(res.error);
      setIsChunksLoading(false);
      return;
    }
    setChunks(res.chunks);
    setIsChunksLoading(false);
  };

  const closeChunks = () => {
    setChunksDoc(null);
    setChunks([]);
    setChunksError('');
    setIsChunksLoading(false);
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
      if (!(lower.endsWith('.txt') || lower.endsWith('.md') || lower.endsWith('.json'))) {
        setError('Dozwolone pliki: .txt, .md, .json');
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
        <button
          onClick={refresh}
          className="text-gray-500 hover:text-gray-300 transition-colors"
          title="Refresh"
          disabled={!canUse || isLoading}
        >
          <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".txt,.md,.json,text/plain,text/markdown,application/json"
        onChange={onFileSelected}
        className="hidden"
      />

      <div className="grid grid-cols-1 gap-2">
        <button
          onClick={onChooseFile}
          disabled={!canUse || isUploading}
          className="flex items-center justify-between px-3 py-2 rounded-lg border border-gray-700 bg-gray-900/30 text-[11px] font-mono text-gray-300 hover:bg-gray-900/60 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title={!canUse ? 'Zaloguj się przez Supabase Auth' : 'Upload .txt/.md/.json'}
        >
          <span className="flex items-center gap-2"><FileUp size={12} /> UPLOAD .TXT/.MD/.JSON</span>
          <span>{isUploading ? '...' : ''}</span>
        </button>

        {error && (
          <div className="text-[11px] text-red-400 break-words">{error}</div>
        )}

        <div className="text-[10px] text-gray-600 font-mono">
          {canUse ? (userEmail || '—') : 'Not authenticated'}
        </div>

        <div className="space-y-2">
          {(filteredDocs || []).slice(0, 10).map((d) => (
            <div
              key={d.id}
              className="rounded-lg border border-gray-800 bg-gray-900/20 px-3 py-2"
              title={d.storage_path}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="text-[11px] text-gray-200 truncate">{d.original_name}</div>
                <div className="flex items-center gap-2">
                  <div className="text-[9px] text-gray-600 font-mono">{d.status}</div>
                  <button
                    onClick={() => onIngest(d)}
                    disabled={!canUse || Boolean(ingestingById[d.id])}
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
              <div className="mt-1 flex items-center justify-between gap-2">
                <div className="text-[9px] text-gray-600 font-mono truncate">{d.storage_path}</div>
                <div className="text-[9px] text-gray-600 font-mono">{Math.round((d.byte_size || 0) / 1024)}kb</div>
              </div>

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
                      : `${String(d.global_summary).slice(0, 220)}${String(d.global_summary).length > 220 ? '…' : ''}`}
                  </div>
                </div>
              )}

              {(d.status === 'ingested' || Boolean(d.ingested_at) || (d.global_summary && String(d.global_summary).trim())) && (
                <div className="mt-2 flex items-center justify-between">
                  <div>
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

                  <button
                    onClick={() => openChunks(d)}
                    className="text-[9px] font-mono text-gray-500 hover:text-gray-300 transition-colors"
                    title="View chunks"
                  >
                    <span className="flex items-center gap-1"><Layers size={12} /> CHUNKS</span>
                  </button>
                </div>
              )}

              {ingestErrorById[d.id] && (
                <div className="mt-2 text-[10px] text-red-400 break-words">
                  {ingestErrorById[d.id]}
                </div>
              )}
            </div>
          ))}

          {(filteredDocs || []).length === 0 && (
            <div className="text-[11px] text-gray-600 italic">No documents yet.</div>
          )}
        </div>
      </div>

      {chunksDoc && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={closeChunks}
        >
          <div
            className="w-full max-w-3xl max-h-[85vh] rounded-xl border border-gray-800 bg-[#0b0e14] shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
              <div className="min-w-0">
                <div className="text-[11px] font-mono text-gray-300 truncate">{chunksDoc.original_name}</div>
                <div className="text-[9px] font-mono text-gray-600 truncate">{chunksDoc.id}</div>
              </div>
              <button
                onClick={closeChunks}
                className="text-gray-500 hover:text-gray-300 transition-colors"
                title="Close"
              >
                <X size={16} />
              </button>
            </div>

            <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
              <div className="text-[10px] font-mono text-gray-500">CHUNKS</div>
              <div className="text-[10px] font-mono text-gray-600">{chunks.length}</div>
            </div>

            <div className="p-4 overflow-y-auto max-h-[calc(85vh-96px)] space-y-2">
              {chunksError && (
                <div className="text-[11px] text-red-400 break-words">{chunksError}</div>
              )}
              {isChunksLoading && (
                <div className="text-[11px] text-gray-400 font-mono flex items-center gap-2">
                  <Loader2 size={14} className="animate-spin" /> loading…
                </div>
              )}

              {!isChunksLoading && !chunksError && chunks.map((c) => (
                <div key={c.id} className="rounded-lg border border-gray-800 bg-gray-900/20 px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-[10px] font-mono text-gray-500">#{c.chunk_index}</div>
                    <div className="text-[9px] font-mono text-gray-600">{c.start_offset}–{c.end_offset}</div>
                  </div>

                  {c.summary && String(c.summary).trim() && (
                    <div className="mt-2 text-[11px] text-gray-200 whitespace-pre-wrap break-words">
                      {String(c.summary)}
                    </div>
                  )}

                  {c.content && String(c.content).trim() && (
                    <div className="mt-2 text-[10px] text-gray-500 whitespace-pre-wrap break-words">
                      {String(c.content).slice(0, 420)}{String(c.content).length > 420 ? '…' : ''}
                    </div>
                  )}
                </div>
              ))}

              {!isChunksLoading && !chunksError && chunks.length === 0 && (
                <div className="text-[11px] text-gray-600 italic">No chunks for this document.</div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
