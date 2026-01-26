import type { Focus } from '../../kernel/types';
import { normalizeRoutingInput } from '../../../tools/toolRouting';

type LibraryResolution =
  | { resolved: true; docId: string }
  | { resolved: false; reason: string };

const LIBRARY_REFERENCE_PATTERNS = [
  /z\s*tej\s*ksiazki/i,
  /tej\s*ksiazki/i,
  /w\s*niej/i,
  /z\s*niej/i,
  /ta\s*ksiazk[ae]/i,
  /this\s*book/i,
  /from\s*it/i
];

export function resolveLibraryReference(
  state: { focus?: Focus | null },
  input: string
): LibraryResolution {
  const normalized = normalizeRoutingInput(input);
  const hasReference = LIBRARY_REFERENCE_PATTERNS.some((pattern) => pattern.test(normalized));

  if (!hasReference) {
    return { resolved: false, reason: 'NO_REFERENCE_PATTERN' };
  }

  if (state.focus?.domain === 'LIBRARY' && state.focus.id) {
    return { resolved: true, docId: state.focus.id };
  }

  return { resolved: false, reason: 'NO_LIBRARY_FOCUS' };
}
