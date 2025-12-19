import { eventBus } from '../core/EventBus';
import { CortexService } from '../services/gemini';
import { MemoryService } from '../services/supabase';
import { persistSearchKnowledgeChunk } from '../services/SearchKnowledgeChunker';
import { downloadLibraryDocumentText } from '../services/LibraryService';
import { safeParseJson, splitTodo3 } from './splitTodo3';
import { AgentType, PacketType } from '../types';
import { getCurrentTraceId } from '../core/trace/TraceContext';
import { generateUUID } from './uuid';
import * as SomaSystem from '../core/systems/SomaSystem';
import * as LimbicSystem from '../core/systems/LimbicSystem';
import { VISUAL_BASE_COOLDOWN_MS, VISUAL_ENERGY_COST_BASE } from '../core/constants';
import { consumeWorkspaceTags } from './workspaceTools';
import { scheduleSoftTimeout, searchInFlight, visualInFlight, withTimeout } from './toolRuntime';

// P0 13/10: Tool execution timeout (ms)
const TOOL_TIMEOUT_MS = (() => {
  const isTestEnv = typeof process !== 'undefined' && process.env.NODE_ENV === 'test';
  const defaultMs = isTestEnv ? 10000 : 20000;
  const raw = (import.meta as any)?.env?.VITE_TOOL_TIMEOUT_MS;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : defaultMs;
})();

export interface ToolParserDeps {
  setCurrentThought: (t: string) => void;
  addMessage: (role: 'user' | 'assistant', text: string, type?: 'thought' | 'speech' | 'visual' | 'intel' | 'action' | 'tool_result', imageData?: string, sources?: any[]) => void;
  setSomaState: (updater: (prev: any) => any) => void;
  setLimbicState: (updater: (prev: any) => any) => void;
  lastVisualTimestampRef: { current: number };
  visualBingeCountRef: { current: number };
  stateRef: { current: any };
  getActiveSessionId?: () => string | null | undefined;
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

    // 0.5 DETerministic JSON ACTION: SPLIT_TODO3
    // [SPLIT_TODO3: <documentId>]
    const splitMatch = cleanText.match(/\[SPLIT_TODO3:\s*([^\]]+?)\]/i);
    if (splitMatch) {
      const documentId = String(splitMatch[1] || '').trim();
      cleanText = cleanText.replace(splitMatch[0], '').trim();

      const tool = 'SPLIT_TODO3';
      const intentId = generateUUID();
      eventBus.publish({
        id: intentId,
        timestamp: Date.now(),
        source: AgentType.CORTEX_FLOW,
        type: PacketType.TOOL_INTENT,
        payload: { tool, arg: documentId },
        priority: 0.8
      });

      try {
        addMessage('assistant', `Invoking SPLIT_TODO3 for: ${documentId}`, 'action');
        setCurrentThought('Workspace split TODO → 3...');

        const res: any = await withTimeout<any>(downloadLibraryDocumentText({ documentId }) as any, TOOL_TIMEOUT_MS, tool);
        if (res.ok === false) throw new Error(res.error);

        const parsed = safeParseJson(String(res.text || ''));
        if (!parsed) throw new Error('JSON_PARSE_ERROR');

        const result = splitTodo3(parsed);
        const text = [
          `SPLIT_TODO3 ${documentId} (${res.doc.original_name}):`,
          `NOW=${result.now.length} NEXT=${result.next.length} LATER=${result.later.length}`,
          '',
          'NOW:',
          ...result.now.slice(0, 50).map((t: any, i: number) => `- ${String(t?.content || t?.id || i)}`),
          '',
          'NEXT:',
          ...result.next.slice(0, 50).map((t: any, i: number) => `- ${String(t?.content || t?.id || i)}`),
          '',
          'LATER:',
          ...result.later.slice(0, 50).map((t: any, i: number) => `- ${String(t?.content || t?.id || i)}`)
        ].join('\n');

        eventBus.publish({
          id: generateUUID(),
          timestamp: Date.now(),
          source: AgentType.CORTEX_FLOW,
          type: PacketType.TOOL_RESULT,
          payload: { tool, arg: documentId, intentId },
          priority: 0.8
        });

        addMessage('assistant', text, 'tool_result');
      } catch (error: any) {
        const msg = error?.message || String(error);
        const isTimeout = typeof msg === 'string' && msg.startsWith('TOOL_TIMEOUT:');
        eventBus.publish({
          id: generateUUID(),
          timestamp: Date.now(),
          source: AgentType.CORTEX_FLOW,
          type: isTimeout ? PacketType.TOOL_TIMEOUT : PacketType.TOOL_ERROR,
          payload: { tool, arg: documentId, intentId, error: msg },
          priority: 0.9
        });
        addMessage('assistant', `SPLIT_TODO3_${isTimeout ? 'TIMEOUT' : 'ERROR'}: ${documentId} :: ${msg}`, 'thought');
      }
    }

    // 0. WORKSPACE TOOLS (Library-backed)
    // [SEARCH_LIBRARY: query]
    // [READ_LIBRARY_CHUNK: <docId>#<chunkIndex>]
    // [READ_LIBRARY_DOC: <docId>]
    // Aliases:
    // [SEARCH_IN_REPO: query] -> SEARCH_LIBRARY
    // [READ_FILE: <docId>] -> READ_LIBRARY_DOC
    // [READ_FILE_CHUNK: <docId>#<chunkIndex>] -> READ_LIBRARY_CHUNK
    cleanText = await consumeWorkspaceTags({
      cleanText,
      deps: { setCurrentThought, addMessage },
      timeoutMs: TOOL_TIMEOUT_MS,
      makeId: generateUUID,
      publish: (packet) => eventBus.publish(packet)
    });

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

      const key = query.toLowerCase();
      let op = searchInFlight.get(key);

      if (!op) {
        addMessage('assistant', `Invoking SEARCH for: "${query}"`, 'action');
        setCurrentThought(`Researching: ${query}...`);

        const startedTraceId = getCurrentTraceId() ?? undefined;
        const startedSessionId = deps.getActiveSessionId?.() ?? undefined;

        const promise = CortexService.performDeepResearch(query, 'User requested data.');
        op = {
          promise,
          startedAt: Date.now(),
          intentIds: new Set<string>([intentId]),
          timeoutEmitted: new Set<string>(),
          settled: false,
          primaryIntentId: intentId,
          startedTraceId,
          startedSessionId
        };
        searchInFlight.set(key, op);

        void promise
          .then((research) => {
            op!.settled = true;

            if (!research || !research.synthesis) {
              for (const id of op!.intentIds) {
                eventBus.publish({
                  id: generateUUID(),
                  timestamp: Date.now(),
                  source: AgentType.CORTEX_FLOW,
                  type: PacketType.TOOL_ERROR,
                  payload: { tool: 'SEARCH', query, intentId: id, error: 'Empty result' },
                  priority: 0.9
                });
              }
              addMessage('assistant', 'Mój moduł SEARCH jest teraz wyłączony.', 'thought');
              return;
            }

            for (const id of op!.intentIds) {
              eventBus.publish({
                id: generateUUID(),
                timestamp: Date.now(),
                source: AgentType.CORTEX_FLOW,
                type: PacketType.TOOL_RESULT,
                payload: {
                  tool: 'SEARCH',
                  query,
                  intentId: id,
                  sourcesCount: research.sources?.length || 0,
                  synthesisLength: research.synthesis.length,
                  late: op!.timeoutEmitted.has(id)
                },
                priority: 0.8
              });
            }

            if (op!.timeoutEmitted.size > 0) {
              addMessage(
                'assistant',
                `SEARCH wynik dotarł po TIMEOUT (dołączony). query="${query}"`,
                'thought'
              );
            }

            addMessage('assistant', research.synthesis, 'intel', undefined, research.sources);

            // P0 v1.2: Persist SEARCH results as consolidated knowledge chunks (feature-flagged)
            void persistSearchKnowledgeChunk({
              query,
              synthesis: research.synthesis,
              sources: research.sources,
              traceId: op!.startedTraceId,
              sessionId: op!.startedSessionId,
              toolIntentId: op!.primaryIntentId
            });
          })
          .catch((error: any) => {
            op!.settled = true;
            console.warn('[ToolParser] Research failed:', error);

            for (const id of op!.intentIds) {
              eventBus.publish({
                id: generateUUID(),
                timestamp: Date.now(),
                source: AgentType.CORTEX_FLOW,
                type: PacketType.TOOL_ERROR,
                payload: {
                  tool: 'SEARCH',
                  query,
                  intentId: id,
                  error: error?.message || 'Unknown error'
                },
                priority: 0.9
              });
            }

            addMessage('assistant', 'Mój moduł SEARCH jest teraz wyłączony.', 'thought');
          })
          .finally(() => {
            searchInFlight.delete(key);
          });
      } else {
        op.intentIds.add(intentId);
      }
      scheduleSoftTimeout({
        op,
        intentId,
        tool: 'SEARCH',
        payload: { query },
        timeoutMs: TOOL_TIMEOUT_MS,
        makeId: generateUUID,
        publish: (packet) => eventBus.publish(packet)
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

        const key = prompt.toLowerCase();
        let op = visualInFlight.get(key);

        if (!op) {
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

          const promise = CortexService.generateVisualThought(prompt);
          op = {
            promise,
            startedAt: Date.now(),
            intentIds: new Set<string>([intentId]),
            timeoutEmitted: new Set<string>(),
            settled: false
          };
          visualInFlight.set(key, op);

          void promise
            .then(async (img) => {
              op!.settled = true;

              if (!img) {
                for (const id of op!.intentIds) {
                  eventBus.publish({
                    id: generateUUID(),
                    timestamp: Date.now(),
                    source: AgentType.VISUAL_CORTEX,
                    type: PacketType.TOOL_ERROR,
                    payload: { tool: 'VISUALIZE', intentId: id, error: 'Null image result' },
                    priority: 0.9
                  });
                }
                return;
              }

              const perception = await CortexService.analyzeVisualInput(img);

              for (const id of op!.intentIds) {
                eventBus.publish({
                  id: generateUUID(),
                  timestamp: Date.now(),
                  source: AgentType.VISUAL_CORTEX,
                  type: PacketType.TOOL_RESULT,
                  payload: {
                    tool: 'VISUALIZE',
                    intentId: id,
                    hasImage: true,
                    perceptionLength: perception?.length || 0,
                    late: op!.timeoutEmitted.has(id)
                  },
                  priority: 0.8
                });
              }

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
            })
            .catch((e: any) => {
              op!.settled = true;
              console.warn('Visual gen failed', e);

              for (const id of op!.intentIds) {
                eventBus.publish({
                  id: generateUUID(),
                  timestamp: Date.now(),
                  source: AgentType.VISUAL_CORTEX,
                  type: PacketType.TOOL_ERROR,
                  payload: {
                    tool: 'VISUALIZE',
                    intentId: id,
                    error: e?.message || 'Unknown error'
                  },
                  priority: 0.9
                });
              }
            })
            .finally(() => {
              visualInFlight.delete(key);
            });
        } else {
          op.intentIds.add(intentId);
        }
        scheduleSoftTimeout({
          op,
          intentId,
          tool: 'VISUALIZE',
          payload: { prompt: prompt.substring(0, 100) },
          timeoutMs: TOOL_TIMEOUT_MS,
          makeId: generateUUID,
          publish: (packet) => eventBus.publish(packet)
        });
      }
    }

    return cleanText;
  };
};
