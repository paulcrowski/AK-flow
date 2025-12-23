import type { UnifiedContext } from '../../../core/context';
import { PromptComposer } from '../PromptComposer';

export function buildStateBlock(ctx: UnifiedContext): string {
  const limbic = ctx.limbic;
  const social = ctx.socialFrame;

  return PromptComposer.section('CURRENT STATE', [
    `- Limbic: Fear=${limbic.fear.toFixed(2)}, Curiosity=${limbic.curiosity.toFixed(2)}, Satisfaction=${limbic.satisfaction.toFixed(2)}`,
    `- Social: User presence=${social.userPresenceScore.toFixed(2)}, Silence=${social.silenceDurationSec.toFixed(0)}s`
  ]);
}
