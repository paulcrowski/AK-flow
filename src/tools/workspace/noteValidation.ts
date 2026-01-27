import { normalizePath } from '../../core/systems/WorldAccess';

export const validateNoteFormat = (content: string): boolean => {
  const hasClaim = /^claim:/mi.test(content);
  const hasEvidence = /^evidence:/mi.test(content);
  const hasNext = /^next:/mi.test(content);
  return hasClaim && hasEvidence && hasNext;
};

export const shouldValidateNote = (resolvedPath: string): boolean => {
  const norm = normalizePath(resolvedPath);
  return norm.includes('/notes/');
};
