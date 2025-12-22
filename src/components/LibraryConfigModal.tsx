import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Loader2, RefreshCw } from 'lucide-react';
import { supabase } from '../services/supabase';
import { listLibraryChunks, type LibraryChunk, type LibraryDocument } from '../services/LibraryService';
import { safeParseJson, splitTodo3, type SplitResult } from '../utils/splitTodo3';

type Tab = 'chunks' | 'actions';

async function downloadDocumentText(doc: LibraryDocument): Promise<string> {
  const dl = await supabase.storage.from(doc.storage_bucket).download(doc.storage_path);
  if (dl.error) throw new Error(dl.error.message);
  return await dl.data.text();
}

export function LibraryConfigModal(props: {
  doc: LibraryDocument | null;
  isOpen: boolean;
  onClose: () => void;
}) {
  const { doc, isOpen, onClose } = props;
  const [tab, setTab] = useState<Tab>('actions');

  const [chunks, setChunks] = useState<LibraryChunk[]>([]);
  const [chunksError, setChunksError] = useState('');
  const [isChunksLoading, setIsChunksLoading] = useState(false);

  const [actionError, setActionError] = useState('');
  const [actionOutput, setActionOutput] = useState<SplitResult | null>(null);
  const [isActionRunning, setIsActionRunning] = useState(false);

  const canShow = Boolean(isOpen && doc);

  const reloadChunks = useCallback(async () => {
    if (!doc) return;
    setIsChunksLoading(true);
    setChunksError('');
    setChunks([]);
    const res = await listLibraryChunks({ documentId: doc.id, limit: 200 });
    if (res.ok === false) {
      setChunksError(res.error);
      setIsChunksLoading(false);
      return;
    }
    setChunks(res.chunks);
    setIsChunksLoading(false);
  }, [doc]);

  useEffect(() => {
    if (!canShow) return;
    setTab('actions');
    setActionError('');
    setActionOutput(null);
    void reloadChunks();
  }, [canShow, reloadChunks]);

  const isNexusStateJson = useMemo(() => {
    if (!doc) return false;
    return (doc.original_name || '').toLowerCase().endsWith('ak-flow-state.json');
  }, [doc]);

  const runSplitTodo3 = useCallback(async () => {
    if (!doc) return;
    setIsActionRunning(true);
    setActionError('');
    setActionOutput(null);

    try {
      const raw = await downloadDocumentText(doc);
      const parsed = safeParseJson(raw);
      if (!parsed) {
        setActionError('JSON_PARSE_ERROR');
        setIsActionRunning(false);
        return;
      }
      const result = splitTodo3(parsed);
      setActionOutput(result);
      setIsActionRunning(false);
    } catch (err: any) {
      setActionError(String(err?.message ?? err));
      setIsActionRunning(false);
    }
  }, [doc]);

  if (!canShow) return null;

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="w-full max-w-3xl max-h-[85vh] rounded-xl border border-gray-800 bg-[#0b0e14] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
          <div className="min-w-0">
            <div className="text-[11px] font-mono text-gray-300 truncate">CONFIG</div>
            <div className="text-[10px] text-gray-200 truncate">{doc?.original_name}</div>
            <div className="text-[9px] font-mono text-gray-600 truncate">{doc?.id}</div>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 transition-colors" title="Close">
            <X size={16} />
          </button>
        </div>

        <div className="px-4 py-2 border-b border-gray-800 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setTab('actions')}
              className={`px-2 py-1 rounded-md border text-[9px] font-mono transition-colors ${tab === 'actions'
                ? 'border-cyan-500/40 bg-cyan-950/20 text-cyan-200'
                : 'border-gray-700 bg-gray-900/30 text-gray-400 hover:bg-gray-900/60'}`}
              title="Actions"
            >
              ACTIONS
            </button>
            <button
              onClick={() => setTab('chunks')}
              className={`px-2 py-1 rounded-md border text-[9px] font-mono transition-colors ${tab === 'chunks'
                ? 'border-cyan-500/40 bg-cyan-950/20 text-cyan-200'
                : 'border-gray-700 bg-gray-900/30 text-gray-400 hover:bg-gray-900/60'}`}
              title="Chunks"
            >
              CHUNKS
            </button>
          </div>

          <button
            onClick={reloadChunks}
            className="text-[9px] font-mono text-gray-500 hover:text-gray-300 transition-colors"
            title="Reload"
          >
            <span className="flex items-center gap-1"><RefreshCw size={12} /> RELOAD</span>
          </button>
        </div>

        <div className="p-4 overflow-y-auto max-h-[calc(85vh-86px)]">
          {tab === 'actions' && (
            <div className="space-y-3">
              <div className="text-[10px] font-mono text-gray-500">DOCUMENT_ACTIONS</div>

              {actionError && (
                <div className="text-[11px] text-red-400 break-words">{actionError}</div>
              )}

              <div className="flex items-center gap-2">
                <button
                  onClick={runSplitTodo3}
                  disabled={!isNexusStateJson || isActionRunning}
                  className="px-3 py-2 rounded-lg border border-gray-700 bg-gray-900/30 text-[11px] font-mono text-gray-300 hover:bg-gray-900/60 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title={!isNexusStateJson ? 'Only ak-flow-state.json supported in v1' : 'Split tasks into 3 buckets'}
                >
                  <span className="flex items-center gap-2">
                    {isActionRunning ? <Loader2 size={14} className="animate-spin" /> : null}
                    SPLIT TODO → 3
                  </span>
                </button>
              </div>

              {actionOutput && (
                <div className="grid grid-cols-1 gap-2">
                  <div className="rounded-lg border border-gray-800 bg-gray-900/20 px-3 py-2">
                    <div className="text-[10px] font-mono text-gray-500 mb-2">NOW ({actionOutput.now.length})</div>
                    {actionOutput.now.length === 0 ? (
                      <div className="text-[11px] text-gray-600 italic">—</div>
                    ) : (
                      <div className="space-y-1">
                        {actionOutput.now.slice(0, 30).map((t, i) => (
                          <div key={`${t.id || i}`} className="text-[11px] text-gray-200 break-words">
                            {t.content || t.id || '—'}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="rounded-lg border border-gray-800 bg-gray-900/20 px-3 py-2">
                    <div className="text-[10px] font-mono text-gray-500 mb-2">NEXT ({actionOutput.next.length})</div>
                    {actionOutput.next.length === 0 ? (
                      <div className="text-[11px] text-gray-600 italic">—</div>
                    ) : (
                      <div className="space-y-1">
                        {actionOutput.next.slice(0, 30).map((t, i) => (
                          <div key={`${t.id || i}`} className="text-[11px] text-gray-200 break-words">
                            {t.content || t.id || '—'}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="rounded-lg border border-gray-800 bg-gray-900/20 px-3 py-2">
                    <div className="text-[10px] font-mono text-gray-500 mb-2">LATER ({actionOutput.later.length})</div>
                    {actionOutput.later.length === 0 ? (
                      <div className="text-[11px] text-gray-600 italic">—</div>
                    ) : (
                      <div className="space-y-1">
                        {actionOutput.later.slice(0, 30).map((t, i) => (
                          <div key={`${t.id || i}`} className="text-[11px] text-gray-200 break-words">
                            {t.content || t.id || '—'}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === 'chunks' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-[10px] font-mono text-gray-500">CHUNKS</div>
                <div className="text-[10px] font-mono text-gray-600">{chunks.length}</div>
              </div>

              {chunksError && (
                <div className="text-[11px] text-red-400 break-words">{chunksError}</div>
              )}
              {isChunksLoading && (
                <div className="text-[11px] text-gray-400 font-mono flex items-center gap-2">
                  <Loader2 size={14} className="animate-spin" /> loading…
                </div>
              )}

              {!isChunksLoading && !chunksError && chunks.length === 0 && (
                <div className="text-[11px] text-gray-600 italic">No chunks for this document.</div>
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
                      {String(c.content).slice(0, 800)}{String(c.content).length > 800 ? '…' : ''}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
