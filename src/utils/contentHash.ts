export async function contentHash(agentId: string, content: string): Promise<string> {
  const normalized = String(content || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const data = new TextEncoder().encode(`${agentId}:${normalized}`);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}
