import type { UnifiedContext } from '../../../core/context';
import { PromptComposer } from '../PromptComposer';

export function buildIdentityBlock(ctx: UnifiedContext): string {
  const basePersona = ctx.basePersona;
  return PromptComposer.section('IDENTITY', [
    `- Name: ${basePersona.name}`,
    `- Persona: ${basePersona.persona}`,
    `- Core Values: ${basePersona.coreValues.join(', ')}`
  ]);
}
