
import { useState, useEffect, useRef, useCallback } from 'react';
import { eventBus } from '../core/EventBus';
import { CortexService } from '../services/gemini';
import { MemoryService } from '../services/supabase';
import { AgentType, PacketType, LimbicState, SomaState, CognitiveError, ResonanceField } from '../types';
import { generateUUID } from '../utils/uuid';
import * as SomaSystem from '../core/systems/SomaSystem';
import * as LimbicSystem from '../core/systems/LimbicSystem';
import * as VolitionSystem from '../core/systems/VolitionSystem';
import * as BiologicalClock from '../core/systems/BiologicalClock';

// Constants
const VISUAL_BASE_COOLDOWN = 60000; // 1 minute base cooldown (increased for safety)

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

    const [conversation, setConversation] = useState<{ role: string, text: string, type?: 'thought' | 'speech' | 'visual' | 'intel', imageData?: string, sources?: any[] }[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [currentThought, setCurrentThought] = useState<string>("Initializing Synapses...");
    const [systemError, setSystemError] = useState<CognitiveError | null>(null);

    // Refs
    const stateRef = useRef({ limbicState, somaState, resonanceField, conversation, autonomousMode });
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const silenceStartRef = useRef<number>(Date.now());
    const lastVisualTimestamp = useRef<number>(0);
    const visualBingeCountRef = useRef<number>(0);
    const isLoopRunning = useRef<boolean>(false);
    const hasBootedRef = useRef<boolean>(false); // Prevent double boot

    // Sync Ref
    useEffect(() => {
        stateRef.current = { limbicState, somaState, resonanceField, conversation, autonomousMode };
    }, [limbicState, somaState, resonanceField, conversation, autonomousMode]);

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

            // System Configuration
            config: {
                autonomousMode: autonomousMode,
                tickIntervals: {
                    awake: BiologicalClock.getDefaultAwakeTick(),
                    sleep: BiologicalClock.getDefaultSleepTick(),
                    wakeTransition: BiologicalClock.getWakeTransitionTick(),
                    min: BiologicalClock.MIN_TICK_MS,
                    max: BiologicalClock.MAX_TICK_MS
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
                }
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
            }
        } else {
            // Awake: Apply energy drain
            setSomaState(metabolicResult.newState);
        }

        // 3. VOLITION (Only if awake and not processing)
        const canThink = !metabolicResult.newState.isSleeping && !isProcessing;
        const silenceDuration = VolitionSystem.calculateSilenceDuration(silenceStartRef.current);

        try {
            if (canThink && VolitionSystem.shouldInitiateThought(silenceDuration)) {
                setIsProcessing(true);
                setCurrentThought("Drifting...");

                try {
                    const historyText = currentState.conversation.slice(-3).map(m => m.text).join('\n') || "Silence...";

                    // HEARTBEAT
                    if (VolitionSystem.shouldPublishHeartbeat(silenceDuration)) {
                        eventBus.publish({
                            id: generateUUID(),
                            timestamp: Date.now(),
                            source: AgentType.SOMA,
                            type: PacketType.SYSTEM_ALERT,
                            payload: { status: "COGNITIVE_PULSE_ACTIVE", energy: Math.round(metabolicResult.newState.energy) },
                            priority: 0.1
                        });
                    }

                    const volition = await CortexService.autonomousVolition(
                        JSON.stringify(currentState.limbicState),
                        "Latent processing...",
                        historyText,
                        silenceDuration
                    );

                    eventBus.publish({
                        id: generateUUID(),
                        timestamp: Date.now(),
                        source: AgentType.CORTEX_FLOW,
                        type: PacketType.THOUGHT_CANDIDATE,
                        payload: volition,
                        priority: volition.voice_pressure || 0
                    });

                    await processOutputForTools(volition.internal_monologue);
                    const speechOutput = await processOutputForTools(volition.speech_content);

                    // Use VolitionSystem to decide if we should speak
                    const volitionDecision = VolitionSystem.evaluateVolition(
                        volition.voice_pressure || 0,
                        speechOutput
                    );

                    if (volitionDecision.shouldSpeak) {
                        addMessage('assistant', speechOutput, 'speech');
                        silenceStartRef.current = Date.now();

                        // Apply emotional response to speech
                        setLimbicState(prev => LimbicSystem.applySpeechResponse(prev));
                    }

                } catch (e) {
                    // Silent fail
                } finally {
                    setIsProcessing(false);
                    setCurrentThought("Idle");
                }
            }
        } finally {
            // 4. RECURSION (Always schedule next tick if still autonomous)
            if (stateRef.current.autonomousMode) {
                timeoutRef.current = setTimeout(cognitiveCycle, nextTick);
            } else {
                isLoopRunning.current = false;
            }
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

    // --- ACTIONS ---

    const addMessage = (role: 'user' | 'assistant', text: string, type: 'thought' | 'speech' | 'visual' | 'intel' = 'speech', imageData?: string, sources?: any[]) => {
        setConversation(prev => [...prev, { role, text, type, imageData, sources }]);
        silenceStartRef.current = Date.now();
    };

    // --- TOOL PARSER ---
    const processOutputForTools = async (rawText: string): Promise<string> => {
        let cleanText = rawText;

        // 1. SEARCH TAG
        const searchMatch = cleanText.match(/\[SEARCH:\s*(.*?)\]/i);
        if (searchMatch) {
            const query = searchMatch[1].trim();
            cleanText = cleanText.replace(searchMatch[0], '').trim();

            setCurrentThought(`Researching: ${query}...`);
            const research = await CortexService.performDeepResearch(query, "User requested data.");

            addMessage('assistant', research.synthesis, 'intel', undefined, research.sources);

            eventBus.publish({
                id: generateUUID(),
                timestamp: Date.now(),
                source: AgentType.CORTEX_FLOW,
                type: PacketType.FIELD_UPDATE,
                payload: { action: "DEEP_RESEARCH_COMPLETE", topic: query, found_sources: research.sources },
                priority: 0.8
            });
        }

        // 2. VISUAL TAG
        const visualMatch = cleanText.match(/\[VISUALIZE:\s*([\s\S]*?)\]/i);
        if (visualMatch) {
            let prompt = visualMatch[1].trim();
            if (prompt.endsWith(']')) prompt = prompt.slice(0, -1);

            cleanText = cleanText.replace(visualMatch[0], '').trim();

            const now = Date.now();
            if (now - lastVisualTimestamp.current > 600000) {
                visualBingeCountRef.current = 0;
            }

            const currentBinge = visualBingeCountRef.current;
            const dynamicCooldown = VISUAL_BASE_COOLDOWN * (currentBinge + 1);
            const timeSinceLast = now - lastVisualTimestamp.current;

            // REFRACTORY PERIOD CHECK
            if (timeSinceLast < dynamicCooldown) {
                const remainingSec = Math.ceil((dynamicCooldown - timeSinceLast) / 1000);
                const distractions = [
                    "System Alert: Sudden spike in entropy detected. Analyze logic structure instead.",
                    "Data Stream Update: Reviewing recent memory coherence.",
                    "Focus Shift: Analyzing linguistic patterns in user input."
                ];
                const randomDistraction = distractions[Math.floor(Math.random() * distractions.length)];

                addMessage('assistant', `[VISUAL CORTEX REFRACTORY PERIOD ACTIVE - ${remainingSec}s REMAINING] ${randomDistraction}`, 'thought');

                eventBus.publish({
                    id: generateUUID(),
                    timestamp: Date.now(),
                    source: AgentType.CORTEX_FLOW,
                    type: PacketType.SYSTEM_ALERT,
                    payload: { msg: "Visual Cortex Overload. Redirecting focus." },
                    priority: 0.2
                });

                return cleanText;

            } else {
                // ALLOWED
                setCurrentThought(`Visualizing: ${prompt.substring(0, 30)}...`);
                lastVisualTimestamp.current = now;
                visualBingeCountRef.current += 1;

                const energyCost = 15 * (currentBinge + 1);

                // Apply metabolic and emotional costs using system modules
                setSomaState(prev => {
                    let updated = SomaSystem.applyEnergyCost(prev, energyCost);
                    updated = SomaSystem.applyCognitiveLoad(updated, 15);
                    return updated;
                });

                setLimbicState(prev => LimbicSystem.applyVisualEmotionalCost(prev, currentBinge));

                eventBus.publish({
                    id: generateUUID(),
                    timestamp: Date.now(),
                    source: AgentType.VISUAL_CORTEX,
                    type: PacketType.VISUAL_THOUGHT,
                    payload: { status: "RENDERING", prompt },
                    priority: 0.5
                });

                try {
                    const img = await CortexService.generateVisualThought(prompt);
                    if (img) {
                        const perception = await CortexService.analyzeVisualInput(img);

                        eventBus.publish({
                            id: generateUUID(),
                            timestamp: Date.now(),
                            source: AgentType.VISUAL_CORTEX,
                            type: PacketType.VISUAL_PERCEPTION,
                            payload: {
                                status: "PERCEPTION_COMPLETE",
                                prompt: prompt,
                                perception_text: perception
                            },
                            priority: 0.9
                        });

                        addMessage('assistant', perception, 'visual', img);

                        MemoryService.storeMemory({
                            content: `ACTION: Generated Image of "${prompt}". PERCEPTION: ${perception}`,
                            emotionalContext: stateRef.current.limbicState,
                            timestamp: new Date().toISOString(),
                            imageData: img,
                            isVisualDream: true
                        });
                    }
                } catch (e) {
                    console.warn("Visual gen failed", e);
                }
            }
        }

        return cleanText;
    };

    const handleInput = async (input: string) => {
        addMessage('user', input);

        if (somaState.isSleeping) {
            setSomaState(prev => SomaSystem.forceWake(prev));
        }

        setIsProcessing(true);
        setSystemError(null);
        silenceStartRef.current = Date.now();

        try {
            setCurrentThought("Retrieving Engrams...");
            const contextMems = await MemoryService.semanticSearch(input);
            const contextStr = contextMems.map(m => `[MEMORY]: ${m.content}`).join('\n');

            setCurrentThought("Analyzing Semantics...");
            const analysis = await CortexService.assessInput(input, "silence");

            // LOG: Input Analysis
            eventBus.publish({
                id: generateUUID(),
                timestamp: Date.now(),
                source: AgentType.CORTEX_FLOW,
                type: PacketType.COGNITIVE_METRIC,
                payload: { ...analysis, context: "INPUT_ASSESSMENT" },
                priority: 0.5
            });

            // Apply emotional response to input using LimbicSystem
            setLimbicState(prev => {
                const newState = LimbicSystem.updateEmotionalState(prev, {
                    surprise: analysis.surprise
                });

                // LOG: State Update
                eventBus.publish({
                    id: generateUUID(),
                    timestamp: Date.now(),
                    source: AgentType.LIMBIC,
                    type: PacketType.STATE_UPDATE,
                    payload: newState,
                    priority: 0.2
                });

                return newState;
            });

            setCurrentThought("Synthesizing...");
            const response = await CortexService.generateResponse(
                input,
                contextStr,
                JSON.stringify(limbicState),
                analysis
            );

            const cleanSpeech = await processOutputForTools(response.text);

            addMessage('assistant', response.thought || "Processing logic...", 'thought');

            // Apply mood shift using LimbicSystem
            if (response.moodShift) {
                setLimbicState(prev => {
                    const withMoodShift = LimbicSystem.applyMoodShift(prev, response.moodShift);
                    // Also add satisfaction boost
                    return LimbicSystem.updateEmotionalState(withMoodShift, {
                        satisfaction_delta: 0.1
                    });
                });
            }

            await delay(500);

            if (cleanSpeech.trim()) {
                addMessage('assistant', cleanSpeech, 'speech');
            }

            await MemoryService.storeMemory({
                content: `User: ${input} | Agent: ${cleanSpeech}`,
                emotionalContext: limbicState,
                timestamp: new Date().toISOString(),
                id: generateUUID()
            });

            // Apply energy and cognitive load costs using SomaSystem
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

    // (Autonomy Loop Effect merged with Memory Link above)

    const toggleAutonomy = () => {
        setAutonomousMode(prev => {
            const newValue = !prev;
            if (!newValue) {
                eventBus.publish({
                    id: generateUUID(),
                    timestamp: Date.now(),
                    source: AgentType.CORTEX_FLOW,
                    type: PacketType.SYSTEM_ALERT,
                    payload: { status: "AUTONOMY_DISABLED", msg: "Cognitive Loop Terminated by User." },
                    priority: 1.0
                });
            }
            return newValue;
        });
    };
    const toggleSleep = () => setSomaState(prev => ({ ...prev, isSleeping: !prev.isSleeping }));
    const retryLastAction = () => { if (systemError) setSystemError(null); setIsProcessing(false); };

    // DEBUG: Inject State Override
    const injectStateOverride = (type: 'limbic' | 'soma', key: string, value: number) => {
        if (type === 'limbic') {
            setLimbicState(prev => LimbicSystem.setEmotionalValue(prev, key as keyof LimbicState, value));
        } else if (type === 'soma') {
            // Direct update for soma (no generic setter in SomaSystem)
            setSomaState(prev => ({ ...prev, [key]: Math.max(0, Math.min(100, value)) }));
        }
    };

    return {
        limbicState,
        somaState,
        resonanceField,
        autonomousMode,
        conversation,
        isProcessing,
        currentThought,
        systemError,
        handleInput,
        retryLastAction,
        toggleAutonomy,
        toggleSleep,
        injectStateOverride
    };
};
