import { eventBus } from '../core/EventBus';
import { CortexService } from '../services/gemini';
import { MemoryService } from '../services/supabase';
import { AgentType, PacketType } from '../types';
import { generateUUID } from './uuid';
import * as SomaSystem from '../core/systems/SomaSystem';
import * as LimbicSystem from '../core/systems/LimbicSystem';
import { VISUAL_BASE_COOLDOWN_MS, VISUAL_ENERGY_COST_BASE } from '../core/constants';

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

      // TAGGED COGNITION: Log MY_ACTION before tool invocation
      addMessage('assistant', `Invoking SEARCH for: "${query}"`, 'action');
      setCurrentThought(`Researching: ${query}...`);
      
      let research;
      try {
        research = await CortexService.performDeepResearch(query, 'User requested data.');
      } catch (error) {
        console.warn('[ToolParser] Research failed:', error);
        research = null;
      }

      if (!research) {
        addMessage('assistant', 'Mój moduł SEARCH jest teraz wyłączony.', 'thought');
        return cleanText;
      }

      // TAGGED COGNITION: Tool result is separate from action
      addMessage('assistant', research.synthesis, 'tool_result', undefined, research.sources);

      eventBus.publish({
        id: generateUUID(),
        timestamp: Date.now(),
        source: AgentType.CORTEX_FLOW,
        type: PacketType.FIELD_UPDATE,
        payload: { action: 'DEEP_RESEARCH_COMPLETE', topic: query, found_sources: research.sources },
        priority: 0.8
      });
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
          const img = await CortexService.generateVisualThought(prompt);
          if (img) {
            const perception = await CortexService.analyzeVisualInput(img);

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
          }
        } catch (e) {
          console.warn('Visual gen failed', e);
        }
      }
    }

    return cleanText;
  };
};
