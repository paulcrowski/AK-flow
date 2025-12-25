const LOW_SIGNAL = /^(ok|okej|xd|dzieki|hmm|no|tak|nie|lol)$/i;

export function thalamus(input: string): { store: boolean; salience: number; skipEmbedding: boolean } {
  const s = String(input || '').trim();
  const normalized = s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (LOW_SIGNAL.test(normalized)) return { store: true, salience: 0.1, skipEmbedding: true };
  if (s.length < 4) return { store: false, salience: 0, skipEmbedding: true };
  if (s.length < 20) return { store: true, salience: 0.3, skipEmbedding: false };
  return { store: true, salience: 0.6, skipEmbedding: false };
}
