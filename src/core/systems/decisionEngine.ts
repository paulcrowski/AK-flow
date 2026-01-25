import type { KernelState } from '../kernel/types';

export function inputContainsExplicitId(input: string): boolean {
  const patterns = [
    /\bdocId\s*[=:]\s*[\w-]+/i,
    /\bid\s*[=:]\s*[\w-]+/i,
    /\/[\w\/.-]+/,
    /[0-9a-f]{8}-[0-9a-f]{4}-/i
  ];
  return patterns.some((pattern) => pattern.test(input));
}

export function shouldAskUser(state: Pick<KernelState, 'focus'>, input: string): boolean {
  if (state.focus?.domain !== null || state.focus?.id !== null) {
    return false;
  }

  if (inputContainsExplicitId(input)) {
    return false;
  }

  return true;
}
