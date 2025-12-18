import { supabase } from './supabase';

export interface LibraryDocument {
  id: string;
  user_id: string;
  owner_id?: string | null;
  agent_id?: string | null;
  original_name: string;
  storage_bucket: string;
  storage_path: string;
  mime_type: string;
  byte_size: number;
  doc_type: string;
  status: string;
  created_at: string;
  ingested_at?: string | null;
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
  if (lower.endsWith('.md')) return 'text/markdown';
  if (lower.endsWith('.txt')) return 'text/plain';
  return 'application/octet-stream';
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
    user_id: userEmail,
    owner_id: authUserId,
    agent_id: agentId ?? null,
    original_name: file.name,
    storage_bucket: 'ak_library',
    storage_path,
    mime_type: inferMimeType(file),
    byte_size: file.size,
    doc_type: 'text',
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
