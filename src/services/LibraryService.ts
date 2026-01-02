import { supabase } from './supabase';

export interface LibraryDocument {
  id: string;
  user_id?: string;
  owner_id?: string | null;
  agent_id?: string | null;
  original_name: string;
  storage_bucket: string;
  storage_path: string;
  mime_type: string;
  byte_size: number;
  doc_type: string;
  tags?: any;
  reason?: string;
  global_summary?: string;
  status: string;
  created_at: string;
  ingested_at?: string | null;
}

export interface LibraryChunk {
  id: string;
  document_id: string;
  chunk_index: number;
  start_offset: number;
  end_offset: number;
  content?: string | null;
  summary?: string | null;
  created_at: string;
}

export interface LibraryChunkSearchHit {
  document_id: string;
  chunk_index: number;
  start_offset: number;
  end_offset: number;
  summary?: string | null;
  snippet: string;
  score?: number;
}

function sanitizeFilename(name: string): string {
  const trimmed = name.trim();
  const safe = trimmed
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9._-]/g, '');
  return safe || 'file';
}

function inferMimeType(file: File): string {
  if (file.type) return file.type;
  const lower = file.name.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.md')) return 'text/markdown';
  if (lower.endsWith('.txt')) return 'text/plain';
  if (lower.endsWith('.json')) return 'application/json';
  return 'application/octet-stream';
}

function inferDocType(file: File): string {
  const lower = file.name.toLowerCase();
  if (file.type && file.type.startsWith('image/')) return 'image';
  if (lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.webp')) {
    return 'image';
  }
  if (lower.endsWith('.json')) return 'json';
  return 'text';
}

export async function uploadLibraryFile(params: {
  file: File;
  authUserId: string;
  userEmail: string;
  agentId?: string | null;
}): Promise<{ ok: true; document: LibraryDocument } | { ok: false; error: string }> {
  const { file, authUserId, userEmail, agentId } = params;

  const safeName = sanitizeFilename(file.name);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const storage_path = `${authUserId}/docs/${stamp}_${safeName}`;

  const up = await supabase.storage.from('ak_library').upload(storage_path, file, { upsert: false });
  if (up.error) {
    return { ok: false, error: up.error.message };
  }

  const payload = {
    owner_id: authUserId,
    // legacy fallback for older schemas (may be NOT NULL)
    user_id: userEmail,
    agent_id: agentId ?? null,
    original_name: file.name,
    storage_bucket: 'ak_library',
    storage_path,
    mime_type: inferMimeType(file),
    byte_size: file.size,
    doc_type: inferDocType(file),
    status: 'uploaded'
  };

  const ins = await supabase
    .from('library_documents')
    .insert([payload])
    .select('*')
    .single();

  if (ins.error) {
    await supabase.storage.from('ak_library').remove([storage_path]);
    return { ok: false, error: ins.error.message };
  }

  return { ok: true, document: ins.data as LibraryDocument };
}

export async function listLibraryDocuments(params?: {
  limit?: number;
  agentId?: string | null;
}): Promise<{ ok: true; documents: LibraryDocument[] } | { ok: false; error: string }> {
  const limit = params?.limit ?? 25;

  let q = supabase
    .from('library_documents')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (params?.agentId) {
    q = q.eq('agent_id', params.agentId);
  }

  const res = await q;
  if (res.error) return { ok: false, error: res.error.message };
  return { ok: true, documents: (res.data as LibraryDocument[]) || [] };
}

 export async function findLibraryDocumentByName(params: {
   name: string;
   agentId?: string | null;
 }): Promise<{ ok: true; document: LibraryDocument | null } | { ok: false; error: string }> {
   const name = String(params.name || '').trim();
   if (!name) return { ok: true, document: null };

   let q = supabase
     .from('library_documents')
     .select('*')
     .order('created_at', { ascending: false })
     .limit(5)
     .ilike('original_name', `%${name}%`);

   if (params.agentId) {
     q = q.eq('agent_id', params.agentId);
   }

   const res = await q;
   if (res.error) return { ok: false, error: res.error.message };
   const first = Array.isArray(res.data) ? (res.data[0] as LibraryDocument | undefined) : undefined;
   return { ok: true, document: first ?? null };
 }

export async function listLibraryChunks(params: {
  documentId: string;
  limit?: number;
}): Promise<{ ok: true; chunks: LibraryChunk[] } | { ok: false; error: string }> {
  const limit = params.limit ?? 50;

  const res = await supabase
    .from('library_chunks')
    .select('id,document_id,chunk_index,start_offset,end_offset,content,summary,created_at')
    .eq('document_id', params.documentId)
    .order('chunk_index', { ascending: true })
    .limit(limit);

  if (res.error) return { ok: false, error: res.error.message };
  return { ok: true, chunks: (res.data as LibraryChunk[]) || [] };
}

export async function getLibraryChunkByIndex(params: {
  documentId: string;
  chunkIndex: number;
}): Promise<{ ok: true; chunk: LibraryChunk | null } | { ok: false; error: string }> {
  const res = await supabase
    .from('library_chunks')
    .select('id,document_id,chunk_index,start_offset,end_offset,content,summary,created_at')
    .eq('document_id', params.documentId)
    .eq('chunk_index', params.chunkIndex)
    .limit(1);

  if (res.error) return { ok: false, error: res.error.message };
  const first = Array.isArray(res.data) ? (res.data[0] as LibraryChunk | undefined) : undefined;
  return { ok: true, chunk: first ?? null };
}

export async function searchLibraryChunks(params: {
  query: string;
  limit?: number;
}): Promise<{ ok: true; hits: LibraryChunkSearchHit[] } | { ok: false; error: string }> {
  const q = String(params.query || '').trim();
  if (!q) return { ok: true, hits: [] };
  const limit = params.limit ?? 8;

  const like = `%${q}%`;
  const res = await supabase
    .from('library_chunks')
    .select('document_id,chunk_index,start_offset,end_offset,content,summary')
    .or(`content.ilike.${like},summary.ilike.${like}`)
    .limit(limit);

  if (res.error) return { ok: false, error: res.error.message };

  const rows = (res.data as any[]) || [];
  const hits: LibraryChunkSearchHit[] = rows.map((r) => {
    const content = String(r.content || '');
    const idx = content.toLowerCase().indexOf(q.toLowerCase());
    const start = idx >= 0 ? Math.max(0, idx - 180) : 0;
    const end = idx >= 0 ? Math.min(content.length, idx + q.length + 240) : Math.min(content.length, 420);
    const snippet = content ? content.slice(start, end).trim() : String(r.summary || '').slice(0, 420).trim();
    return {
      document_id: String(r.document_id),
      chunk_index: Number(r.chunk_index),
      start_offset: Number(r.start_offset),
      end_offset: Number(r.end_offset),
      summary: r.summary ?? null,
      snippet,
      score: idx >= 0 ? 1 : 0
    };
  });

  hits.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  return { ok: true, hits };
}

export async function downloadLibraryDocumentText(params: {
  documentId: string;
}): Promise<{ ok: true; doc: LibraryDocument; text: string } | { ok: false; error: string }> {
  const docRes = await supabase
    .from('library_documents')
    .select('*')
    .eq('id', params.documentId)
    .single();

  if (docRes.error) return { ok: false, error: docRes.error.message };
  const doc = docRes.data as LibraryDocument;

  const dl = await supabase.storage.from(doc.storage_bucket).download(doc.storage_path);
  if (dl.error) return { ok: false, error: dl.error.message };
  const text = await dl.data.text();

  return { ok: true, doc, text };
}
