
import { useState, useEffect, useRef, useCallback } from 'react';
import { eventBus } from '../core/EventBus';
import { CortexService } from '../services/gemini';
import { MemoryService } from '../services/supabase';
import { AgentType, PacketType, LimbicState, SomaState, CognitiveError, ResonanceField } from '../types';

// Constants
const MIN_TICK_MS = 1000; // Fast tick for UI responsiveness
const MAX_TICK_MS = 15000; 
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
    curiosity: 0.3, // LOWERED from 0.8: Start calm to prioritize memory over visuals
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
  
  const [conversation, setConversation] = useState<{role: string, text: string, type?: 'thought' | 'speech' | 'visual' | 'intel', imageData?: string, sources?: any[]}[]>([]);
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

  // --- BOOT SEQUENCE: MEMORY INJECTION ---
  useEffect(() => {
      if (hasBootedRef.current) return;
      hasBootedRef.current = true;

      const performBootRecall = async () => {
          try {
              setCurrentThought("Accessing Hippocampus...");
              const memories = await MemoryService.recallRecent(3);
              
              if (memories && memories.length > 0) {
                  // Format memories into a single context block
                  const memoryBlock = memories.map(m => `[Trace ${new Date(m.timestamp).toLocaleTimeString()}]: ${m.content}`).join('\n');
                  
                  // Inject directly into conversation so LLM sees it as context
                  setConversation(prev => [
                      ...prev, 
                      { 
                          role: 'assistant', 
                          text: `SYSTEM: Semantic Link Established. Recent Engrams Restored:\n${memoryBlock}`, 
                          type: 'thought' 
                      }
                  ]);

                  eventBus.publish({
                      id: crypto.randomUUID(),
                      timestamp: Date.now(),
                      source: AgentType.MEMORY_EPISODIC,
                      type: PacketType.THOUGHT_CANDIDATE,
                      payload: { internal_monologue: "I remember my previous state." },
                      priority: 1.0
                  });
              } else {
                  setConversation(prev => [
                      ...prev, 
                      { 
                          role: 'assistant', 
                          text: `SYSTEM: Tabula Rasa. No previous engrams found.`, 
                          type: 'thought' 
                      }
                  ]);
              }
              setCurrentThought("Idle");
          } catch (e) {
              console.error("Boot Recall Failed", e);
          }
      };

      // Slight delay to allow UI to mount
      setTimeout(performBootRecall, 500);

  }, []);


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
              id: crypto.randomUUID(),
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
                  id: crypto.randomUUID(),
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
              const satisfactionGain = 0.2 / (currentBinge + 1);

              setSomaState(prev => ({
                  ...prev,
                  energy: Math.max(0, prev.energy - energyCost),
                  cognitiveLoad: Math.min(100, prev.cognitiveLoad + 15)
              }));
              
              setLimbicState(prev => ({ 
                  ...prev, 
                  satisfaction: Math.min(1, prev.satisfaction + satisfactionGain),
                  curiosity: Math.max(0.1, prev.curiosity - 0.5) 
              }));

              eventBus.publish({
                  id: crypto.randomUUID(),
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
                          id: crypto.randomUUID(),
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
        setSomaState(prev => ({ ...prev, isSleeping: false }));
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
        
        setLimbicState(prev => ({ 
            ...prev, 
            fear: Math.max(0, Math.min(1, prev.fear + (analysis.surprise * 0.1))),
            curiosity: Math.min(1, prev.curiosity + (analysis.surprise * 0.2))
        }));

        setCurrentThought("Synthesizing...");
        const response = await CortexService.generateResponse(
            input, 
            contextStr, 
            JSON.stringify(limbicState), 
            analysis
        );

        const cleanSpeech = await processOutputForTools(response.text);

        addMessage('assistant', response.thought || "Processing logic...", 'thought');
        
        if (response.moodShift) {
            setLimbicState(prev => ({
                ...prev,
                fear: Math.max(0, Math.min(1, prev.fear + (response.moodShift.fear_delta || 0))),
                curiosity: Math.max(0, Math.min(1, prev.curiosity + (response.moodShift.curiosity_delta || 0))),
                satisfaction: Math.max(0, Math.min(1, prev.satisfaction + 0.1))
            }));
        }

        await delay(500);
        
        if (cleanSpeech.trim()) {
            addMessage('assistant', cleanSpeech, 'speech');
        }

        await MemoryService.storeMemory({
            content: `User: ${input} | Agent: ${cleanSpeech}`,
            emotionalContext: limbicState,
            timestamp: new Date().toISOString(),
            id: crypto.randomUUID()
        });
        
        setSomaState(prev => ({
            ...prev,
            energy: Math.max(0, prev.energy - 2),
            cognitiveLoad: Math.min(100, prev.cognitiveLoad + 10)
        }));

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

  // --- COGNITIVE LOOP ---
  const cognitiveCycle = useCallback(async () => {
    if (!isLoopRunning.current) return;
    const currentState = stateRef.current;
    
    // METABOLISM
    setSomaState(prev => {
        let newEnergy = prev.energy;
        let newLoad = Math.max(0, prev.cognitiveLoad - 1);

        if (prev.isSleeping) {
            newEnergy = Math.min(100, prev.energy + 10); 
            // REM Sleep Visuals (Only if battery > 50)
            if (Math.random() > 0.85 && !isProcessing && currentState.autonomousMode && prev.energy > 50) {
                 eventBus.publish({
                    id: crypto.randomUUID(),
                    timestamp: Date.now(),
                    source: AgentType.VISUAL_CORTEX,
                    type: PacketType.THOUGHT_CANDIDATE,
                    payload: { internal_monologue: `REM Cycle: Dreaming...` },
                    priority: 0.1
                 });
            }
        } else {
            newEnergy = Math.max(0, prev.energy - 0.05); 
        }
        
        if (newEnergy < 5 && !prev.isSleeping) {
             eventBus.publish({
                id: crypto.randomUUID(),
                timestamp: Date.now(),
                source: AgentType.SOMA,
                type: PacketType.SYSTEM_ALERT,
                payload: { msg: "BATTERY LOW. INITIATING EMERGENCY SLEEP." },
                priority: 1.0
             });
             return { ...prev, isSleeping: true, energy: newEnergy, cognitiveLoad: newLoad };
        }
        if (prev.isSleeping && newEnergy >= 100) {
             return { ...prev, isSleeping: false, energy: 100, cognitiveLoad: 0 };
        }
        return { ...prev, energy: newEnergy, cognitiveLoad: newLoad };
    });

    // VOLITION
    const silenceDuration = (Date.now() - silenceStartRef.current) / 1000;
    const canThink = !currentState.somaState.isSleeping && currentState.autonomousMode && !isProcessing;
    
    if (canThink && silenceDuration > 5) {
        setIsProcessing(true);
        setCurrentThought("Drifting...");
        
        try {
            const historyText = currentState.conversation.slice(-3).map(m => m.text).join('\n') || "Silence...";
            
            // Curiosity builds with silence
            if (silenceDuration > 20) {
                setLimbicState(prev => ({ ...prev, curiosity: Math.min(1, prev.curiosity + 0.05) }));
            }

            const volition = await CortexService.autonomousVolition(
                JSON.stringify(currentState.limbicState),
                "Latent processing...",
                historyText,
                silenceDuration
            );

            eventBus.publish({
                id: crypto.randomUUID(),
                timestamp: Date.now(),
                source: AgentType.CORTEX_FLOW,
                type: PacketType.THOUGHT_CANDIDATE,
                payload: volition,
                priority: volition.voice_pressure || 0
            });

            const monologueOutput = await processOutputForTools(volition.internal_monologue);
            const speechOutput = await processOutputForTools(volition.speech_content);

            if ((volition.voice_pressure || 0) > 0.75 && speechOutput.trim()) {
                addMessage('assistant', speechOutput, 'speech');
                silenceStartRef.current = Date.now();
                setLimbicState(prev => ({ ...prev, curiosity: Math.max(0.2, prev.curiosity - 0.2), satisfaction: Math.min(1, prev.satisfaction + 0.1) }));
            }
            
        } catch (e) {
             // Volition errors are silent
        } finally {
            setIsProcessing(false);
            setCurrentThought("Idle");
        }
    }

    let nextTick = currentState.somaState.isSleeping ? 1000 : (currentState.autonomousMode ? 2000 : 3000);
    timeoutRef.current = setTimeout(cognitiveCycle, nextTick);

  }, [isProcessing]); 

  useEffect(() => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      isLoopRunning.current = true;
      cognitiveCycle();
      return () => {
          isLoopRunning.current = false;
          if (timeoutRef.current) clearTimeout(timeoutRef.current);
      };
  }, [cognitiveCycle]);

  const toggleAutonomy = () => setAutonomousMode(prev => !prev);
  const toggleSleep = () => setSomaState(prev => ({ ...prev, isSleeping: !prev.isSleeping }));
  const retryLastAction = () => { if (systemError) setSystemError(null); setIsProcessing(false); };

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
    toggleSleep
  };
};
