import type { KernelEvent, KernelOutput, KernelReducerResult, KernelState, SocialDynamics, SocialDynamicsPayload } from '../../types';
import { INITIAL_SOCIAL_DYNAMICS } from '../../initialState';
import { SYSTEM_CONFIG } from '../../../config/systemConfig';
import { AgentType, PacketType } from '../../../../types';

export function handleSocialDynamicsUpdate(state: KernelState, event: KernelEvent, outputs: KernelOutput[]): KernelReducerResult {
  const payload = event.payload as SocialDynamicsPayload;
  const current = state.socialDynamics;

  const sdCfg = SYSTEM_CONFIG.socialDynamics;
  const SOCIAL_COST_BASELINE = INITIAL_SOCIAL_DYNAMICS.socialCost;

  let socialCost = current.socialCost;
  let autonomyBudget = current.autonomyBudget;
  let userPresenceScore = current.userPresenceScore;
  let consecutiveWithoutResponse = current.consecutiveWithoutResponse;

  if (payload.agentSpoke) {
    consecutiveWithoutResponse++;
    socialCost += sdCfg.costPerSpeech * consecutiveWithoutResponse;
    autonomyBudget -= sdCfg.budgetPerSpeech;
  }

  if (payload.userResponded) {
    consecutiveWithoutResponse = 0;
    socialCost *= sdCfg.userResponseRelief;
    userPresenceScore = 1.0;
    autonomyBudget = autonomyBudget + sdCfg.userResponseBudgetBoost;
  }

  socialCost = Math.max(SOCIAL_COST_BASELINE, Math.min(1, socialCost));
  autonomyBudget = Math.max(0, Math.min(1, autonomyBudget));
  userPresenceScore = Math.max(0, Math.min(1, userPresenceScore));
  consecutiveWithoutResponse = Math.max(0, Math.floor(consecutiveWithoutResponse));

  const newSocialDynamics: SocialDynamics = {
    socialCost,
    autonomyBudget,
    userPresenceScore,
    consecutiveWithoutResponse
  };

  const nextState = {
    ...state,
    socialDynamics: newSocialDynamics
  };

  if (payload.agentSpoke || payload.userResponded) {
    outputs.push({
      type: 'EVENT_BUS_PUBLISH',
      payload: {
        source: AgentType.CORTEX_FLOW,
        type: PacketType.STATE_UPDATE,
        payload: {
          event: 'SOCIAL_DYNAMICS_UPDATE',
          socialCost: newSocialDynamics.socialCost.toFixed(3),
          autonomyBudget: newSocialDynamics.autonomyBudget.toFixed(3),
          userPresenceScore: newSocialDynamics.userPresenceScore.toFixed(3),
          consecutiveWithoutResponse: newSocialDynamics.consecutiveWithoutResponse
        },
        priority: 0.3
      }
    });
  }

  return { nextState, outputs };
}
