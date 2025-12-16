/**
 * KernelEngine Reducer
 * 
 * PURE FUNCTION: (state, event) => { nextState, outputs }
 * ZERO side effects. All side effects are returned as outputs.
 * 
 * @module core/kernel/reducer
 */

import type { KernelState, KernelEvent, KernelReducerResult, KernelOutput, ConversationTurn } from './types';
import type { MoodShiftPayload, NeuroUpdatePayload, StateOverridePayload, UserInputPayload, AgentSpokePayload, ToolResultPayload, AddMessagePayload, SocialDynamicsPayload, SocialDynamics } from './types';
import { createInitialKernelState, INITIAL_LIMBIC, INITIAL_SOMA, INITIAL_NEURO, INITIAL_RESONANCE, BASELINE_NEURO, INITIAL_SOCIAL_DYNAMICS } from './initialState';
import * as SomaSystem from '../systems/SomaSystem';
import * as LimbicSystem from '../systems/LimbicSystem';
import * as BiologicalClock from '../systems/BiologicalClock';
import { AgentType, PacketType } from '../../types';
import { SYSTEM_CONFIG } from '../config/systemConfig';

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const MAX_THOUGHT_HISTORY = 20;

// ═══════════════════════════════════════════════════════════════════════════
// MAIN REDUCER
// ═══════════════════════════════════════════════════════════════════════════

export function kernelReducer(state: KernelState, event: KernelEvent): KernelReducerResult {
  const outputs: KernelOutput[] = [];
  
  switch (event.type) {
    case 'TICK':
      return handleTick(state, event, outputs);
      
    case 'USER_INPUT':
      return handleUserInput(state, event, outputs);
      
    case 'AGENT_SPOKE':
      return handleAgentSpoke(state, event, outputs);
      
    case 'TOOL_RESULT':
      return handleToolResult(state, event, outputs);
      
    case 'SLEEP_START':
      return handleSleepStart(state, event, outputs);
      
    case 'SLEEP_END':
      return handleSleepEnd(state, event, outputs);
      
    case 'MOOD_SHIFT':
      return handleMoodShift(state, event, outputs);
      
    case 'NEURO_UPDATE':
      return handleNeuroUpdate(state, event, outputs);
      
    case 'TOGGLE_AUTONOMY':
      return handleToggleAutonomy(state, outputs);
      
    case 'TOGGLE_CHEMISTRY':
      return handleToggleChemistry(state, outputs);
      
    case 'TOGGLE_POETIC':
      return handleTogglePoetic(state, outputs);
      
    case 'GOAL_FORMED':
      return handleGoalFormed(state, event, outputs);
      
    case 'GOAL_COMPLETED':
      return handleGoalCompleted(state, outputs);
      
    case 'THOUGHT_GENERATED':
      return handleThoughtGenerated(state, event, outputs);
      
    case 'HYDRATE':
      return handleHydrate(state, event, outputs);
      
    case 'STATE_OVERRIDE':
      return handleStateOverride(state, event, outputs);
      
    case 'ADD_MESSAGE':
      return handleAddMessage(state, event, outputs);
      
    case 'CLEAR_CONVERSATION':
      return handleClearConversation(state, outputs);
      
    case 'SOCIAL_DYNAMICS_UPDATE':
      return handleSocialDynamicsUpdate(state, event, outputs);
      
    case 'RESET':
      return handleReset(state, outputs);
      
    default:
      // Unknown event - no-op
      return { nextState: state, outputs };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// EVENT HANDLERS (Pure functions)
// ═══════════════════════════════════════════════════════════════════════════

function handleTick(state: KernelState, event: KernelEvent, outputs: KernelOutput[]): KernelReducerResult {
  if (!state.autonomousMode) {
    return { nextState: state, outputs };
  }

  // FAZA 6: SocialDynamics decay happens ONLY here (single source of truth).
  // Compute presence from lastUserInteractionAt (no silenceMs passed from outside).
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
  
  // Calculate metabolic state
  const metabolicResult = SomaSystem.calculateMetabolicState(state.soma, 0);
  let nextState = { ...state, soma: metabolicResult.newState, socialDynamics: nextSocialDynamics };
  let nextTick = BiologicalClock.getDefaultAwakeTick();
  
  // Sleep/Wake transitions
  if (metabolicResult.shouldSleep) {
    outputs.push({
      type: 'EVENT_BUS_PUBLISH',
      payload: {
        source: AgentType.SOMA,
        type: PacketType.SYSTEM_ALERT,
        payload: { msg: "ENERGY CRITICAL. FORCING SLEEP MODE." },
        priority: 1.0
      }
    });
  }
  
  if (metabolicResult.newState.isSleeping) {
    nextTick = BiologicalClock.getDefaultSleepTick();
    
    // LOG: Regeneration Progress
    outputs.push({
      type: 'EVENT_BUS_PUBLISH',
      payload: {
        source: AgentType.SOMA,
        type: PacketType.STATE_UPDATE,
        payload: { 
          status: "REGENERATING", 
          energy: metabolicResult.newState.energy, 
          isSleeping: true 
        },
        priority: 0.1
      }
    });
    
    // Wake up check
    if (metabolicResult.shouldWake) {
      nextTick = BiologicalClock.getWakeTransitionTick();
      outputs.push({
        type: 'EVENT_BUS_PUBLISH',
        payload: {
          source: AgentType.SOMA,
          type: PacketType.SYSTEM_ALERT,
          payload: { msg: "ENERGY RESTORED. WAKING UP." },
          priority: 0.5
        }
      });
      outputs.push({ type: 'WAKE_PROCESS', payload: {} });
    } else {
      // REM Sleep (probabilistic - runtime decides)
      outputs.push({
        type: 'MAYBE_REM_CYCLE',
        payload: { 
          probability: 0.3,
          energy: Math.round(metabolicResult.newState.energy)
        }
      });
      // Dream consolidation (probabilistic - runtime decides)
      outputs.push({ 
        type: 'MAYBE_DREAM_CONSOLIDATION', 
        payload: { probability: 0.5 } 
      });
    }
  }
  
  // Increment RPE counter (ticks since last reward)
  nextState = {
    ...nextState,
    ticksSinceLastReward: nextState.ticksSinceLastReward + 1
  };
  
  // Schedule next tick
  outputs.push({
    type: 'SCHEDULE_TICK',
    payload: { delayMs: nextTick }
  });
  
  return { nextState, outputs };
}

function handleUserInput(state: KernelState, event: KernelEvent, outputs: KernelOutput[]): KernelReducerResult {
  const payload = event.payload as UserInputPayload | undefined;
  const now = event.timestamp;
  
  let nextState = {
    ...state,
    // Reset counters (user spoke = external reward)
    consecutiveAgentSpeeches: 0,
    ticksSinceLastReward: 0,
    lastUserInteractionAt: now,
    silenceStart: now,
    goalState: {
      ...state.goalState,
      lastUserInteractionAt: now
    },
    // FAZA 6: Social Dynamics relief is driven by reducer (caller may still dispatch SOCIAL_DYNAMICS_UPDATE,
    // but this ensures we never miss the userResponded reset).
    socialDynamics: handleSocialDynamicsUpdate(
      state,
      { type: 'SOCIAL_DYNAMICS_UPDATE', timestamp: now, payload: { userResponded: true } } as KernelEvent,
      []
    ).nextState.socialDynamics
  };
  
  // Wake up if sleeping
  if (state.soma.isSleeping) {
    nextState = {
      ...nextState,
      soma: SomaSystem.forceWake(state.soma)
    };
  }
  
  // Update poetic mode based on detected style
  if (payload?.detectedStyle === 'POETIC') {
    nextState = { ...nextState, poeticMode: true };
  } else if (payload?.detectedStyle === 'SIMPLE') {
    nextState = { ...nextState, poeticMode: false };
  }
  
  return { nextState, outputs };
}

function handleAgentSpoke(state: KernelState, event: KernelEvent, outputs: KernelOutput[]): KernelReducerResult {
  const payload = event.payload as AgentSpokePayload | undefined;
  const now = event.timestamp;
  
  let nextState = {
    ...state,
    consecutiveAgentSpeeches: state.consecutiveAgentSpeeches + 1,
    lastSpeakTimestamp: now,
    silenceStart: now
  };
  
  // Add to thought history (bounded)
  if (payload?.text) {
    const newHistory = [...state.thoughtHistory, payload.text];
    if (newHistory.length > MAX_THOUGHT_HISTORY) {
      newHistory.shift();
    }
    nextState = { ...nextState, thoughtHistory: newHistory };
  }
  
  // Publish to EventBus for logging
  outputs.push({
    type: 'EVENT_BUS_PUBLISH',
    payload: {
      source: AgentType.CORTEX_FLOW,
      type: PacketType.THOUGHT_CANDIDATE,
      payload: {
        speech_content: payload?.text,
        voice_pressure: payload?.voicePressure ?? 1.0,
        status: "SPOKEN"
      },
      priority: 0.8
    }
  });
  
  // Log physiology snapshot
  outputs.push({
    type: 'LOG',
    payload: { context: 'SPEECH', state: nextState }
  });
  
  return { nextState, outputs };
}

function handleToolResult(state: KernelState, event: KernelEvent, outputs: KernelOutput[]): KernelReducerResult {
  // Tool result = external reward (reset RPE counter)
  const nextState = {
    ...state,
    ticksSinceLastReward: 0
  };
  
  outputs.push({
    type: 'LOG',
    payload: { 
      message: 'TOOL_REWARD: Tool result received, resetting ticksSinceLastReward' 
    }
  });
  
  return { nextState, outputs };
}

function handleSleepStart(state: KernelState, event: KernelEvent, outputs: KernelOutput[]): KernelReducerResult {
  const nextState = {
    ...state,
    soma: SomaSystem.forceSleep(state.soma),
    neuro: BASELINE_NEURO  // Reset chemistry to baseline
  };
  
  outputs.push({
    type: 'EVENT_BUS_PUBLISH',
    payload: {
      source: AgentType.SOMA,
      type: PacketType.SYSTEM_ALERT,
      payload: {
        event: 'SLEEP_START',
        energy: state.soma.energy,
        limbic: state.limbic,
        neuro: state.neuro,
        message: '🌙 Agent entering sleep mode'
      },
      priority: 0.9
    }
  });
  
  outputs.push({ type: 'DREAM_CONSOLIDATION', payload: {} });
  
  return { nextState, outputs };
}

function handleSleepEnd(state: KernelState, event: KernelEvent, outputs: KernelOutput[]): KernelReducerResult {
  const nextState = {
    ...state,
    soma: SomaSystem.forceWake(state.soma)
  };
  
  outputs.push({
    type: 'EVENT_BUS_PUBLISH',
    payload: {
      source: AgentType.SOMA,
      type: PacketType.SYSTEM_ALERT,
      payload: {
        event: 'SLEEP_END',
        energy: state.soma.energy,
        message: '☀️ Agent is waking up'
      },
      priority: 0.9
    }
  });
  
  outputs.push({ type: 'WAKE_PROCESS', payload: {} });
  
  return { nextState, outputs };
}

function handleMoodShift(state: KernelState, event: KernelEvent, outputs: KernelOutput[]): KernelReducerResult {
  const payload = event.payload as MoodShiftPayload | undefined;
  if (!payload?.delta) {
    return { nextState: state, outputs };
  }
  
  // LimbicSystem.applyMoodShift expects { fear_delta?, curiosity_delta? }
  const nextState = {
    ...state,
    limbic: LimbicSystem.applyMoodShift(state.limbic, payload.delta)
  };
  
  return { nextState, outputs };
}

function handleNeuroUpdate(state: KernelState, event: KernelEvent, outputs: KernelOutput[]): KernelReducerResult {
  const payload = event.payload as NeuroUpdatePayload | undefined;
  if (!payload?.delta) {
    return { nextState: state, outputs };
  }
  
  const clamp = (v: number) => Math.max(0, Math.min(100, v));
  
  const nextState = {
    ...state,
    neuro: {
      dopamine: clamp(state.neuro.dopamine + (payload.delta.dopamine ?? 0)),
      serotonin: clamp(state.neuro.serotonin + (payload.delta.serotonin ?? 0)),
      norepinephrine: clamp(state.neuro.norepinephrine + (payload.delta.norepinephrine ?? 0))
    }
  };
  
  if (payload.reason) {
    outputs.push({
      type: 'LOG',
      payload: { message: `NEURO_UPDATE: ${payload.reason}`, delta: payload.delta }
    });
  }
  
  return { nextState, outputs };
}

function handleToggleAutonomy(state: KernelState, outputs: KernelOutput[]): KernelReducerResult {
  const nextState = {
    ...state,
    autonomousMode: !state.autonomousMode,
    silenceStart: Date.now()
  };
  
  return { nextState, outputs };
}

function handleToggleChemistry(state: KernelState, outputs: KernelOutput[]): KernelReducerResult {
  return {
    nextState: { ...state, chemistryEnabled: !state.chemistryEnabled },
    outputs
  };
}

function handleTogglePoetic(state: KernelState, outputs: KernelOutput[]): KernelReducerResult {
  return {
    nextState: { ...state, poeticMode: !state.poeticMode },
    outputs
  };
}

function handleStateOverride(state: KernelState, event: KernelEvent, outputs: KernelOutput[]): KernelReducerResult {
  const payload = event.payload as StateOverridePayload | undefined;
  if (!payload) {
    return { nextState: state, outputs };
  }
  
  let nextState = { ...state };
  
  if (payload.target === 'limbic') {
    nextState = {
      ...nextState,
      limbic: {
        ...nextState.limbic,
        [payload.key]: Math.max(0, Math.min(1, payload.value))
      }
    };
  } else if (payload.target === 'soma') {
    nextState = {
      ...nextState,
      soma: {
        ...nextState.soma,
        [payload.key]: Math.max(0, Math.min(100, payload.value))
      }
    };
  } else if (payload.target === 'neuro') {
    nextState = {
      ...nextState,
      neuro: {
        ...nextState.neuro,
        [payload.key]: Math.max(0, Math.min(100, payload.value))
      }
    };
  }
  
  return { nextState, outputs };
}

function handleReset(state: KernelState, outputs: KernelOutput[]): KernelReducerResult {
  const nextState = createInitialKernelState({
    traitVector: state.traitVector  // Preserve personality
  });
  
  outputs.push({
    type: 'LOG',
    payload: { message: 'KERNEL RESET - Full State Reset' }
  });
  
  return { nextState, outputs };
}

// ═══════════════════════════════════════════════════════════════════════════
// GOAL HANDLERS
// ═══════════════════════════════════════════════════════════════════════════

function handleGoalFormed(state: KernelState, event: KernelEvent, outputs: KernelOutput[]): KernelReducerResult {
  const payload = event.payload as { goal: string; priority: number } | undefined;
  if (!payload?.goal) {
    return { nextState: state, outputs };
  }
  
  // Create proper Goal object
  const newGoal = {
    id: `goal_${event.timestamp}`,
    description: payload.goal,
    priority: payload.priority ?? 0.5,
    progress: 0,
    source: 'user' as const,
    createdAt: event.timestamp
  };
  
  const nextState = {
    ...state,
    goalState: {
      ...state.goalState,
      activeGoal: newGoal,
      goalsFormedTimestamps: [
        ...state.goalState.goalsFormedTimestamps.slice(-9),
        event.timestamp
      ],
      lastGoals: [
        ...state.goalState.lastGoals.slice(-4),
        { description: payload.goal, timestamp: event.timestamp, source: 'kernel' }
      ]
    }
  };
  
  outputs.push({
    type: 'LOG',
    payload: { message: `GOAL FORMED: ${payload.goal}` }
  });
  
  return { nextState, outputs };
}

function handleGoalCompleted(state: KernelState, outputs: KernelOutput[]): KernelReducerResult {
  const completedGoal = state.goalState.activeGoal;
  
  const nextState = {
    ...state,
    goalState: {
      ...state.goalState,
      activeGoal: null
    }
  };
  
  if (completedGoal) {
    outputs.push({
      type: 'LOG',
      payload: { message: `GOAL COMPLETED: ${completedGoal}` }
    });
  }
  
  return { nextState, outputs };
}

// ═══════════════════════════════════════════════════════════════════════════
// THOUGHT & HYDRATE HANDLERS
// ═══════════════════════════════════════════════════════════════════════════

function handleThoughtGenerated(state: KernelState, event: KernelEvent, outputs: KernelOutput[]): KernelReducerResult {
  const payload = event.payload as { thought: string } | undefined;
  if (!payload?.thought) {
    return { nextState: state, outputs };
  }
  
  // Add to thought history (bounded)
  const newHistory = [...state.thoughtHistory, payload.thought];
  if (newHistory.length > MAX_THOUGHT_HISTORY) {
    newHistory.shift();
  }
  
  return {
    nextState: {
      ...state,
      thoughtHistory: newHistory
    },
    outputs
  };
}

function handleHydrate(state: KernelState, event: KernelEvent, outputs: KernelOutput[]): KernelReducerResult {
  const payload = event.payload as { state: Partial<KernelState> } | undefined;
  if (!payload?.state) {
    return { nextState: state, outputs };
  }
  
  // Merge hydrated state with current, preserving structure
  const nextState = {
    ...state,
    ...payload.state,
    // Deep merge for nested objects
    limbic: { ...state.limbic, ...payload.state.limbic },
    soma: { ...state.soma, ...payload.state.soma },
    neuro: { ...state.neuro, ...payload.state.neuro },
    goalState: { ...state.goalState, ...payload.state.goalState },
    resonance: { ...state.resonance, ...payload.state.resonance },
  };
  
  outputs.push({
    type: 'LOG',
    payload: { message: 'STATE HYDRATED' }
  });
  
  return { nextState, outputs };
}

// ═══════════════════════════════════════════════════════════════════════════
// CONVERSATION HANDLERS
// ═══════════════════════════════════════════════════════════════════════════

const MAX_CONVERSATION_TURNS = 50;

function handleAddMessage(state: KernelState, event: KernelEvent, outputs: KernelOutput[]): KernelReducerResult {
  const payload = event.payload as AddMessagePayload | undefined;
  if (!payload?.text) {
    return { nextState: state, outputs };
  }
  
  const newTurn: ConversationTurn = {
    role: payload.role,
    text: payload.text,
    type: payload.type || 'speech',
    timestamp: event.timestamp,
    imageData: payload.imageData,
    sources: payload.sources
  };
  
  // Add to conversation (bounded)
  let newConversation = [...state.conversation, newTurn];
  if (newConversation.length > MAX_CONVERSATION_TURNS) {
    newConversation = newConversation.slice(-MAX_CONVERSATION_TURNS);
  }
  
  const nextState = {
    ...state,
    conversation: newConversation,
    silenceStart: event.timestamp
  };
  
  return { nextState, outputs };
}

function handleClearConversation(state: KernelState, outputs: KernelOutput[]): KernelReducerResult {
  const nextState = {
    ...state,
    conversation: []
  };
  
  outputs.push({
    type: 'LOG',
    payload: { message: 'CONVERSATION CLEARED' }
  });
  
  return { nextState, outputs };
}

// ═══════════════════════════════════════════════════════════════════════════
// SOCIAL DYNAMICS HANDLER (Soft Homeostasis)
// ═══════════════════════════════════════════════════════════════════════════

function handleSocialDynamicsUpdate(state: KernelState, event: KernelEvent, outputs: KernelOutput[]): KernelReducerResult {
  const payload = event.payload as SocialDynamicsPayload;
  const current = state.socialDynamics;

  const sdCfg = SYSTEM_CONFIG.socialDynamics;
  const SOCIAL_COST_BASELINE = INITIAL_SOCIAL_DYNAMICS.socialCost;
  
  let socialCost = current.socialCost;
  let autonomyBudget = current.autonomyBudget;
  let userPresenceScore = current.userPresenceScore;
  let consecutiveWithoutResponse = current.consecutiveWithoutResponse;
  
  // Agent spoke: increase cost, spend budget, track consecutive
  if (payload.agentSpoke) {
    consecutiveWithoutResponse++;
    socialCost += sdCfg.costPerSpeech * consecutiveWithoutResponse; // Escalating cost
    autonomyBudget -= sdCfg.budgetPerSpeech;
  }
  
  // User responded: reset consecutive, halve cost, boost presence
  if (payload.userResponded) {
    consecutiveWithoutResponse = 0;
    socialCost *= sdCfg.userResponseRelief;           // Significant relief
    userPresenceScore = 1.0;                         // Full presence
    autonomyBudget = autonomyBudget + sdCfg.userResponseBudgetBoost; // Budget boost
  }

  // Clamp / finalize
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
  
  // Log significant changes
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
