import type { KernelEvent, KernelOutput, KernelReducerResult, KernelState, SocialDynamics } from '../../types';
import { INITIAL_SOCIAL_DYNAMICS } from '../../initialState';
import { SYSTEM_CONFIG } from '../../../config/systemConfig';
import * as SomaSystem from '../../../systems/SomaSystem';
import * as BiologicalClock from '../../../systems/BiologicalClock';
import { AgentType, PacketType } from '../../../../types';

export function handleTick(state: KernelState, event: KernelEvent, outputs: KernelOutput[]): KernelReducerResult {
  if (!state.autonomousMode) {
    return { nextState: state, outputs };
  }

  const sdCfg = SYSTEM_CONFIG.socialDynamics;
  const SOCIAL_COST_BASELINE = INITIAL_SOCIAL_DYNAMICS.socialCost;
  const now = event.timestamp;
  const silenceMs = Math.max(0, now - state.lastUserInteractionAt);
  const userPresenceScore = Math.max(0, Math.min(1, 1 - silenceMs / sdCfg.presenceDecayTimeMs));
  const decayRate = userPresenceScore > 0.5 ? sdCfg.decayRateUserPresent : sdCfg.decayRateUserAbsent;
  const socialCost = Math.max(
    SOCIAL_COST_BASELINE,
    SOCIAL_COST_BASELINE + (state.socialDynamics.socialCost - SOCIAL_COST_BASELINE) * decayRate
  );
  const autonomyBudget = Math.min(1, state.socialDynamics.autonomyBudget + sdCfg.budgetRegenPerTick);
  const nextSocialDynamics: SocialDynamics = {
    ...state.socialDynamics,
    socialCost: Math.min(1, socialCost),
    autonomyBudget: Math.max(0, autonomyBudget),
    userPresenceScore,
    consecutiveWithoutResponse: Math.max(0, Math.floor(state.socialDynamics.consecutiveWithoutResponse))
  };

  const metabolicResult = SomaSystem.calculateMetabolicState(state.soma, 0);
  let nextState = { ...state, soma: metabolicResult.newState, socialDynamics: nextSocialDynamics };
  let nextTick = BiologicalClock.getDefaultAwakeTick();

  if (metabolicResult.shouldSleep) {
    outputs.push({
      type: 'EVENT_BUS_PUBLISH',
      payload: {
        source: AgentType.SOMA,
        type: PacketType.SYSTEM_ALERT,
        payload: { msg: 'ENERGY CRITICAL. FORCING SLEEP MODE.' },
        priority: 1.0
      }
    });
  }

  if (metabolicResult.newState.isSleeping) {
    nextTick = BiologicalClock.getDefaultSleepTick();

    outputs.push({
      type: 'EVENT_BUS_PUBLISH',
      payload: {
        source: AgentType.SOMA,
        type: PacketType.STATE_UPDATE,
        payload: {
          status: 'REGENERATING',
          energy: metabolicResult.newState.energy,
          isSleeping: true
        },
        priority: 0.1
      }
    });

    if (metabolicResult.shouldWake) {
      nextTick = BiologicalClock.getWakeTransitionTick();
      outputs.push({
        type: 'EVENT_BUS_PUBLISH',
        payload: {
          source: AgentType.SOMA,
          type: PacketType.SYSTEM_ALERT,
          payload: { msg: 'ENERGY RESTORED. WAKING UP.' },
          priority: 0.5
        }
      });
      outputs.push({ type: 'WAKE_PROCESS', payload: {} });
    } else {
      outputs.push({
        type: 'MAYBE_REM_CYCLE',
        payload: {
          probability: 0.3,
          energy: Math.round(metabolicResult.newState.energy)
        }
      });
      outputs.push({
        type: 'MAYBE_DREAM_CONSOLIDATION',
        payload: { probability: 0.5 }
      });
    }
  }

  nextState = {
    ...nextState,
    ticksSinceLastReward: nextState.ticksSinceLastReward + 1
  };

  outputs.push({
    type: 'SCHEDULE_TICK',
    payload: { delayMs: nextTick }
  });

  return { nextState, outputs };
}
