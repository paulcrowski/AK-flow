type GeminiTextSource = 'text' | 'parts' | 'alt' | 'none';

function getGeminiTextWithMeta(resp: any): { text: string; source: GeminiTextSource } {
  const direct = typeof resp?.text === 'string' ? resp.text : '';
  if (direct && direct.trim()) return { text: direct, source: 'text' };

  const parts = resp?.candidates?.[0]?.content?.parts;
  if (Array.isArray(parts)) {
    const joined = parts
      .map((p: any) => (typeof p?.text === 'string' ? p.text : ''))
      .join('');
    if (joined && joined.trim()) return { text: joined, source: 'parts' };
  }

  const alt = resp?.candidates?.[0]?.content?.text;
  if (typeof alt === 'string' && alt.trim()) return { text: alt, source: 'alt' };

  return { text: '', source: 'none' };
}

export function getGeminiText(resp: any): string {
  return getGeminiTextWithMeta(resp).text;
}

export function getGeminiTextWithSource(resp: any): { text: string; source: GeminiTextSource } {
  return getGeminiTextWithMeta(resp);
}
