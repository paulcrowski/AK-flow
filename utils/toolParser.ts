import { eventBus } from '../core/EventBus';
import { CortexService } from '../services/gemini';
import { MemoryService } from '../services/supabase';
import { AgentType, PacketType } from '../types';
import { generateUUID } from './uuid';
import * as SomaSystem from '../core/systems/SomaSystem';
import * as LimbicSystem from '../core/systems/LimbicSystem';
import { VISUAL_BASE_COOLDOWN_MS, VISUAL_ENERGY_COST_BASE } from '../core/constants';

// P0 13/10: Tool execution timeout (ms)
const TOOL_TIMEOUT_MS = 10000;

// Helper: wrap async operation with timeout
const withTimeout = <T>(promise: Promise<T>, ms: number, toolName: string): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`TOOL_TIMEOUT: ${toolName} exceeded ${ms}ms`)), ms)
    )
  ]);
};

export interface ToolParserDeps {
  setCurrentThought: (t: string) => void;
  addMessage: (role: 'user' | 'assistant', text: string, type?: 'thought' | 'speech' | 'visual' | 'intel' | 'action' | 'tool_result', imageData?: string, sources?: any[]) => void;
  setSomaState: (updater: (prev: any) => any) => void;
  setLimbicState: (updater: (prev: any) => any) => void;
  lastVisualTimestampRef: { current: number };
  visualBingeCountRef: { current: number };
  stateRef: { current: any };
}

export const createProcessOutputForTools = (deps: ToolParserDeps) => {
  const {
    setCurrentThought,
    addMessage,
    setSomaState,
    setLimbicState,
    lastVisualTimestampRef,
    visualBingeCountRef,
    stateRef
  } = deps;

  return async function processOutputForTools(rawText: string): Promise<string> {
    let cleanText = rawText;

    // 1. SEARCH TAG
    let searchMatch = cleanText.match(/\[SEARCH:\s*(.*?)\]/i);
    if (!searchMatch) {
      const legacySearch = cleanText.match(/\[SEARCH\]\s*(?:for\s*)?:?\s*(.+)$/i);
      if (legacySearch) {
        searchMatch = [legacySearch[0], legacySearch[1]] as any;
      }
    }

    if (searchMatch) {
      const query = searchMatch[1].trim();
      cleanText = cleanText.replace(searchMatch[0], '').trim();
      const intentId = generateUUID();

      // P0: TOOL_INTENT event
      eventBus.publish({
        id: intentId,
        timestamp: Date.now(),
        source: AgentType.CORTEX_FLOW,
        type: PacketType.TOOL_INTENT,
        payload: { tool: 'SEARCH', query },
        priority: 0.8
      });

      addMessage('assistant', `Invoking SEARCH for: "${query}"`, 'action');
      setCurrentThought(`Researching: ${query}...`);
      
      let research;
      try {
        research = await withTimeout(
          CortexService.performDeepResearch(query, 'User requested data.'),
          TOOL_TIMEOUT_MS,
          'SEARCH'
        );
      } catch (error: any) {
        const isTimeout = error?.message?.includes('TOOL_TIMEOUT');
        console.warn('[ToolParser] Research failed:', error);
        
        // P0: TOOL_ERROR or TOOL_TIMEOUT event
        eventBus.publish({
          id: generateUUID(),
          timestamp: Date.now(),
          source: AgentType.CORTEX_FLOW,
          type: isTimeout ? PacketType.TOOL_TIMEOUT : PacketType.TOOL_ERROR,
          payload: { 
            tool: 'SEARCH', 
            query, 
            intentId,
            error: error?.message || 'Unknown error'
          },
          priority: 0.9
        });
        
        addMessage('assistant', isTimeout 
          ? `SEARCH timeout po ${TOOL_TIMEOUT_MS/1000}s - spróbuję później.`
          : 'Mój moduł SEARCH jest teraz wyłączony.', 'thought');
        return cleanText;
      }

      if (!research || !research.synthesis) {
        eventBus.publish({
          id: generateUUID(),
          timestamp: Date.now(),
          source: AgentType.CORTEX_FLOW,
          type: PacketType.TOOL_ERROR,
          payload: { tool: 'SEARCH', query, intentId, error: 'Empty result' },
          priority: 0.9
        });
        addMessage('assistant', 'Mój moduł SEARCH jest teraz wyłączony.', 'thought');
        return cleanText;
      }

      // P0: TOOL_RESULT event
      eventBus.publish({
        id: generateUUID(),
        timestamp: Date.now(),
        source: AgentType.CORTEX_FLOW,
        type: PacketType.TOOL_RESULT,
        payload: { 
          tool: 'SEARCH', 
          query, 
          intentId,
          sourcesCount: research.sources?.length || 0,
          synthesisLength: research.synthesis.length
        },
        priority: 0.8
      });

      addMessage('assistant', research.synthesis, 'intel', undefined, research.sources);
    }

    // 2. VISUAL TAG
    let visualMatch = cleanText.match(/\[VISUALIZE:\s*([\s\S]*?)\]/i);
    if (!visualMatch) {
      const legacyVisual = cleanText.match(/\[VISUALIZE\]\s*(.+)$/is);
      if (legacyVisual) {
        visualMatch = [legacyVisual[0], legacyVisual[1]] as any;
      }
    }
    if (!visualMatch) {
      const progressiveVisual = cleanText.match(/\[(Visualize|visualize|Visualizing|visualizing)\s+(.+?)\]/is);
      if (progressiveVisual) {
        visualMatch = [progressiveVisual[0], progressiveVisual[2]] as any;
      }
    }

    if (visualMatch) {
      let prompt = visualMatch[1].trim();
      if (prompt.endsWith(']')) prompt = prompt.slice(0, -1);

      console.log('Visual Tag Detected:', prompt);

      // TAGGED COGNITION: Log MY_ACTION before tool invocation
      addMessage('assistant', `Invoking VISUALIZE for: "${prompt.substring(0, 50)}..."`, 'action');
      cleanText = cleanText.replace(visualMatch[0], '').trim();

      const now = Date.now();
      if (now - lastVisualTimestampRef.current > VISUAL_BASE_COOLDOWN_MS * 10) {
        visualBingeCountRef.current = 0;
      }

      const currentBinge = visualBingeCountRef.current;
      const dynamicCooldown = VISUAL_BASE_COOLDOWN_MS * (currentBinge + 1);
      const timeSinceLast = now - lastVisualTimestampRef.current;

      if (timeSinceLast < dynamicCooldown) {
        const remainingSec = Math.ceil((dynamicCooldown - timeSinceLast) / 1000);
        const distractions = [
          'System Alert: Sudden spike in entropy detected. Analyze logic structure instead.',
          'Data Stream Update: Reviewing recent memory coherence.',
          'Focus Shift: Analyzing linguistic patterns in user input.'
        ];
        const randomDistraction = distractions[Math.floor(Math.random() * distractions.length)];

        addMessage(
          'assistant',
          `[VISUAL CORTEX REFRACTORY PERIOD ACTIVE - ${remainingSec}s REMAINING] ${randomDistraction}`,
          'thought'
        );

        eventBus.publish({
          id: generateUUID(),
          timestamp: Date.now(),
          source: AgentType.CORTEX_FLOW,
          type: PacketType.SYSTEM_ALERT,
          payload: { msg: 'Visual Cortex Overload. Redirecting focus.' },
          priority: 0.2
        });

        return cleanText;
      } else {
        const intentId = generateUUID();
        
        // P0: TOOL_INTENT event
        eventBus.publish({
          id: intentId,
          timestamp: Date.now(),
          source: AgentType.VISUAL_CORTEX,
          type: PacketType.TOOL_INTENT,
          payload: { tool: 'VISUALIZE', prompt: prompt.substring(0, 100) },
          priority: 0.8
        });

        setCurrentThought(`Visualizing: ${prompt.substring(0, 30)}...`);
        lastVisualTimestampRef.current = now;
        visualBingeCountRef.current += 1;

        const energyCost = VISUAL_ENERGY_COST_BASE * (currentBinge + 1);

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
          payload: { status: 'RENDERING', prompt },
          priority: 0.5
        });

        try {
          const img = await withTimeout(
            CortexService.generateVisualThought(prompt),
            TOOL_TIMEOUT_MS,
            'VISUALIZE'
          );
          
          if (img) {
            const perception = await CortexService.analyzeVisualInput(img);

            // P0: TOOL_RESULT event
            eventBus.publish({
              id: generateUUID(),
              timestamp: Date.now(),
              source: AgentType.VISUAL_CORTEX,
              type: PacketType.TOOL_RESULT,
              payload: {
                tool: 'VISUALIZE',
                intentId,
                hasImage: true,
                perceptionLength: perception?.length || 0
              },
              priority: 0.8
            });

            eventBus.publish({
              id: generateUUID(),
              timestamp: Date.now(),
              source: AgentType.VISUAL_CORTEX,
              type: PacketType.VISUAL_PERCEPTION,
              payload: {
                status: 'PERCEPTION_COMPLETE',
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
          } else {
            // P0: TOOL_ERROR - null result
            eventBus.publish({
              id: generateUUID(),
              timestamp: Date.now(),
              source: AgentType.VISUAL_CORTEX,
              type: PacketType.TOOL_ERROR,
              payload: { tool: 'VISUALIZE', intentId, error: 'Null image result' },
              priority: 0.9
            });
          }
        } catch (e: any) {
          const isTimeout = e?.message?.includes('TOOL_TIMEOUT');
          console.warn('Visual gen failed', e);
          
          // P0: TOOL_ERROR or TOOL_TIMEOUT
          eventBus.publish({
            id: generateUUID(),
            timestamp: Date.now(),
            source: AgentType.VISUAL_CORTEX,
            type: isTimeout ? PacketType.TOOL_TIMEOUT : PacketType.TOOL_ERROR,
            payload: { 
              tool: 'VISUALIZE', 
              intentId, 
              error: e?.message || 'Unknown error' 
            },
            priority: 0.9
          });
          
          if (isTimeout) {
            addMessage('assistant', `VISUALIZE timeout po ${TOOL_TIMEOUT_MS/1000}s.`, 'thought');
          }
        }
      }
    }

    return cleanText;
  };
};
