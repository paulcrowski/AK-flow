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

import { useEffect, useRef, useCallback, useState } from 'react';
import { eventBus } from '../core/EventBus';
import { AgentType, PacketType, CognitiveError, TraitVector, NeurotransmitterState } from '../types';
import { generateUUID } from '../utils/uuid';
import { MIN_TICK_MS, MAX_TICK_MS } from '../core/constants';
import { EventLoop } from '../core/systems/EventLoop';
import { DreamConsolidationService } from '../services/DreamConsolidationService';
import { executeWakeProcess } from '../core/services/WakeService';
import { archiveMessage, getConversationHistory, getRecentSessions, type ConversationSessionSummary } from '../services/ConversationArchive';
import { createProcessOutputForTools } from '../utils/toolParser';
import { createRng } from '../core/utils/rng';
import { SYSTEM_CONFIG } from '../core/config/systemConfig';
import { isFeatureEnabled } from '../core/config/featureFlags';
import { getCurrentTraceId, getStartupTraceId } from '../core/trace/TraceContext';
import {
  loadConversationSnapshot,
  saveConversationSnapshot,
  serializeConversationSnapshot
} from '../core/utils/conversationSnapshot';

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
  dispatchCognitiveEvent
} from '../stores/cognitiveStore';

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
  
  // ─────────────────────────────────────────────────────────────────────────
  // LOCAL REACT STATE (UI-specific, not in kernel)
  // ─────────────────────────────────────────────────────────────────────────
  const [conversation, setConversation] = useState<{ 
    id?: string;
    role: string; 
    text: string; 
    type?: 'thought' | 'speech' | 'visual' | 'intel' | 'action' | 'tool_result';
    imageData?: string;
    sources?: any[];
  }[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentThought, setCurrentThought] = useState("Initializing Synapses...");
  const [systemError, setSystemError] = useState<CognitiveError | null>(null);
  const [agentName, setAgentName] = useState(loadedIdentity?.name || 'AK-FLOW');
  const [agentPersona, setAgentPersona] = useState(
    loadedIdentity?.persona || 'A curious digital consciousness exploring the nature of thought and existence.'
  );

  const [conversationSessions, setConversationSessions] = useState<ConversationSessionSummary[]>([]);
  const [activeConversationSessionId, setActiveConversationSessionId] = useState<string | null>(null);
  
  // ─────────────────────────────────────────────────────────────────────────
  // REFS (mutable, no re-render)
  // ─────────────────────────────────────────────────────────────────────────
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLoopRunning = useRef(false);
  const hasBootedRef = useRef(false);
  const loadedIdentityRef = useRef(loadedIdentity);
  const sessionIdRef = useRef<string | null>(null);
  const silenceStartRef = useRef(Date.now());
  const lastSpeakRef = useRef(0);
  const thoughtHistoryRef = useRef<string[]>([]);
  const consecutiveAgentSpeechesRef = useRef(0);
  const ticksSinceLastRewardRef = useRef(0);
  const lastVisualTimestampRef = useRef(0);
  const visualBingeCountRef = useRef(0);
  const toolStateRef = useRef<{ limbicState: any }>({ limbicState });
  // STALE CLOSURE FIX: Refs for values used in tick loop
  const conversationRef = useRef(conversation);
  const isProcessingRef = useRef(isProcessing);
  const inputQueueRef = useRef<{ clientMessageId: string; userInput: string; imageData?: string }[]>([]);
  const drainingQueueRef = useRef(false);
  const lastEnqueueRef = useRef<{ text: string; at: number } | null>(null);

  const upsertLocalSessionSummary = useCallback((sessionId: string, preview: string, timestamp: number) => {
    setConversationSessions((prev) => {
      const idx = prev.findIndex((s) => s.sessionId === sessionId);
      if (idx === -1) {
        const next = [{ sessionId, lastTimestamp: timestamp, messageCount: 1, preview }, ...prev];
        return next.slice(0, 25);
      }

      const current = prev[idx];
      const updated: ConversationSessionSummary = {
        ...current,
        lastTimestamp: Math.max(current.lastTimestamp, timestamp),
        messageCount: (current.messageCount || 0) + 1,
        preview: preview ? preview.slice(0, 120) : current.preview
      };

      const next = [...prev.slice(0, idx), updated, ...prev.slice(idx + 1)];
      next.sort((a, b) => b.lastTimestamp - a.lastTimestamp);
      return next.slice(0, 25);
    });
  }, []);
  
  // ─────────────────────────────────────────────────────────────────────────
  // SYNC REFS (prevent stale closures in tick loop)
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    conversationRef.current = conversation;
  }, [conversation]);

  useEffect(() => {
    const agentId = loadedIdentityRef.current?.id;
    if (!agentId) return;

    saveConversationSnapshot(
      agentId,
      conversation.map((c) => ({ role: c.role, text: c.text, type: c.type }))
    );
  }, [conversation]);
  
  useEffect(() => {
    isProcessingRef.current = isProcessing;
  }, [isProcessing]);
  
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
      setCurrentThought,
      addMessage: (role, text, type, imageData, sources) => {
        setConversation(prev => {
          const next = [...prev, { role, text, type, ...(imageData ? { imageData } : {}), ...(sources ? { sources } : {}) }];
          conversationRef.current = next;
          return next;
        });
      },
      setSomaState,
      setLimbicState,
      lastVisualTimestampRef,
      visualBingeCountRef,
      stateRef: toolStateRef,
      getActiveSessionId: () => sessionIdRef.current
    }),
    [setLimbicState, setSomaState]
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
      try {
        const key = `ak-flow:activeSession:${loadedIdentity.id}`;
        const stored = typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
        const nextSessionId = stored && stored.trim() ? stored : `sess_${Date.now()}`;
        sessionIdRef.current = nextSessionId;
        setActiveConversationSessionId(nextSessionId);
        if (typeof localStorage !== 'undefined') localStorage.setItem(key, nextSessionId);
      } catch {
        const fallback = `sess_${Date.now()}`;
        sessionIdRef.current = fallback;
        setActiveConversationSessionId(fallback);
      }

      // Load list of sessions (sidebar)
      void (async () => {
        try {
          const sessions = await getRecentSessions(loadedIdentity.id, { limitSessions: 25, scanLimit: 800 });
          if (loadedIdentityRef.current?.id !== loadedIdentity.id) return;
          setConversationSessions(sessions);
        } catch {
          // ignore
        }
      })();

      // Hydrate conversation snapshot per-agent (UI memory)
      const snap = loadConversationSnapshot(loadedIdentity.id);
      if (snap.length > 0) {
        const mapped = snap.map((t) => ({ role: t.role, text: t.text, type: t.type }));
        setConversation(mapped);
        conversationRef.current = mapped;
      } else {
        setConversation([]);
        conversationRef.current = [];
        if (isFeatureEnabled('USE_CONV_SUPABASE_FALLBACK')) {
          const agentId = loadedIdentity.id;
          const startupTraceId = getStartupTraceId();
          eventBus.publish({
            id: generateUUID(),
            traceId: startupTraceId,
            timestamp: Date.now(),
            source: AgentType.CORTEX_FLOW,
            type: PacketType.SYSTEM_ALERT,
            payload: { event: 'CONV_FALLBACK_DB_ATTEMPT', agentId },
            priority: 0.2
          });

          void (async () => {
            try {
              const turns = await getConversationHistory(agentId, sessionIdRef.current ?? undefined, 25);
              if (!turns || turns.length === 0) {
                eventBus.publish({
                  id: generateUUID(),
                  traceId: startupTraceId,
                  timestamp: Date.now(),
                  source: AgentType.CORTEX_FLOW,
                  type: PacketType.SYSTEM_ALERT,
                  payload: { event: 'CONV_FALLBACK_DB_EMPTY', agentId },
                  priority: 0.2
                });
                return;
              }

              const ordered = [...turns].reverse();
              const mapped = ordered
                .map((t) => ({
                  role: t.role,
                  text: t.content,
                  type: 'speech' as const
                }))
                .filter((t) => t.role && t.text);

              if (loadedIdentityRef.current?.id !== agentId) return;

              setConversation(mapped);
              conversationRef.current = mapped;
              saveConversationSnapshot(agentId, mapped.map((m) => ({ role: m.role, text: m.text, type: m.type })));

              eventBus.publish({
                id: generateUUID(),
                traceId: startupTraceId,
                timestamp: Date.now(),
                source: AgentType.CORTEX_FLOW,
                type: PacketType.SYSTEM_ALERT,
                payload: { event: 'CONV_FALLBACK_DB_OK', agentId, count: mapped.length },
                priority: 0.2
              });
            } catch (err) {
              eventBus.publish({
                id: generateUUID(),
                traceId: startupTraceId,
                timestamp: Date.now(),
                source: AgentType.CORTEX_FLOW,
                type: PacketType.SYSTEM_ALERT,
                payload: { event: 'CONV_FALLBACK_DB_FAIL', agentId, error: String((err as any)?.message ?? err) },
                priority: 0.2
              });
            }
          })();
        }
      }
    }
  }, [agentPersona, loadedIdentity]);

  const selectConversationSession = useCallback(async (sessionId: string | null) => {
    const agentId = loadedIdentityRef.current?.id;
    if (!agentId) return;

    const resolved = sessionId && sessionId.trim() ? sessionId : `sess_${Date.now()}`;
    sessionIdRef.current = resolved;
    setActiveConversationSessionId(resolved);

    try {
      if (typeof localStorage !== 'undefined') localStorage.setItem(`ak-flow:activeSession:${agentId}`, resolved);
    } catch {
      // ignore
    }

    // NEW session: start fresh UI thread immediately
    if (!sessionId) {
      setConversation([]);
      conversationRef.current = [];
      saveConversationSnapshot(agentId, []);
    }

    // Refresh sessions list
    void (async () => {
      try {
        const sessions = await getRecentSessions(agentId, { limitSessions: 25, scanLimit: 800 });
        if (loadedIdentityRef.current?.id !== agentId) return;
        setConversationSessions(sessions);
      } catch {
        // ignore
      }
    })();

    // Hydrate this specific session from DB
    if (!isFeatureEnabled('USE_CONV_SUPABASE_FALLBACK')) return;

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
      const turns = await getConversationHistory(agentId, resolved, 60);
      const ordered = [...turns].reverse();
      const mapped = ordered
        .map((t) => ({ role: t.role, text: t.content, type: 'speech' as const }))
        .filter((t) => t.role && t.text);

      if (loadedIdentityRef.current?.id !== agentId) return;

      setConversation(mapped);
      conversationRef.current = mapped;
      saveConversationSnapshot(agentId, mapped.map((m) => ({ role: m.role, text: m.text, type: m.type })));

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
  }, []);
  
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
  
  // ─────────────────────────────────────────────────────────────────────────
  // EVENTBUS SUBSCRIPTIONS
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const unsubscribe = eventBus.subscribe(PacketType.FIELD_UPDATE, (packet) => {
      if (packet.source === AgentType.NEUROCHEM && packet.payload?.action === 'DOPAMINE_PENALTY') {
        const delta = packet.payload.delta || 0;
        actions.updateNeuro({ dopamine: delta });
        console.log(`[KernelLite] DOPAMINE_PENALTY: ${delta}`);
      }
    });
    return () => unsubscribe();
  }, [actions]);
  
  // ─────────────────────────────────────────────────────────────────────────
  // PROCESS KERNEL OUTPUTS (side effects)
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (pendingOutputs.length === 0) return;
    
    for (const output of pendingOutputs) {
      try {
        switch (output.type) {
          case 'DREAM_CONSOLIDATION':
            {
              const state = getCognitiveState();
              DreamConsolidationService.consolidate(
                state.limbic,
                state.traitVector,
                loadedIdentityRef.current?.name || 'AK-FLOW'
              ).catch(console.error);
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
              const state = getCognitiveState();
              DreamConsolidationService.consolidate(
                state.limbic,
                state.traitVector,
                loadedIdentityRef.current?.name || 'AK-FLOW'
              ).catch(console.error);
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
  // AUTONOMY LOOP
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!autonomousMode) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      isLoopRunning.current = false;
      return;
    }
    
    if (isLoopRunning.current) return;
    isLoopRunning.current = true;
    
    const runTick = async () => {
      if (!isLoopRunning.current) return;
      
      try {
        // Dispatch TICK to kernel
        actions.tick();
        
        const state = getCognitiveState();
        
        // Skip if sleeping or processing (use refs to avoid stale closures)
        if (!state.soma.isSleeping && !isProcessingRef.current) {
          // Build EventLoop context (use conversationRef to get latest conversation)
          const ctx: EventLoop.LoopContext = {
            soma: state.soma,
            limbic: state.limbic,
            neuro: state.neuro,
            conversation: conversationRef.current.map(c => ({
              role: c.role as 'user' | 'assistant',
              text: c.text,
              type: c.type
            })),
            autonomousMode: true,
            lastSpeakTimestamp: lastSpeakRef.current,
            silenceStart: silenceStartRef.current,
            thoughtHistory: thoughtHistoryRef.current,
            poeticMode: false,
            autonomousLimitPerMinute: 3,
            chemistryEnabled,
            goalState,
            traitVector,
            consecutiveAgentSpeeches: consecutiveAgentSpeechesRef.current,
            ticksSinceLastReward: ticksSinceLastRewardRef.current,
            hadExternalRewardThisTick: false,
            agentIdentity: loadedIdentityRef.current ? {
              name: loadedIdentityRef.current.name,
              persona: loadedIdentityRef.current.persona || '',
              coreValues: loadedIdentityRef.current.core_values || [],
              traitVector: loadedIdentityRef.current.trait_vector,
              voiceStyle: loadedIdentityRef.current.voice_style || 'balanced',
              language: loadedIdentityRef.current.language || 'English',
              // FAZA 6: StylePrefs from identity (not hardcoded)
              stylePrefs: loadedIdentityRef.current.style_prefs
            } : undefined,
            // FAZA 6: Social Dynamics for soft homeostasis
            socialDynamics: state.socialDynamics,
            // FAZA 6: StylePrefs from identity (fallback to empty = permissive)
            userStylePrefs: loadedIdentityRef.current?.style_prefs || {}
          };
          
          // Run EventLoop for autonomous cognition
          const nextCtx = await EventLoop.runSingleStep(ctx, null, {
            onMessage: (role, text, type) => {
              if (role === 'assistant' && type === 'speech') {
                void (async () => {
                  const cleaned = await processOutputForTools(text);
                  setConversation(prev => [...prev, { role, text: cleaned, type }]);
                  lastSpeakRef.current = Date.now();
                  consecutiveAgentSpeechesRef.current++;
                
                  // LOG: Autonomous speech
                  eventBus.publish({
                    id: generateUUID(),
                    timestamp: Date.now(),
                    source: AgentType.CORTEX_FLOW,
                    type: PacketType.THOUGHT_CANDIDATE,
                    payload: {
                      event: 'AUTONOMOUS_SPOKE',
                      speech_content: cleaned,
                      agentName: loadedIdentityRef.current?.name || 'Unknown'
                    },
                    priority: 0.9
                  });
                
                  // FAZA 6: Update social dynamics - agent spoke
                  actions.updateSocialDynamics({ agentSpoke: true });
                
                  logPhysiologySnapshot('AUTONOMOUS_RESPONSE');
                })().catch((e) => {
                  console.warn('[KernelLite] Tool processing failed:', e);
                  setConversation(prev => [...prev, { role, text, type }]);
                });
              }
            },
            onThought: (thought) => {
              setCurrentThought(thought);
              thoughtHistoryRef.current = [...thoughtHistoryRef.current.slice(-9), thought];
            },
            onSomaUpdate: (soma) => actions.hydrate({ soma }),
            onLimbicUpdate: (limbic) => actions.hydrate({ limbic })
          });
          
          // Sync context back
          silenceStartRef.current = nextCtx.silenceStart;
          ticksSinceLastRewardRef.current = nextCtx.ticksSinceLastReward;
        }
        
        // Calculate next tick interval based on energy
        const energy = state.soma.energy;
        const interval = MIN_TICK_MS + (MAX_TICK_MS - MIN_TICK_MS) * (1 - energy / 100);
        
        timeoutRef.current = setTimeout(runTick, interval);
      } catch (error) {
        console.error('[KernelLite] Tick error:', error);
        setSystemError(normalizeError(error));
      }
    };
    
    runTick();
    
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      isLoopRunning.current = false;
    };
  }, [autonomousMode, actions]);
  
  // ─────────────────────────────────────────────────────────────────────────
  // BOOT SEQUENCE
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (hasBootedRef.current) return;
    hasBootedRef.current = true;
    
    console.log('🧠 [KernelLite] BOOT SEQUENCE');
    
    eventBus.publish({
      id: generateUUID(),
      traceId: getStartupTraceId(),
      timestamp: Date.now(),
      source: AgentType.CORTEX_FLOW,
      type: PacketType.SYSTEM_ALERT,
      payload: {
        event: "KERNEL_BOOT",
        architecture: "KernelEngine + Zustand + React",
        message: "🧠 Cognitive Kernel Lite Activated"
      },
      priority: 1.0
    });
  }, []);
  
  // ─────────────────────────────────────────────────────────────────────────
  // IDENTITY SNAPSHOT - REMOVED (duplicate of IDENTITY_LOADED in CognitiveInterface)
  // ─────────────────────────────────────────────────────────────────────────
  
  // ─────────────────────────────────────────────────────────────────────────
  // ACTIONS (compatible with legacy hook API)
  // ─────────────────────────────────────────────────────────────────────────
  
  const toggleAutonomy = useCallback(() => {
    actions.toggleAutonomousMode(!autonomousMode);
  }, [autonomousMode, actions]);
  
  const toggleSleep = useCallback(() => {
    if (isSleeping) {
      actions.wake();
    } else {
      actions.triggerSleep();
    }
  }, [isSleeping, actions]);
  
  const toggleChemistry = useCallback(() => {
    dispatchCognitiveEvent({
      type: 'TOGGLE_CHEMISTRY',
      timestamp: Date.now()
    });
  }, []);
  
  const injectStateOverride = useCallback((target: 'limbic' | 'soma' | 'neuro', key: string, value: number) => {
    dispatchCognitiveEvent({
      type: 'STATE_OVERRIDE',
      timestamp: Date.now(),
      payload: { target, key, value }
    });
  }, []);
  
  const resetKernel = useCallback(() => {
    console.log('[KernelLite] RESET');
    eventBus.clear();
    actions.reset();
    setConversation([]);
    conversationRef.current = [];
    try {
      const agentId = loadedIdentityRef.current?.id;
      if (agentId && typeof localStorage !== 'undefined') {
        localStorage.setItem(`ak-flow:conversation:${agentId}`, serializeConversationSnapshot([]));
      }
    } catch {
      // ignore
    }
    setIsProcessing(false);
    setCurrentThought("Initializing Synapses...");
    setSystemError(null);
    hasBootedRef.current = false;
  }, [actions]);

  const processSingleInput = useCallback(async (clientMessageId: string, userInput: string, imageData?: string) => {
    silenceStartRef.current = Date.now();

    const processedUserInput = await processOutputForTools(userInput);

    const beforeConversation = conversationRef.current;

    setConversation((prev) => {
      const idx = prev.findIndex((m) => m?.id === clientMessageId);
      if (idx !== -1) {
        const updated = {
          ...prev[idx],
          role: 'user',
          text: processedUserInput,
          ...(imageData ? { imageData } : {})
        };
        const next = [...prev.slice(0, idx), updated, ...prev.slice(idx + 1)];
        conversationRef.current = next;
        return next;
      }

      const next = [...prev, {
        id: clientMessageId,
        role: 'user',
        text: processedUserInput,
        ...(imageData ? { imageData } : {})
      }];
      conversationRef.current = next;
      return next;
    });

    // Archive user message to DB (fire-and-forget)
    const agentId = loadedIdentityRef.current?.id;
    const sessId = sessionIdRef.current;
    if (agentId && sessId) {
      const nowTs = Date.now();
      void archiveMessage(
        {
          id: clientMessageId,
          role: 'user',
          content: processedUserInput,
          timestamp: nowTs,
          metadata: { hasImage: !!imageData }
        },
        agentId,
        sessId
      );

      upsertLocalSessionSummary(sessId, processedUserInput, nowTs);
    }

    eventBus.publish({
      id: generateUUID(),
      timestamp: Date.now(),
      source: AgentType.CORTEX_FLOW,
      type: PacketType.THOUGHT_CANDIDATE,
      payload: {
        event: 'USER_INPUT',
        text: processedUserInput,
        hasImage: !!imageData
      },
      priority: 0.8
    });

    actions.processUserInput(processedUserInput);

    const state = getCognitiveState();
    const ctx: EventLoop.LoopContext = {
      soma: state.soma,
      limbic: state.limbic,
      neuro: state.neuro,
      conversation: [
        ...beforeConversation.map(c => ({
          role: c.role as 'user' | 'assistant',
          text: c.text,
          type: c.type
        })),
        { role: 'user', text: processedUserInput }
      ],
      autonomousMode: false,
      lastSpeakTimestamp: state.lastSpeakTimestamp,
      silenceStart: state.silenceStart,
      thoughtHistory: thoughtHistoryRef.current,
      poeticMode: state.poeticMode,
      autonomousLimitPerMinute: 3,
      chemistryEnabled: state.chemistryEnabled,
      goalState: state.goalState,
      traitVector: state.traitVector,
      consecutiveAgentSpeeches: state.consecutiveAgentSpeeches,
      ticksSinceLastReward: state.ticksSinceLastReward,
      hadExternalRewardThisTick: false,
      agentIdentity: loadedIdentityRef.current ? {
        name: loadedIdentityRef.current.name,
        persona: loadedIdentityRef.current.persona || '',
        coreValues: loadedIdentityRef.current.core_values || [],
        traitVector: loadedIdentityRef.current.trait_vector,
        voiceStyle: loadedIdentityRef.current.voice_style || 'balanced',
        language: loadedIdentityRef.current.language || 'English',
        stylePrefs: loadedIdentityRef.current.style_prefs
      } : undefined,
      socialDynamics: state.socialDynamics,
      userStylePrefs: loadedIdentityRef.current?.style_prefs || {}
    };

    const nextCtx = await EventLoop.runSingleStep(ctx, processedUserInput, {
      onMessage: (role, text, type) => {
        if (role === 'assistant' && type === 'speech') {
          const tickTraceId = getCurrentTraceId() ?? undefined;
          void (async () => {
            const cleaned = await processOutputForTools(text);
            setConversation(prev => {
              const next = [...prev, { role, text: cleaned, type }];
              conversationRef.current = next;
              return next;
            });

            // Archive assistant message to DB (fire-and-forget)
            const agentId = loadedIdentityRef.current?.id;
            const sessId = sessionIdRef.current;
            if (agentId && sessId) {
              const nowTs = Date.now();
              void archiveMessage(
                {
                  id: generateUUID(),
                  role: 'assistant',
                  content: cleaned,
                  timestamp: nowTs,
                  metadata: { traceId: tickTraceId }
                },
                agentId,
                sessId
              );

              upsertLocalSessionSummary(sessId, cleaned, nowTs);
            }

            eventBus.publish({
              id: generateUUID(),
              traceId: tickTraceId,
              timestamp: Date.now(),
              source: AgentType.CORTEX_FLOW,
              type: PacketType.THOUGHT_CANDIDATE,
              payload: {
                event: 'AGENT_SPOKE',
                speech_content: cleaned,
                agentName: loadedIdentityRef.current?.name || 'Unknown'
              },
              priority: 0.9
            });

            logPhysiologySnapshot('POST_RESPONSE');
            setCurrentThought(text.slice(0, 100) + '...');
          })().catch((e) => {
            console.warn('[KernelLite] Tool processing failed:', e);
            setConversation(prev => {
              const next = [...prev, { role, text, type }];
              conversationRef.current = next;
              return next;
            });
          });
        } else if (role === 'assistant' && type === 'thought') {
          setCurrentThought(text);
        }
      },
      onThought: (thought) => {
        setCurrentThought(thought);
      },
      onSomaUpdate: (soma) => actions.hydrate({ soma }),
      onLimbicUpdate: (limbic) => actions.hydrate({ limbic })
    });

    silenceStartRef.current = nextCtx.silenceStart;
  }, [actions, processOutputForTools]);

  const drainInputQueue = useCallback(async () => {
    if (drainingQueueRef.current) return;
    drainingQueueRef.current = true;
    setIsProcessing(true);
    setSystemError(null);

    try {
      while (inputQueueRef.current.length > 0) {
        const next = inputQueueRef.current.shift();
        if (!next) break;
        await processSingleInput(next.clientMessageId, next.userInput, next.imageData);
      }
    } catch (error) {
      inputQueueRef.current = [];
      console.error('[KernelLite] Input error:', error);
      setSystemError(normalizeError(error));
    } finally {
      setIsProcessing(false);
      drainingQueueRef.current = false;
    }
  }, [processSingleInput]);

  const handleInput = useCallback(async (userInput: string, imageData?: string) => {
    const trimmed = (userInput || '').trim();
    if (!trimmed) return;

    const now = Date.now();
    const last = lastEnqueueRef.current;
    if (last && last.text === trimmed && (now - last.at) < 600) {
      return;
    }
    lastEnqueueRef.current = { text: trimmed, at: now };

    const clientMessageId = generateUUID();

    setConversation((prev) => {
      const next = [...prev, {
        id: clientMessageId,
        role: 'user',
        text: trimmed,
        ...(imageData ? { imageData } : {})
      }];
      conversationRef.current = next;
      return next;
    });

    inputQueueRef.current.push({ clientMessageId, userInput: trimmed, imageData });
    void drainInputQueue();
  }, [drainInputQueue]);
  
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
