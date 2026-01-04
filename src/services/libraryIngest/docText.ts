import { CortexService } from '../../llm/gemini';
import { supabase } from '../supabase';
import type { LibraryDocument } from '../LibraryService';

function normalizeNewlines(text: string): string {
  return String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

export function isMarkdownDoc(doc: LibraryDocument): boolean {
  const name = (doc.original_name || '').toLowerCase();
  const mime = (doc.mime_type || '').toLowerCase();
  return name.endsWith('.md') || mime.includes('markdown');
}

export function isJsonDoc(doc: LibraryDocument): boolean {
  const name = (doc.original_name || '').toLowerCase();
  const mime = (doc.mime_type || '').toLowerCase();
  return name.endsWith('.json') || mime.includes('application/json') || mime.endsWith('+json');
}

export function isImageDoc(doc: LibraryDocument): boolean {
  const name = (doc.original_name || '').toLowerCase();
  const mime = (doc.mime_type || '').toLowerCase();
  return (
    doc.doc_type === 'image' ||
    mime.startsWith('image/') ||
    name.endsWith('.png') ||
    name.endsWith('.jpg') ||
    name.endsWith('.jpeg') ||
    name.endsWith('.webp')
  );
}

export function inferImageHint(name: string): 'chart' | 'document' | 'auto' {
  const lower = String(name || '').toLowerCase();
  if (/(chart|diagram|plot|wykres|graf)/.test(lower)) return 'chart';
  if (/(scan|document|doc|report|invoice|page|strona|raport|faktura)/.test(lower)) return 'document';
  return 'auto';
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  if (typeof FileReader === 'undefined') {
    const buffer = await blob.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    if (typeof btoa !== 'function') throw new Error('btoa_unavailable');
    const base64 = btoa(binary);
    const mime = blob.type || 'application/octet-stream';
    return `data:${mime};base64,${base64}`;
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      if (!result) {
        reject(new Error('dataurl_empty'));
        return;
      }
      resolve(result);
    };
    reader.onerror = () => reject(new Error('dataurl_failed'));
    reader.readAsDataURL(blob);
  });
}

export async function downloadDocumentText(doc: LibraryDocument): Promise<string> {
  const dl = await supabase.storage.from(doc.storage_bucket).download(doc.storage_path);
  if (dl.error) throw new Error(dl.error.message);

  if (isImageDoc(doc)) {
    const base64Data = await blobToDataUrl(dl.data);
    const hint = inferImageHint(doc.original_name);
    const mimeType = doc.mime_type || 'image/jpeg';
    const ocr = await CortexService.extractTextFromImage(base64Data, mimeType, hint);
    if (!ocr.ok) throw new Error(ocr.error || 'OCR_FAILED');
    return normalizeNewlines(ocr.text);
  }

  const raw = normalizeNewlines(await dl.data.text());
  if (isJsonDoc(doc)) {
    try {
      if (raw.length <= 2_000_000) {
        const parsed = JSON.parse(raw);
        return normalizeNewlines(JSON.stringify(parsed, null, 2));
      }
    } catch {
      return raw;
    }
  }
  return raw;
}
