import type { UnifiedContext } from '../../../core/context';

export function formatStyleConstraints(ctx: UnifiedContext): string {
  const prefs = ctx.stylePrefs || {};
  const constraints: string[] = [];

  if (prefs.noEmoji) constraints.push('- NO emojis allowed');
  if (prefs.noExclamation) constraints.push('- NO exclamation marks');
  if (prefs.noCaps) constraints.push('- NO ALL CAPS words');
  if (prefs.formalTone) constraints.push('- Use formal, professional tone');
  if (prefs.maxLength) constraints.push(`- Maximum ${prefs.maxLength} characters`);
  if (prefs.language) constraints.push(`- Speak in ${prefs.language}`);

  return constraints.length === 0 ? '- Follow natural persona style' : constraints.join('\n');
}
