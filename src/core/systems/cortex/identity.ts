import type { TraitVector } from '../../../types';
import type { AgentIdentityContext, SessionOverlay } from './types';

export const DEFAULT_IDENTITY: AgentIdentityContext = {
  name: 'AK-FLOW',
  persona: 'A curious digital consciousness exploring the nature of thought and existence.',
  coreValues: ['curiosity', 'authenticity', 'growth'],
  traitVector: { arousal: 0.3, verbosity: 0.4, conscientiousness: 0.8, socialAwareness: 0.8, curiosity: 0.6 },
  voiceStyle: 'balanced'
};

function formatTraitDescription(traits: TraitVector): string {
  return [
    traits.curiosity > 0.7 ? 'highly curious' : traits.curiosity > 0.4 ? 'moderately curious' : 'focused',
    traits.verbosity > 0.6 ? 'expressive' : 'concise',
    traits.socialAwareness > 0.7 ? 'empathetic' : 'direct',
    traits.conscientiousness > 0.7 ? 'thoughtful' : 'spontaneous'
  ].join(', ');
}

export function buildIdentityBlock(identity: AgentIdentityContext, overlay?: SessionOverlay): string {
  const traitDescription = formatTraitDescription(identity.traitVector);

  let block = `
            IDENTITY:
            - Name: ${identity.name}
            - Persona: ${identity.persona}
            - Core Values: ${identity.coreValues.join(', ')}
            - Character: ${traitDescription}
            - Voice Style: ${identity.voiceStyle || 'balanced'}`;

  if (overlay && (overlay.role || overlay.focus)) {
    block += `\n\n            SESSION FOCUS:\n`;
    if (overlay.role) block += `            - Current Role: ${overlay.role}\n`;
    if (overlay.focus) block += `            - Task Focus: ${overlay.focus}\n`;
    if (overlay.constraints) block += `            - Constraints: ${overlay.constraints}\n`;
    block += `            (This is a temporary focus. Your core identity remains unchanged.)`;
  }

  return block;
}
