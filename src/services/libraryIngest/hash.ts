function stableHex32(input: string): string {
  const s = String(input || '');
  let h1 = 0x811c9dc5;
  let h2 = 0x811c9dc5;
  let h3 = 0x811c9dc5;
  let h4 = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 ^= c;
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= c;
    h2 = Math.imul(h2, 0x01000197);
    h3 ^= c;
    h3 = Math.imul(h3, 0x0100019b);
    h4 ^= c;
    h4 = Math.imul(h4, 0x010001a1);
  }
  const to8 = (n: number) => (n >>> 0).toString(16).padStart(8, '0');
  return `${to8(h1)}${to8(h2)}${to8(h3)}${to8(h4)}`;
}

export function stableUuidLike(input: string): string {
  const hex = stableHex32(input);
  const a = hex.slice(0, 8);
  const b = hex.slice(8, 12);
  const c = `4${hex.slice(13, 16)}`;
  const d = `a${hex.slice(17, 20)}`;
  const e = hex.slice(20, 32);
  return `${a}-${b}-${c}-${d}-${e}`;
}
