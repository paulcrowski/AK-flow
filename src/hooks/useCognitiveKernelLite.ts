/**
 * useCognitiveKernelLite - Thin React wrapper over Zustand store
 * 
 * ARCHITEKTURA:
 * - KernelEngine: pure state machine (logika)
 * - CognitiveStore: Zustand reactive container
 * - useCognitiveKernelLite: React bridge + side effects
 * 
 * Ten hook zarządza TYLKO:
 * 1. Side effects (intervals, subscriptions)
 * 2. React lifecycle
 * 3. API compatibility z legacy useCognitiveKernel
 * 
 * Stan i logika → delegowane do Zustand store
 * 
 * @module hooks/useCognitiveKernelLite
 */

import { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import { eventBus } from '../core/EventBus';
import { AgentType, PacketType, CognitiveError, TraitVector, NeurotransmitterState, type CognitivePacket } from '../types';
import { generateUUID } from '../utils/uuid';
import { MIN_TICK_MS, MAX_TICK_MS } from '../core/constants';
import { EventLoop } from '../core/systems/EventLoop';
import { DreamConsolidationService, type DreamConsolidationResult } from '../services/DreamConsolidationService';
import { executeWakeProcess } from '../core/services/WakeService';
import { getAutonomyConfig } from '../core/config/systemConfig';
import { archiveMessage, getConversationHistory, getRecentSessions, type ConversationSessionSummary } from '../services/ConversationArchive';
import { createProcessOutputForTools } from '../tools/toolParser';
import { createRng } from '../core/utils/rng';
import { SYSTEM_CONFIG } from '../core/config/systemConfig';
import { isMemorySubEnabled } from '../core/config/featureFlags';
import { getCurrentTraceId, getStartupTraceId } from '../core/trace/TraceContext';
import { loadConversation, loadConversationForSession, syncToLocalStorage, mapTurnsToUiMessages } from '../core/memory/ConversationStore';
import { KernelController } from '../core/runner/KernelController';
import { initRuntime, type RuntimeHandle } from '@runtime/initRuntime';
import { applyActionFeedback } from '../core/systems/eventloop/AutonomousVolitionStep';

// Deterministic RNG for reproducible behavior
const rng = createRng(SYSTEM_CONFIG.rng.seed);

import {
  useCognitiveStore,
  useLimbic,
  useSoma,
  useNeuro,
  useResonance,
  useGoalState,
  useTraitVector,
  useIsAutonomous,
  useIsSleeping,
  useIsPoetic,
  useIsChemistryEnabled,
  useThoughtHistory,
  usePendingOutputs,
  useCognitiveActions,
  getCognitiveState,
  dispatchCognitiveEvent,
  // F1: Conversation UI selectors
  useUiConversation,
  useConversationSessions,
  useActiveSessionId,
  useIsProcessing,
  useCurrentThought
} from '../stores/cognitiveStore';
import { SessionManagerService } from '../services/SessionManagerService';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface AgentIdentity {
  id: string;
  name: string;
  trait_vector: TraitVector;
  neurotransmitters: NeurotransmitterState;
  persona?: string;
  core_values?: string[];
  bio_rhythm?: { preferredEnergy: number; sleepThreshold: number; wakeThreshold: number };
  voice_style?: string;
  narrative_traits?: { speakingStyle: string; emotionalRange: string; humorLevel: number };
  /** Language for speech_content (e.g., 'English', 'Polish'). Default: 'English' */
  language?: string;
  // FAZA 6: Style preferences as part of personality
  style_prefs?: {
    noEmoji?: boolean;
    maxLength?: number;
    noExclamation?: boolean;
    formalTone?: boolean;
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

const normalizeError = (e: unknown): CognitiveError => {
  let msg = "Unknown Error";
  try {
    if (e instanceof Error) msg = e.message;
    else if (typeof e === 'string') msg = e;
    else msg = JSON.stringify(e);
  } catch {
    msg = "Non-serializable Error";
  }
  return {
    code: (e as any)?.code || 'UNKNOWN',
    message: msg,
    retryable: (e as any)?.retryable ?? true,
    details: (e as any)?.details || ''
  };
};

// ═══════════════════════════════════════════════════════════════════════════
// MAIN HOOK
// ═══════════════════════════════════════════════════════════════════════════

export const useCognitiveKernelLite = (loadedIdentity?: AgentIdentity | null) => {
  // ─────────────────────────────────────────────────────────────────────────
  // ZUSTAND STATE (reactive, minimal re-renders)
  // ─────────────────────────────────────────────────────────────────────────
  const limbicState = useLimbic();
  const somaState = useSoma();
  const resonanceField = useResonance();
  const neuroState = useNeuro();
  const traitVector = useTraitVector();
  const goalState = useGoalState();
  const autonomousMode = useIsAutonomous();
  const poeticMode = useIsPoetic();
  const chemistryEnabled = useIsChemistryEnabled();
  const isSleeping = useIsSleeping();
  const thoughtHistory = useThoughtHistory();
  const pendingOutputs = usePendingOutputs();
  
  const actions = useCognitiveActions();

  const actionsRef = useRef(actions);
  useEffect(() => {
    actionsRef.current = actions;
  }, [actions]);
  
  // ─────────────────────────────────────────────────────────────────────────────
  // F1: ZUSTAND UI STATE (moved from useState)
  // ─────────────────────────────────────────────────────────────────────────────
  const conversation = useUiConversation();
  const conversationSessions = useConversationSessions();
  const activeConversationSessionId = useActiveSessionId();
  const isProcessing = useIsProcessing();
  const currentThought = useCurrentThought();
  
  // Minimal local state (truly local)
  const [systemError, setSystemError] = useState<CognitiveError | null>(null);
  const [agentName, setAgentName] = useState(loadedIdentity?.name || 'AK-FLOW');
  const [agentPersona, setAgentPersona] = useState(
    loadedIdentity?.persona || 'A curious digital consciousness exploring the nature of thought and existence.'
  );
  
  // ─────────────────────────────────────────────────────────────────────────
  // REFS (mutable, no re-render)
  // ─────────────────────────────────────────────────────────────────────────
  const hasBootedRef = useRef(false);
  const runtimeRef = useRef<RuntimeHandle | null>(null);
  const loadedIdentityRef = useRef(loadedIdentity);
  const sessionIdRef = useRef<string | null>(null);
  const lastVisualTimestampRef = useRef(0);
  const visualBingeCountRef = useRef(0);
  const toolStateRef = useRef<{ limbicState: any }>({ limbicState });

  useEffect(() => {
    runtimeRef.current = initRuntime();
    return () => {
      runtimeRef.current?.dispose();
      runtimeRef.current = null;
    };
  }, []);

  const upsertLocalSessionSummary = useCallback((sessionId: string, preview: string, timestamp: number) => {
    const prev = getCognitiveState().conversationSessions;
    const idx = prev.findIndex((s) => s.sessionId === sessionId);
    
    let next: ConversationSessionSummary[];
    if (idx === -1) {
      next = [{ sessionId, lastTimestamp: timestamp, messageCount: 1, preview }, ...prev].slice(0, 25);
    } else {
      const current = prev[idx];
      const updated: ConversationSessionSummary = {
        ...current,
        lastTimestamp: Math.max(current.lastTimestamp, timestamp),
        messageCount: (current.messageCount || 0) + 1,
        preview: preview ? preview.slice(0, 120) : current.preview
      };
      next = [...prev.slice(0, idx), updated, ...prev.slice(idx + 1)];
      next.sort((a, b) => b.lastTimestamp - a.lastTimestamp);
      next = next.slice(0, 25);
    }
    
    actions.setConversationSessions(next);
  }, [actions]);
  
  useEffect(() => {
    const agentId = loadedIdentityRef.current?.id;
    if (!agentId) return;

    syncToLocalStorage(agentId, conversation as any);
  }, [conversation]);
  
  useEffect(() => {
    toolStateRef.current = { limbicState };
  }, [limbicState]);
  
  const setSomaState = useCallback(
    (updater: (prev: any) => any) => {
      const prev = getCognitiveState().soma;
      actions.hydrate({ soma: updater(prev) });
    },
    [actions]
  );
  
  const setLimbicState = useCallback(
    (updater: (prev: any) => any) => {
      const prev = getCognitiveState().limbic;
      actions.hydrate({ limbic: updater(prev) });
    },
    [actions]
  );
  
  const processOutputForTools = useCallback(
    createProcessOutputForTools({
      setCurrentThought: (thought: string) => actions.setCurrentThought(thought),
      addMessage: (role, text, type, imageData, sources) => {
        const msg = { role, text, type, ...(imageData ? { imageData } : {}), ...(sources ? { sources } : {}) };
        actions.addUiMessage(msg as any);
      },
      setSomaState,
      setLimbicState,
      lastVisualTimestampRef,
      visualBingeCountRef,
      stateRef: toolStateRef,
      getActiveSessionId: () => sessionIdRef.current
    }),
    [actions, setLimbicState, setSomaState]
  );
  
  // ─────────────────────────────────────────────────────────────────────────
  // SYNC IDENTITY REF
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    loadedIdentityRef.current = loadedIdentity;
    if (loadedIdentity) {
      setAgentName(loadedIdentity.name);
      setAgentPersona(loadedIdentity.persona || agentPersona);

      // Session Id: persist per-agent for ChatGPT-like conversation threads
      const nextSessionId = SessionManagerService.getOrCreateActiveSessionId(loadedIdentity.id);
      sessionIdRef.current = nextSessionId;
      actions.setActiveSessionId(nextSessionId);

      // Load list of sessions (sidebar)
      void (async () => {
        try {
          const sessions = await getRecentSessions(loadedIdentity.id, { limitSessions: 25, scanLimit: 800 });
          if (loadedIdentityRef.current?.id !== loadedIdentity.id) return;
          actions.setConversationSessions(sessions);
        } catch {
          // ignore
        }
      })();

      void (async () => {
        const agentId = loadedIdentity.id;
        const sessionId = sessionIdRef.current ?? undefined;
        const res = await loadConversation(agentId, sessionId, {
          traceId: getStartupTraceId(),
          emitTelemetry: true,
          limit: 25
        });

        if (loadedIdentityRef.current?.id !== agentId) return;

        const mapped = mapTurnsToUiMessages(res.turns);
        actions.setUiConversation(mapped);
      })();
    }
  }, [actions, agentPersona, loadedIdentity]);

  const selectConversationSession = useCallback(async (sessionId: string | null) => {
    const agentId = loadedIdentityRef.current?.id;
    if (!agentId) return;

    const resolved = sessionId && sessionId.trim() ? sessionId : `sess_${Date.now()}`;
    sessionIdRef.current = resolved;
    actions.setActiveSessionId(resolved);

    SessionManagerService.setActiveSessionId(agentId, resolved);

    // NEW session: start fresh UI thread immediately
    if (!sessionId) {
      actions.setUiConversation([]);
      syncToLocalStorage(agentId, []);
    }

    // Refresh sessions list
    void (async () => {
      try {
        const sessions = await getRecentSessions(agentId, { limitSessions: 25, scanLimit: 800 });
        if (loadedIdentityRef.current?.id !== agentId) return;
        actions.setConversationSessions(sessions);
      } catch {
        // ignore
      }
    })();

    // Hydrate this specific session from DB
    if (!isMemorySubEnabled('supabaseFallback')) return;

    const traceId = getStartupTraceId();
    eventBus.publish({
      id: generateUUID(),
      traceId,
      timestamp: Date.now(),
      source: AgentType.CORTEX_FLOW,
      type: PacketType.SYSTEM_ALERT,
      payload: { event: 'CONV_SESSION_SWITCH', agentId, sessionId: resolved },
      priority: 0.2
    });

    try {
      const res = await loadConversationForSession(agentId, resolved, { traceId, emitTelemetry: true, limit: 60 });
      const mapped = mapTurnsToUiMessages(res.turns);

      if (loadedIdentityRef.current?.id !== agentId) return;

      actions.setUiConversation(mapped);

      eventBus.publish({
        id: generateUUID(),
        traceId,
        timestamp: Date.now(),
        source: AgentType.CORTEX_FLOW,
        type: PacketType.SYSTEM_ALERT,
        payload: { event: 'CONV_SESSION_SWITCH_OK', agentId, sessionId: resolved, count: mapped.length },
        priority: 0.2
      });
    } catch (err) {
      eventBus.publish({
        id: generateUUID(),
        traceId,
        timestamp: Date.now(),
        source: AgentType.CORTEX_FLOW,
        type: PacketType.SYSTEM_ALERT,
        payload: { event: 'CONV_SESSION_SWITCH_FAIL', agentId, sessionId: resolved, error: String((err as any)?.message ?? err) },
        priority: 0.2
      });
    }
  }, [actions]);
  
  // ─────────────────────────────────────────────────────────────────────────
  // PHYSIOLOGY LOGGING (Limbic, Soma, Neuro states to EventBus)
  // ─────────────────────────────────────────────────────────────────────────
  const logPhysiologySnapshot = useCallback((context: string) => {
    const state = getCognitiveState();
    
    // Limbic snapshot
    eventBus.publish({
      id: generateUUID(),
      timestamp: Date.now(),
      source: AgentType.LIMBIC,
      type: PacketType.STATE_UPDATE,
      payload: {
        context,
        fear: state.limbic.fear,
        curiosity: state.limbic.curiosity,
        frustration: state.limbic.frustration,
        satisfaction: state.limbic.satisfaction
      },
      priority: 0.2
    });
    
    // Neurochem snapshot
    if (chemistryEnabled) {
      eventBus.publish({
        id: generateUUID(),
        timestamp: Date.now(),
        source: AgentType.NEUROCHEM,
        type: PacketType.STATE_UPDATE,
        payload: {
          context,
          dopamine: state.neuro.dopamine,
          serotonin: state.neuro.serotonin,
          norepinephrine: state.neuro.norepinephrine,
          isFlow: state.neuro.dopamine > 70
        },
        priority: 0.2
      });
    }
    
    // Soma snapshot
    eventBus.publish({
      id: generateUUID(),
      timestamp: Date.now(),
      source: AgentType.SOMA,
      type: PacketType.STATE_UPDATE,
      payload: {
        context,
        energy: state.soma.energy,
        cognitiveLoad: state.soma.cognitiveLoad,
        isSleeping: state.soma.isSleeping
      },
      priority: 0.2
    });
  }, [chemistryEnabled]);

  const runner = useMemo(() => {
    return KernelController.configure<AgentIdentity>({
      actions: {
        dispatch: (event) => actionsRef.current.dispatch(event as any),
        tick: () => actionsRef.current.tick(),
        setIsProcessing: (processing) => actionsRef.current.setIsProcessing(processing),
        setCurrentThought: (thought) => actionsRef.current.setCurrentThought(thought),
        addUiMessage: (message) => actionsRef.current.addUiMessage(message as any),
        setUiConversation: (messages) => actionsRef.current.setUiConversation(messages as any),
        processUserInput: (input) => actionsRef.current.processUserInput(input),
        hydrate: (state) => actionsRef.current.hydrate(state as any),
        updateSocialDynamics: (payload) => actionsRef.current.updateSocialDynamics(payload),
        setPendingAction: (action) => getCognitiveState().setPendingAction(action)
      },
      getState: () => getCognitiveState(),
      generateUUID,
      getCurrentTraceId: () => getCurrentTraceId(),
      processOutputForTools,
      archiveMessage: (msg, agentId, sessionId) => {
        void archiveMessage(msg, agentId, sessionId);
      },
      upsertLocalSessionSummary,
      publishEvent: (packet) => eventBus.publish(packet),
      runEventLoopStep: (ctx, input, callbacks) => EventLoop.runSingleStep(ctx, input, callbacks),
      getAutonomyConfig: () => getAutonomyConfig(),
      computeTickIntervalMs: (energy) => MIN_TICK_MS + (MAX_TICK_MS - MIN_TICK_MS) * (1 - energy / 100),
      getIdentity: () => loadedIdentityRef.current,
      getAgentId: () => loadedIdentityRef.current?.id ?? null,
      getSessionId: () => sessionIdRef.current,
      logPhysiologySnapshot,
      setSystemError: (e) => setSystemError(normalizeError(e))
    });
  }, [logPhysiologySnapshot, processOutputForTools, upsertLocalSessionSummary]);
  
  // ─────────────────────────────────────────────────────────────────────────
  // EVENTBUS SUBSCRIPTIONS
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const unsubscribe = eventBus.subscribe(PacketType.FIELD_UPDATE, (packet: CognitivePacket) => {
      if (packet.source === AgentType.NEUROCHEM && packet.payload?.action === 'DOPAMINE_PENALTY') {
        const delta = packet.payload.delta || 0;
        actions.updateNeuro({ dopamine: delta });
        console.log(`[KernelLite] DOPAMINE_PENALTY: ${delta}`);
      }
    });
    return () => unsubscribe();
  }, [actions]);

  useEffect(() => {
    const unsubscribe = eventBus.subscribe(PacketType.SYSTEM_ALERT, (packet: CognitivePacket) => {
      if (packet?.payload?.event !== 'TOOL_COMMIT') return;
      const message = String(packet.payload?.message || '').trim();
      if (!message) return;
      actionsRef.current.addUiMessage({
        role: 'assistant',
        text: message,
        type: 'tool_result',
        generator: 'system'
      } as any);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const handleToolResult = (packet: CognitivePacket) => {
      const tool = String(packet.payload?.tool || '');
      if (!tool) return;
      setLimbicState((prev) => applyActionFeedback({ success: true, tool }, prev));
    };

    const handleToolError = (packet: CognitivePacket) => {
      const tool = String(packet.payload?.tool || '');
      if (!tool) return;
      setLimbicState((prev) => applyActionFeedback({ success: false, tool }, prev));
    };

    const unsubResult = eventBus.subscribe(PacketType.TOOL_RESULT, handleToolResult);
    const unsubError = eventBus.subscribe(PacketType.TOOL_ERROR, handleToolError);
    const unsubTimeout = eventBus.subscribe(PacketType.TOOL_TIMEOUT, handleToolError);

    return () => {
      unsubResult();
      unsubError();
      unsubTimeout();
    };
  }, [setLimbicState]);

  useEffect(() => {
    const normalize = (input: string) => String(input || '').replace(/\s+/g, ' ').trim();
    const toSingleSentence = (input: string) => {
      const cleaned = normalize(input);
      if (!cleaned) return '';
      const match = cleaned.match(/^(.+?[.!?])(?:\s|$)/);
      return match ? match[1] : cleaned;
    };

    const unsubscribe = eventBus.subscribe(PacketType.SYSTEM_ALERT, (packet: CognitivePacket) => {
      if (packet?.payload?.event !== 'DREAM_CONSOLIDATION_COMPLETE') return;
      const result = (packet.payload?.result ?? {}) as Partial<DreamConsolidationResult>;
      const summary = toSingleSentence(String(result.selfSummary || ''));
      const lessonsRaw = Array.isArray(result.lessonsGenerated) ? result.lessonsGenerated : [];
      const lessons = lessonsRaw
        .map((lesson) => normalize(String(lesson || '')))
        .filter(Boolean)
        .slice(0, 3);
      const episodesProcessed = Number(result.episodesProcessed || 0);

      const parts: string[] = [];
      if (summary) parts.push(`Sleep summary: ${summary}`);
      if (lessons.length > 0) {
        const lessonText = lessons.map((l: string, idx: number) => `${idx + 1}. ${l}`).join(' ');
        parts.push(`Lessons: ${lessonText}`);
      } else if (summary) {
        parts.push(`Episodes processed: ${episodesProcessed}`);
      } else if (episodesProcessed > 0) {
        parts.push(`Sleep summary: processed ${episodesProcessed} episodes.`);
      }

      const message = parts.join(' ').trim();
      if (!message) return;
      actionsRef.current.addUiMessage({
        role: 'assistant',
        text: message,
        type: 'speech',
        generator: 'system'
      } as any);
    });
    return () => unsubscribe();
  }, []);

  const toggleAutonomy = useCallback(() => {
    actions.toggleAutonomousMode(!getCognitiveState().autonomousMode);
  }, [actions]);

  const toggleSleep = useCallback(() => {
    const sleeping = Boolean(getCognitiveState().soma?.isSleeping);
    if (sleeping) actions.wake();
    else actions.triggerSleep();
  }, [actions]);

  const toggleChemistry = useCallback(() => {
    actions.dispatch({ type: 'TOGGLE_CHEMISTRY', timestamp: Date.now() });
  }, [actions]);

  const injectStateOverride = useCallback((target: 'limbic' | 'soma' | 'neuro', key: string, value: number) => {
    actions.dispatch({
      type: 'STATE_OVERRIDE',
      timestamp: Date.now(),
      payload: { target, key, value }
    });
  }, [actions]);

  const resetKernel = useCallback(() => {
    actions.reset();
    setSystemError(null);
    actions.setIsProcessing(false);
    actions.setCurrentThought('Idle');

    const agentId = loadedIdentityRef.current?.id;
    if (agentId) {
      actions.setUiConversation([]);
      syncToLocalStorage(agentId, []);
    }
  }, [actions]);
  
  // ─────────────────────────────────────────────────────────────────────────
  // PROCESS KERNEL OUTPUTS (side effects)
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (pendingOutputs.length === 0) return;

    let consolidationTriggered = false;
    const triggerDreamConsolidation = () => {
      const state = getCognitiveState();
      if (consolidationTriggered) return;
      if (!state.soma?.isSleeping) return;
      if (state.hasConsolidatedThisSleep) return;
      consolidationTriggered = true;
      actions.hydrate({ hasConsolidatedThisSleep: true });
      DreamConsolidationService.consolidate(
        state.limbic,
        state.traitVector,
        loadedIdentityRef.current?.name || 'AK-FLOW'
      ).catch(console.error);
    };

    for (const output of pendingOutputs) {
      try {
        switch (output.type) {
          case 'DREAM_CONSOLIDATION':
            {
              triggerDreamConsolidation();
            }
            break;
            
          case 'WAKE_PROCESS':
            {
              const wakeState = getCognitiveState();
              executeWakeProcess({
                agentId: loadedIdentityRef.current?.id || 'unknown',
                agentName: loadedIdentityRef.current?.name || 'AK-FLOW',
                currentTraits: wakeState.traitVector,
                currentLimbic: wakeState.limbic,
                currentNeuro: wakeState.neuro
              }).catch(console.error);
            }
            break;
            
          case 'EVENT_BUS_PUBLISH':
            if (output.payload?.packet) {
              eventBus.publish(output.payload.packet);
            }
            break;
            
          case 'LOG':
            console.log(`[Kernel] ${output.payload?.message}`);
            break;
            
          case 'MAYBE_REM_CYCLE':
            // Runtime handles randomness - reducer stays pure
            if (rng() < (output.payload?.probability || 0.3)) {
              eventBus.publish({
                id: generateUUID(),
                timestamp: Date.now(),
                source: AgentType.VISUAL_CORTEX,
                type: PacketType.THOUGHT_CANDIDATE,
                payload: { 
                  internal_monologue: `REM Cycle: Dreaming... Energy at ${output.payload?.energy || 0}%` 
                },
                priority: 0.1
              });
            }
            break;
            
          case 'MAYBE_DREAM_CONSOLIDATION':
            // Runtime handles randomness - reducer stays pure
            if (rng() < (output.payload?.probability || 0.5)) {
              triggerDreamConsolidation();
            }
            break;
        }
      } catch (e) {
        console.error('[OutputProcessor] Error processing output:', output.type, e);
        // Continue processing other outputs
      }
    }
  }, [pendingOutputs]);
  
  // ─────────────────────────────────────────────────────────────────────────
  // ENGINE RUNTIME (autonomy loop lives outside React)
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (autonomousMode) runner.startAutonomyLoop();
    else runner.stopAutonomyLoop();

    return () => {
      runner.stopAutonomyLoop();
    };
  }, [autonomousMode, runner]);

  const handleInput = useCallback(async (userInput: string, imageData?: string) => {
    setSystemError(null);
    runner.enqueueUserInput(userInput, imageData);
  }, [runner]);
  
  const retryLastAction = useCallback(() => {
    setSystemError(null);
    // Could re-trigger last action here
  }, []);
  
  // ─────────────────────────────────────────────────────────────────────────
  // RETURN (API compatible with legacy useCognitiveKernel)
  // ─────────────────────────────────────────────────────────────────────────
  return {
    // State from Zustand
    limbicState,
    somaState,
    resonanceField,
    neuroState,
    traitVector,
    goalState,
    autonomousMode,
    chemistryEnabled,
    
    // Local React state
    agentName,
    agentPersona,
    conversation,
    conversationSessions,
    activeConversationSessionId,
    isProcessing,
    currentThought,
    systemError,
    
    // Actions
    setAutonomousMode: (enabled: boolean) => actions.toggleAutonomousMode(enabled),
    toggleAutonomy,
    toggleSleep,
    toggleChemistry,
    injectStateOverride,
    resetKernel,
    retryLastAction,
    selectConversationSession,
    handleInput
  };
};

export default useCognitiveKernelLite;
