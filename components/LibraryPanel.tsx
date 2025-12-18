import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FileUp, RefreshCw } from 'lucide-react';
import { useSession } from '../contexts/SessionContext';
import { listLibraryDocuments, uploadLibraryFile, type LibraryDocument } from '../services/LibraryService';

export function LibraryPanel() {
  const { authUserId, userEmail, agentId } = useSession();
  const [documents, setDocuments] = useState<LibraryDocument[]>([]);
  const [error, setError] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
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
      if (!(lower.endsWith('.txt') || lower.endsWith('.md'))) {
        setError('Dozwolone pliki: .txt, .md');
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
        accept=".txt,.md,text/plain,text/markdown"
        onChange={onFileSelected}
        className="hidden"
      />

      <div className="grid grid-cols-1 gap-2">
        <button
          onClick={onChooseFile}
          disabled={!canUse || isUploading}
          className="flex items-center justify-between px-3 py-2 rounded-lg border border-gray-700 bg-gray-900/30 text-[11px] font-mono text-gray-300 hover:bg-gray-900/60 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title={!canUse ? 'Zaloguj się przez Supabase Auth' : 'Upload .txt/.md'}
        >
          <span className="flex items-center gap-2"><FileUp size={12} /> UPLOAD .TXT/.MD</span>
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
                <div className="text-[9px] text-gray-600 font-mono">{d.status}</div>
              </div>
              <div className="mt-1 flex items-center justify-between gap-2">
                <div className="text-[9px] text-gray-600 font-mono truncate">{d.storage_path}</div>
                <div className="text-[9px] text-gray-600 font-mono">{Math.round((d.byte_size || 0) / 1024)}kb</div>
              </div>
            </div>
          ))}

          {(filteredDocs || []).length === 0 && (
            <div className="text-[11px] text-gray-600 italic">No documents yet.</div>
          )}
        </div>
      </div>
    </div>
  );
}
