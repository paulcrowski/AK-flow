const artifactNameById = new Map<string, string>();

export function rememberArtifactName(id: string, name?: string | null): string | null {
  const key = String(id || '').trim();
  const value = String(name || '').trim();
  if (!key || !value) return value || null;
  artifactNameById.set(key, value);
  return value;
}

export function getRememberedArtifactName(id: string): string | null {
  const key = String(id || '').trim();
  if (!key) return null;
  return artifactNameById.get(key) ?? null;
}
