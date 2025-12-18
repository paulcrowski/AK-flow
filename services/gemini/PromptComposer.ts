export type PromptBlock = string;

export type PromptComposerOptions = {
  separator?: string;
  maxChars?: number;
};

function clampText(text: string, maxChars?: number): string {
  if (!maxChars || maxChars <= 0) return text;
  const raw = String(text || '');
  if (raw.length <= maxChars) return raw;
  return raw.slice(0, Math.max(0, maxChars - 12)) + '\n[TRUNCATED]';
}

function linesToBlock(lines: Array<string | null | undefined>): string {
  return lines
    .filter((l): l is string => typeof l === 'string')
    .map((l) => l.replace(/\r\n/g, '\n'))
    .join('\n');
}

export const PromptComposer = {
  clampText,

  block(lines: Array<string | null | undefined>, opts?: { maxChars?: number }): PromptBlock {
    return clampText(linesToBlock(lines), opts?.maxChars);
  },

  section(title: string, lines: Array<string | null | undefined>, opts?: { maxChars?: number }): PromptBlock {
    const header = title ? `${title}:` : '';
    const body = linesToBlock(lines);
    const combined = header ? `${header}\n${body}` : body;
    return clampText(combined, opts?.maxChars);
  },

  join(blocks: Array<string | null | undefined>, opts?: PromptComposerOptions): PromptBlock {
    const sep = opts?.separator ?? '\n\n';
    const raw = blocks.filter((b): b is string => typeof b === 'string' && b.trim().length > 0).join(sep);
    return clampText(raw, opts?.maxChars);
  }
};
