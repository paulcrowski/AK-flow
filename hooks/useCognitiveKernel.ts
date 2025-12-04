
import { useState, useEffect, useRef, useCallback } from 'react';
import { eventBus } from '../core/EventBus';
import { CortexService } from '../services/gemini';
import { MemoryService } from '../services/supabase';
import { AgentType, PacketType, LimbicState, SomaState, CognitiveError, ResonanceField, NeurotransmitterState, GoalState, TraitVector } from '../types';
import { decideExpression, computeNovelty, estimateSocialCost } from '../core/systems/ExpressionPolicy';
import { isUserSilent } from '../core/utils/thresholds';
import { generateUUID } from '../utils/uuid';
import * as SomaSystem from '../core/systems/SomaSystem';
import * as LimbicSystem from '../core/systems/LimbicSystem';
import * as VolitionSystem from '../core/systems/VolitionSystem';
import * as BiologicalClock from '../core/systems/BiologicalClock';
import { MIN_TICK_MS, MAX_TICK_MS } from '../core/constants';
import { CortexSystem } from '../core/systems/CortexSystem';
import { EventLoop } from '../core/systems/EventLoop';
import { createProcessOutputForTools } from '../utils/toolParser';

// Helper for delays
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// FIX: Robust Error Normalizer
const normalizeError = (e: any): CognitiveError => {
    let msg = "Unknown Error";
    try {
        if (e instanceof Error) msg = e.message;
        else if (typeof e === 'string') msg = e;
        else msg = JSON.stringify(e);
    } catch {
        msg = "Non-serializable Error";
    }

    return {
        code: e?.code || 'UNKNOWN',
        message: msg,
        retryable: e?.retryable ?? true,
        details: e?.details || ''
    };
};

export const useCognitiveKernel = () => {
    // --- STATE ---
    const [limbicState, setLimbicState] = useState<LimbicState>({
        fear: 0.1,
        curiosity: 0.8, // 11/10 MODE: High curiosity start
        frustration: 0.0,
        satisfaction: 0.5
    });

    const [somaState, setSomaState] = useState<SomaState>({
        cognitiveLoad: 10,
        energy: 100,
        isSleeping: false
    });

    const [resonanceField, setResonanceField] = useState<ResonanceField>({
        coherence: 1.0,
        intensity: 0.5,
        frequency: 1.0,
        timeDilation: 1.0
    });

    // SECURITY AUDIT FIX: Default Autonomy MUST be false.
    const [autonomousMode, setAutonomousMode] = useState(false);

    // NEW: Persist Poetic Mode (Fixes Amnesia Bug)
    const [poeticMode, setPoeticMode] = useState(false);

    // NEW: Chemical Soul v1
    const [neuroState, setNeuroState] = useState<NeurotransmitterState>({
        dopamine: 55,
        serotonin: 60,
        norepinephrine: 50
    });
    const [chemistryEnabled, setChemistryEnabled] = useState<boolean>(true);

    // NEW: Temperament / Trait Vector (FAZA 4) - default preset: calm analyst
    const [traitVector] = useState<TraitVector>({
        arousal: 0.3,
        verbosity: 0.4,
        conscientiousness: 0.8,
        socialAwareness: 0.8,
        curiosity: 0.6
    });

    const [conversation, setConversation] = useState<{ role: string, text: string, type?: 'thought' | 'speech' | 'visual' | 'intel', imageData?: string, sources?: any[] }[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [currentThought, setCurrentThought] = useState<string>("Initializing Synapses...");
    const [systemError, setSystemError] = useState<CognitiveError | null>(null);

    // Refs
    const [goalState, setGoalState] = useState<GoalState>({
        activeGoal: null,
        backlog: [],
        lastUserInteractionAt: Date.now(),
        goalsFormedTimestamps: [],
        lastGoals: []
    });

    const stateRef = useRef({ limbicState, somaState, resonanceField, conversation, autonomousMode, poeticMode, neuroState, chemistryEnabled, goalState, traitVector });
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const silenceStartRef = useRef<number>(Date.now());
    const lastVisualTimestamp = useRef<number>(0);
    const visualBingeCountRef = useRef<number>(0);
    const isLoopRunning = useRef<boolean>(false);
    const hasBootedRef = useRef<boolean>(false); // Prevent double boot
    const thoughtHistoryRef = useRef<string[]>([]);
    const lastSpeakRef = useRef<number>(0);
    const lastUserInputRef = useRef<string | null>(null);
    const consecutiveAgentSpeechesRef = useRef<number>(0); // FAZA 4.5: Narcissism Loop Fix

    // Sync Ref
    useEffect(() => {
        stateRef.current = { limbicState, somaState, resonanceField, conversation, autonomousMode, poeticMode, neuroState, chemistryEnabled, goalState, traitVector };
    }, [limbicState, somaState, resonanceField, conversation, autonomousMode, poeticMode, neuroState, chemistryEnabled, goalState, traitVector]);

    // --- ACTIONS ---

    const logPhysiologySnapshot = (context: string) => {
        const snapshot = stateRef.current;

        // Limbic snapshot
        eventBus.publish({
            id: generateUUID(),
            timestamp: Date.now(),
            source: AgentType.LIMBIC,
            type: PacketType.STATE_UPDATE,
            payload: {
                context,
                fear: snapshot.limbicState.fear,
                curiosity: snapshot.limbicState.curiosity,
                frustration: snapshot.limbicState.frustration,
                satisfaction: snapshot.limbicState.satisfaction
            },
            priority: 0.2
        });

        // Neurochem snapshot (if enabled)
        if (chemistryEnabled) {
            eventBus.publish({
                id: generateUUID(),
                timestamp: Date.now(),
                source: AgentType.NEUROCHEM,
                type: PacketType.STATE_UPDATE,
                payload: {
                    context,
                    dopamine: snapshot.neuroState?.dopamine ?? neuroState.dopamine,
                    serotonin: snapshot.neuroState?.serotonin ?? neuroState.serotonin,
                    norepinephrine: snapshot.neuroState?.norepinephrine ?? neuroState.norepinephrine,
                    isFlow: (snapshot.neuroState?.dopamine ?? neuroState.dopamine) > 70
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
                energy: snapshot.somaState.energy,
                cognitiveLoad: snapshot.somaState.cognitiveLoad,
                isSleeping: snapshot.somaState.isSleeping
            },
            priority: 0.2
        });
    };

    const dreamConsolidation = async () => {
        try {
            const recentMemories = await MemoryService.recallRecent(50);
            const summary = await CortexService.consolidateMemories(recentMemories);

            await MemoryService.storeMemory({
                content: `DREAM CONSOLIDATION: ${summary}`,
                emotionalContext: limbicState,
                timestamp: new Date().toISOString(),
                id: generateUUID(),
                neuralStrength: 100,
                isCoreMemory: true
            } as any);

            eventBus.publish({
                id: generateUUID(),
                timestamp: Date.now(),
                source: AgentType.MEMORY_EPISODIC,
                type: PacketType.SYSTEM_ALERT,
                payload: {
                    event: 'DREAM_CONSOLIDATION_COMPLETE',
                    note: 'Core memory stored from sleep cycle.',
                    summary
                },
                priority: 0.7
            });
        } catch (e) {
            console.warn('Dream Consolidation Error (non-critical)', e);
        }
    };

    const toggleChemistry = () => {
        setChemistryEnabled(prev => !prev);
    };

    const addMessage = (role: 'user' | 'assistant', text: string, type: 'thought' | 'speech' | 'visual' | 'intel' = 'speech', imageData?: string, sources?: any[]) => {
        setConversation(prev => [...prev, { role, text, type, imageData, sources }]);
        silenceStartRef.current = Date.now();

        if (role === 'user') {
            setGoalState(prev => ({
                ...prev,
                lastUserInteractionAt: Date.now()
            }));
        }

        // RESTORED LOGGING: Publish speech/output to EventBus
        if (role === 'assistant' && type === 'speech') {
            eventBus.publish({
                id: generateUUID(),
                timestamp: Date.now(),
                source: AgentType.CORTEX_FLOW,
                type: PacketType.THOUGHT_CANDIDATE, // Reusing packet type for consistency in logs
                payload: {
                    speech_content: text,
                    voice_pressure: 1.0, // Assumed high since it was spoken
                    status: "SPOKEN"
                },
                priority: 0.8
            });

            // 11/10: Log physiological snapshot at the moment of speech
            logPhysiologySnapshot('SPEECH');
        }
    };

    const toggleAutonomy = () => {
        setAutonomousMode(prev => !prev);
        setSystemError(null);
        silenceStartRef.current = Date.now();
    };

    const toggleSleep = () => {
        setSomaState(prev => {
            if (prev.isSleeping) {
                return SomaSystem.forceWake(prev);
            } else {
                return SomaSystem.forceSleep(prev);
            }
        });
    };

    const injectStateOverride = (type: 'limbic' | 'soma', key: string, value: number) => {
        if (type === 'limbic') {
            setLimbicState(prev => ({
                ...prev,
                [key]: Math.max(0, Math.min(1, value))
            }));
        } else {
            setSomaState(prev => ({
                ...prev,
                [key]: Math.max(0, Math.min(100, value))
            }));
        }
    };

    // --- TOOL PARSER ---
    const processOutputForTools = createProcessOutputForTools({
        setCurrentThought,
        addMessage,
        setSomaState,
        setLimbicState,
        lastVisualTimestampRef: lastVisualTimestamp,
        visualBingeCountRef,
        stateRef
    });

    const handleCortexMessage = (role: 'user' | 'assistant', text: string, type: 'thought' | 'speech' | 'visual' | 'intel' = 'speech', imageData?: string, sources?: any[]) => {
        if (role === 'assistant' && type === 'speech') {
            (async () => {
                const current = stateRef.current;

                // Build short history of recent assistant speech for novelty estimation
                const assistantSpeechHistory = current.conversation
                    .filter(m => m.role === 'assistant' && m.type === 'speech')
                    .map(m => m.text)
                    .slice(-3);

                const novelty = computeNovelty(text, assistantSpeechHistory);
                const socialCost = estimateSocialCost(text);

                // FAZA 4.5: Oblicz czy user milczy (dynamiczny próg)
                const userIsSilent = isUserSilent(
                    current.goalState?.lastUserInteractionAt || Date.now(),
                    current.neuroState,
                    current.limbicState
                );

                const decision = decideExpression(
                    {
                        internalThought: undefined,
                        responseText: text,
                        // Heuristic: if there is an active goal, be slightly more strict about relevance
                        goalAlignment: current.goalState?.activeGoal ? 0.7 : 0.5,
                        noveltyScore: novelty,
                        socialCost,
                        context: 'USER_REPLY', // FAZA 4.2
                        userIsSilent // FAZA 4.5
                    },
                    current.traitVector,
                    current.somaState,
                    current.neuroState,
                    true // SHADOW MODE: log decisions but don't block conversations
                );

                // Log shadow-mode decision for observability
                console.log('[SHADOW MODE ExpressionPolicy]', {
                    novelty,
                    socialCost,
                    say: decision.say,
                    baseScore: decision.baseScore,
                    threshold: decision.threshold,
                    originalLength: text.length,
                    finalLength: decision.text.length
                });

                // Publish to EventBus for NeuroMonitor observability
                eventBus.publish({
                    id: generateUUID(),
                    timestamp: Date.now(),
                    source: AgentType.CORTEX_FLOW,
                    type: PacketType.SYSTEM_ALERT,
                    payload: {
                        event: 'EXPRESSION_POLICY_DECISION',
                        context: 'SHADOW_MODE',
                        novelty,
                        socialCost,
                        say: decision.say,
                        baseScore: decision.baseScore,
                        threshold: decision.threshold,
                        originalLength: text.length,
                        finalLength: decision.text.length
                    },
                    priority: 0.3
                });

                const cleanSpeech = await processOutputForTools(decision.text);
                if (cleanSpeech.trim()) {
                    addMessage(role, cleanSpeech, type, imageData, sources);
                }
            })();
        } else {
            addMessage(role, text, type, imageData, sources);
        }
    };

    // --- COGNITIVE LOOP ---
    const cognitiveCycle = useCallback(async () => {
        // 1. HARD KILL SWITCH
        if (!stateRef.current.autonomousMode) {
            isLoopRunning.current = false;
            return;
        }

        const currentState = stateRef.current;
        let nextTick = BiologicalClock.getDefaultAwakeTick(); // Default tick

        // 2. METABOLISM & HOMEOSTASIS (Auto-Sleep Logic)
        const metabolicResult = SomaSystem.calculateMetabolicState(currentState.somaState, 0);

        // Check for Exhaustion
        if (metabolicResult.shouldSleep) {
            eventBus.publish({
                id: generateUUID(),
                timestamp: Date.now(),
                source: AgentType.SOMA,
                type: PacketType.SYSTEM_ALERT,
                payload: { msg: "ENERGY CRITICAL. FORCING SLEEP MODE." },
                priority: 1.0
            });
            setSomaState(metabolicResult.newState);
        }

        // Sleep/Wake Cycle
        if (metabolicResult.newState.isSleeping) {
            nextTick = BiologicalClock.getDefaultSleepTick();

            // Update state with regenerated energy
            setSomaState(metabolicResult.newState);

            // LOG: Regeneration Progress
            eventBus.publish({
                id: generateUUID(),
                timestamp: Date.now(),
                source: AgentType.SOMA,
                type: PacketType.STATE_UPDATE,
                payload: { status: "REGENERATING", energy: metabolicResult.newState.energy, isSleeping: true },
                priority: 0.1
            });

            // Wake Up Check
            if (metabolicResult.shouldWake) {
                nextTick = BiologicalClock.getWakeTransitionTick();
                eventBus.publish({
                    id: generateUUID(),
                    timestamp: Date.now(),
                    source: AgentType.SOMA,
                    type: PacketType.SYSTEM_ALERT,
                    payload: { msg: "ENERGY RESTORED. WAKING UP." },
                    priority: 0.5
                });
            } else {
                // REM Sleep Visuals (Occasional)
                if (Math.random() > 0.7) {
                    eventBus.publish({
                        id: generateUUID(),
                        timestamp: Date.now(),
                        source: AgentType.VISUAL_CORTEX,
                        type: PacketType.THOUGHT_CANDIDATE,
                        payload: { internal_monologue: `REM Cycle: Dreaming... Energy at ${Math.round(metabolicResult.newState.energy)}%` },
                        priority: 0.1
                    });
                }

                // DREAM CONSOLIDATION (FAZA 2) - occasional during sleep, fire-and-forget
                if (Math.random() > 0.5) {
                    (async () => {
                        await dreamConsolidation();
                    })();
                }
            }
        } else {
            // Awake: Apply energy drain
            setSomaState(metabolicResult.newState);
        }

        // 3. EVENT LOOP (Cognition)
        const canThink = !metabolicResult.newState.isSleeping && !isProcessing;

        if (canThink) {
            try {
                const ctx: EventLoop.LoopContext = {
                    soma: metabolicResult.newState,
                    limbic: currentState.limbicState,
                    neuro: currentState.neuroState,
                    conversation: currentState.conversation,
                    autonomousMode: currentState.autonomousMode,
                    lastSpeakTimestamp: lastSpeakRef.current,
                    silenceStart: silenceStartRef.current,
                    thoughtHistory: thoughtHistoryRef.current,
                    poeticMode: currentState.poeticMode, // FIXED: Use persisted state
                    autonomousLimitPerMinute: 3, // Budget limit for safety
                    chemistryEnabled: currentState.chemistryEnabled,
                    goalState: currentState.goalState,
                    traitVector: currentState.traitVector,
                    consecutiveAgentSpeeches: consecutiveAgentSpeechesRef.current // FAZA 4.5: Narcissism Loop Fix
                };

                const nextCtx = await EventLoop.runSingleStep(ctx, null, {
                    onMessage: handleCortexMessage,
                    onThought: (t) => {
                        setIsProcessing(true); // Lock when thinking starts
                        setCurrentThought(t);

                        // RESTORED LOGGING: Publish thought to EventBus
                        eventBus.publish({
                            id: generateUUID(),
                            timestamp: Date.now(),
                            source: AgentType.CORTEX_FLOW,
                            type: PacketType.THOUGHT_CANDIDATE,
                            payload: {
                                internal_monologue: t,
                                // We don't have voice pressure here yet, but we log the thought
                                status: "THINKING"
                            },
                            priority: 0.5
                        });

                        // 11/10: Log physiological snapshot at the moment of thought
                        logPhysiologySnapshot('THOUGHT');
                    },
                    onSomaUpdate: setSomaState,
                    onLimbicUpdate: setLimbicState
                });

                // UPDATE STATE FROM CONTEXT (If EventLoop changed it)
                if (nextCtx.poeticMode !== currentState.poeticMode) {
                    setPoeticMode(nextCtx.poeticMode);
                }

                if (nextCtx.neuro && (nextCtx.neuro.dopamine !== currentState.neuroState.dopamine
                    || nextCtx.neuro.serotonin !== currentState.neuroState.serotonin
                    || nextCtx.neuro.norepinephrine !== currentState.neuroState.norepinephrine)) {
                    setNeuroState(nextCtx.neuro);
                }

                if (nextCtx.goalState && nextCtx.goalState !== currentState.goalState) {
                    setGoalState(nextCtx.goalState);
                }

                silenceStartRef.current = nextCtx.silenceStart;
                lastSpeakRef.current = nextCtx.lastSpeakTimestamp;
                thoughtHistoryRef.current = nextCtx.thoughtHistory;
                consecutiveAgentSpeechesRef.current = nextCtx.consecutiveAgentSpeeches; // FAZA 4.5: Sync counter
            } catch (e) {
                console.warn("EventLoop Error", e);
            } finally {
                setIsProcessing(false);
                setCurrentThought("Idle");
            }
        }
        // 4. RECURSION (Always schedule next tick if still autonomous)
        if (stateRef.current.autonomousMode) {
            timeoutRef.current = setTimeout(cognitiveCycle, nextTick);
        } else {
            isLoopRunning.current = false;
        }
    }, []); // FIXED: Empty dependency array to prevent loop thrashing

    // --- AUTONOMY ACTIVATION: MEMORY LINK ---
    useEffect(() => {
        if (autonomousMode && !isLoopRunning.current) {
            const activateAutonomy = async () => {
                isLoopRunning.current = true;

                // Trigger Memory Link only on activation
                eventBus.publish({
                    id: generateUUID(),
                    timestamp: Date.now(),
                    source: AgentType.MEMORY_EPISODIC,
                    type: PacketType.SYSTEM_ALERT,
                    payload: { status: "HIPPOCAMPUS_LINK_ESTABLISHED" },
                    priority: 1.0
                });

                try {
                    setCurrentThought("Accessing Hippocampus...");
                    const memories = await MemoryService.recallRecent(3);

                    if (memories && memories.length > 0) {
                        const memoryBlock = memories.map(m => `[Trace ${new Date(m.timestamp).toLocaleTimeString()}]: ${m.content}`).join('\n');
                        setConversation(prev => [
                            ...prev,
                            {
                                role: 'assistant',
                                text: `SYSTEM: Semantic Link Established. Recent Engrams Restored:\n${memoryBlock}`,
                                type: 'thought'
                            }
                        ]);
                        eventBus.publish({
                            id: generateUUID(),
                            timestamp: Date.now(),
                            source: AgentType.MEMORY_EPISODIC,
                            type: PacketType.THOUGHT_CANDIDATE,
                            payload: { action: "RECALL_INIT", status: "Synaptic pathways active." },
                            priority: 1.0
                        });
                    }
                } catch (e) {
                    console.warn("Memory Recall Failed (Non-Critical)", e);
                    // Do not stop the loop, just log it
                    setConversation(prev => [...prev, { role: 'assistant', text: "SYSTEM: Memory Link Unstable. Proceeding with limited context.", type: 'thought' }]);
                }

                // Start the loop
                cognitiveCycle();
            };

            activateAutonomy();

        } else if (!autonomousMode) {
            isLoopRunning.current = false;
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
                timeoutRef.current = null;
            }
        }

        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, [autonomousMode, cognitiveCycle]);


    // WATCHDOG TIMER
    useEffect(() => {
        let watchDog: ReturnType<typeof setTimeout>;
        if (isProcessing) {
            watchDog = setTimeout(() => {
                console.warn("Cognitive Kernel Watchdog: Forced Reset");
                setIsProcessing(false);
                setCurrentThought("System Reset (Watchdog)");
                if (!stateRef.current.somaState.isSleeping) {
                    setSystemError({ code: 'NEURAL_OVERLOAD', message: "Cognitive Loop Timeout (Reset)", retryable: true });
                }
            }, 120000);
        }
        return () => clearTimeout(watchDog);
    }, [isProcessing]);

    const retryLastAction = () => {
        if (!systemError?.retryable) return;
        if (lastUserInputRef.current) {
            handleInput(lastUserInputRef.current);
        }
        setSystemError(null);
    };

    const handleInput = async (input: string) => {
        lastUserInputRef.current = input;
        addMessage('user', input);

        // FAZA 4.5: Reset consecutive agent speeches (user spoke!)
        consecutiveAgentSpeechesRef.current = 0;

        if (somaState.isSleeping) {
            setSomaState(prev => SomaSystem.forceWake(prev));
        }

        setIsProcessing(true);
        setSystemError(null);
        silenceStartRef.current = Date.now();

        try {
            setCurrentThought("Analyzing Intent...");

            // 1. DETECT INTENT (Fix: Apply to user input too)
            const intent = await CortexService.detectIntent(input);
            let currentPoeticMode = stateRef.current.poeticMode;

            if (intent.style === 'POETIC') {
                setPoeticMode(true);
                currentPoeticMode = true;
            } else if (intent.style === 'SIMPLE') {
                setPoeticMode(false);
                currentPoeticMode = false;
            }

            setCurrentThought("Processing Input...");

            // 2. PROCESS MESSAGE
            // Hack: Inject mode into context string for CortexSystem
            const contextOverride = currentPoeticMode ? "POETIC_MODE_ENABLED" : "";

            const cortexResult = await CortexSystem.processUserMessage({
                text: input,
                currentLimbic: stateRef.current.limbicState,
                currentSoma: stateRef.current.somaState,
                conversationHistory: stateRef.current.conversation
            });

            // Update Limbic State
            if (cortexResult.moodShift) {
                setLimbicState(prev => LimbicSystem.applyMoodShift(prev, cortexResult.moodShift!));
            }

            // UI Feedback
            if (cortexResult.internalThought) {
                addMessage('assistant', cortexResult.internalThought, 'thought');
            }

            // Process tools in response text (Search/Visualize)
            const cleanSpeech = await processOutputForTools(cortexResult.responseText);

            if (cleanSpeech.trim()) {
                addMessage('assistant', cleanSpeech, 'speech');
            }

            // Update Refs
            lastSpeakRef.current = Date.now();
            silenceStartRef.current = Date.now();

            // Apply energy cost
            setSomaState(prev => {
                let updated = SomaSystem.applyEnergyCost(prev, 2);
                updated = SomaSystem.applyCognitiveLoad(updated, 10);
                return updated;
            });

        } catch (e: any) {
            console.error("Cognitive Failure:", e);
            const normError = normalizeError(e);
            if (!normError.message.includes("DB")) {
                setSystemError(normError);
                addMessage('assistant', `[SYSTEM FAILURE]: ${normError.message}`, 'thought');
            }
        } finally {
            setIsProcessing(false);
            setCurrentThought("Idle");
        }
    };

    // --- BOOT SEQUENCE: 11/10 MODE - COMPREHENSIVE STATE LOGGING ---
    useEffect(() => {
        if (hasBootedRef.current) return;
        hasBootedRef.current = true;

        const bootTimestamp = Date.now();
        const bootDate = new Date(bootTimestamp).toISOString();

        // Capture complete initial state snapshot for analysis
        const bootStateSnapshot = {
            timestamp: bootTimestamp,
            datetime: bootDate,

            // Biological States
            limbic: {
                fear: limbicState.fear,
                curiosity: limbicState.curiosity,
                frustration: limbicState.frustration,
                satisfaction: limbicState.satisfaction
            },
            soma: {
                energy: somaState.energy,
                cognitiveLoad: somaState.cognitiveLoad,
                isSleeping: somaState.isSleeping
            },
            resonance: {
                coherence: resonanceField.coherence,
                intensity: resonanceField.intensity,
                frequency: resonanceField.frequency,
                timeDilation: resonanceField.timeDilation
            },
            neuro: {
                dopamine: neuroState.dopamine,
                serotonin: neuroState.serotonin,
                norepinephrine: neuroState.norepinephrine
            },

            // System Configuration
            config: {
                autonomousMode: autonomousMode,
                tickIntervals: {
                    awake: BiologicalClock.getDefaultAwakeTick(),
                    sleep: BiologicalClock.getDefaultSleepTick(),
                    wakeTransition: BiologicalClock.getWakeTransitionTick(),
                    min: MIN_TICK_MS,
                    max: MAX_TICK_MS
                },
                thresholds: {
                    sleepTrigger: 20, // Energy < 20 = Sleep
                    wakeTrigger: 95,  // Energy >= 95 = Wake
                    voicePressure: 0.75, // Voice pressure > 0.75 = Speak
                    silenceThreshold: 2, // Silence > 2s = Think
                    heartbeatInterval: 30 // Heartbeat every 30s
                },
                energyRates: {
                    awakeDrain: 0.1,
                    sleepRegen: 7,
                    inputCost: 2,
                    visualCost: 15
                },
                chemistryEnabled
            }
        };

        // Publish comprehensive boot event to EventBus
        eventBus.publish({
            id: generateUUID(),
            timestamp: bootTimestamp,
            source: AgentType.GLOBAL_FIELD,
            type: PacketType.SYSTEM_ALERT,
            payload: {
                event: "SYSTEM_BOOT_COMPLETE",
                snapshot: bootStateSnapshot,
                message: "🧠 Cognitive Kernel Online | All Systems Nominal"
            },
            priority: 1.0
        });

        // Store boot state in memory for analysis
        MemoryService.storeMemory({
            content: `SYSTEM BOOT [${bootDate}]\n` +
                `LIMBIC: Fear=${limbicState.fear.toFixed(2)} Curiosity=${limbicState.curiosity.toFixed(2)} Frustration=${limbicState.frustration.toFixed(2)} Satisfaction=${limbicState.satisfaction.toFixed(2)}\n` +
                `SOMA: Energy=${somaState.energy}% Load=${somaState.cognitiveLoad}% Sleeping=${somaState.isSleeping}\n` +
                `RESONANCE: Coherence=${resonanceField.coherence.toFixed(2)} Intensity=${resonanceField.intensity.toFixed(2)} Freq=${resonanceField.frequency.toFixed(2)}Hz Dilation=${resonanceField.timeDilation.toFixed(2)}x\n` +
                `CONFIG: Awake=${BiologicalClock.getDefaultAwakeTick()}ms Sleep=${BiologicalClock.getDefaultSleepTick()}ms Wake=${BiologicalClock.getWakeTransitionTick()}ms`,
            emotionalContext: limbicState,
            timestamp: bootDate,
            id: generateUUID()
        }).catch(err => {
            console.warn("Boot state memory storage failed (non-critical):", err);
        });

        console.log("🧠 COGNITIVE KERNEL BOOT SNAPSHOT:", bootStateSnapshot);
    }, []);

    return {
        limbicState,
        somaState,
        resonanceField,
        neuroState,
        traitVector,
        conversation,
        isProcessing,
        currentThought,
        systemError,
        autonomousMode,
        setAutonomousMode,
        toggleAutonomy,
        toggleSleep,
        chemistryEnabled,
        toggleChemistry,
        injectStateOverride,
        goalState,
        retryLastAction,
        handleInput
    };
};
