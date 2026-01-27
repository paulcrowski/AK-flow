import { SYSTEM_CONFIG } from '../../core/config/systemConfig';
import type { WorldDirEntry } from './types';

export const FILE_PREVIEW_LIMIT = Math.max(
  0,
  Math.floor(SYSTEM_CONFIG.eventLoop?.fileContentPreviewLimit ?? 8000)
);

const hashText = (input: string) => {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
};

export const buildFileEvidence = (content: string) => ({
  length: content.length,
  hash: hashText(content),
  preview: content.slice(0, FILE_PREVIEW_LIMIT)
});

export const formatDirEntryName = (entry: WorldDirEntry) =>
  entry.type === 'dir' ? `${entry.name}/` : entry.name;
