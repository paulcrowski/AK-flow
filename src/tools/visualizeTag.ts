import { CortexService } from '../llm/gemini';
import { MemoryService } from '../services/supabase';
import { AgentType, PacketType } from '../types';
import type { ToolParserDeps } from './toolParser';
import { visualInFlight, scheduleSoftTimeout } from './toolRuntime';
import * as SomaSystem from '../core/systems/SomaSystem';
import * as LimbicSystem from '../core/systems/LimbicSystem';
import { VISUAL_BASE_COOLDOWN_MS } from '../core/constants';

function findVisualizeMatch(cleanText: string): { raw: string; prompt: string } | null {
  const direct = cleanText.match(/\[VISUALIZE:\s*([\s\S]*?)\]/i);
  if (direct) return { raw: direct[0], prompt: String(direct[1] || '').trim().replace(/\]$/, '') };

  const legacy = cleanText.match(/\[VISUALIZE\]\s*(.+)$/is);
  if (legacy) return { raw: legacy[0], prompt: String(legacy[1] || '').trim().replace(/\]$/, '') };

  const progressive = cleanText.match(/\[(Visualize|visualize|Visualizing|visualizing)\s+(.+?)\]/is);
  if (progressive) return { raw: progressive[0], prompt: String(progressive[2] || '').trim().replace(/\]$/, '') };

  return null;
}

function publishVisualError(params: {
  publish: (packet: any) => void;
  makeId: () => string;
  intentId: string;
  error: string;
}) {
  params.publish({
    id: params.makeId(),
    timestamp: Date.now(),
    source: AgentType.VISUAL_CORTEX,
    type: PacketType.TOOL_ERROR,
    payload: { tool: 'VISUALIZE', intentId: params.intentId, error: params.error },
    priority: 0.9
  });
}

function publishVisualResult(params: {
  publish: (packet: any) => void;
  makeId: () => string;
  intentId: string;
  hasImage: boolean;
  perceptionLength: number;
  late: boolean;
}) {
  params.publish({
    id: params.makeId(),
    timestamp: Date.now(),
    source: AgentType.VISUAL_CORTEX,
    type: PacketType.TOOL_RESULT,
    payload: {
      tool: 'VISUALIZE',
      intentId: params.intentId,
      hasImage: params.hasImage,
      perceptionLength: params.perceptionLength,
      late: params.late
    },
    priority: 0.8
  });
}

function startVisualOp(params: {
  prompt: string;
  intentId: string;
  deps: Pick<
    ToolParserDeps,
    'setCurrentThought' | 'addMessage' | 'setSomaState' | 'setLimbicState' | 'lastVisualTimestampRef' | 'visualBingeCountRef' | 'stateRef'
  >;
  makeId: () => string;
  publish: (packet: any) => void;
}) {
  const now = Date.now();
  const currentBinge = params.deps.visualBingeCountRef.current;

  params.deps.setCurrentThought(`Visualizing: ${params.prompt.substring(0, 30)}...`);
  params.deps.lastVisualTimestampRef.current = now;
  params.deps.visualBingeCountRef.current += 1;

  params.deps.setSomaState((prev) => {
    return SomaSystem.applyCognitiveLoad(prev, 15);
  });

  params.deps.setLimbicState((prev) => LimbicSystem.applyVisualEmotionalCost(prev, currentBinge));

  params.publish({
    id: params.makeId(),
    timestamp: Date.now(),
    source: AgentType.VISUAL_CORTEX,
    type: PacketType.VISUAL_THOUGHT,
    payload: { status: 'RENDERING', prompt: params.prompt },
    priority: 0.5
  });

  const promise = CortexService.generateVisualThought(params.prompt);
  const op = {
    promise,
    startedAt: Date.now(),
    intentIds: new Set<string>([params.intentId]),
    timeoutEmitted: new Set<string>(),
    settled: false
  };
  visualInFlight.set(params.prompt.toLowerCase(), op as any);

  void promise
    .then(async (img) => {
      op.settled = true;

      if (!img) {
        for (const id of op.intentIds) {
          publishVisualError({ publish: params.publish, makeId: params.makeId, intentId: id, error: 'Null image result' });
        }
        return;
      }

      const perception = await CortexService.analyzeVisualInput(img);

      for (const id of op.intentIds) {
        publishVisualResult({
          publish: params.publish,
          makeId: params.makeId,
          intentId: id,
          hasImage: true,
          perceptionLength: perception?.length || 0,
          late: op.timeoutEmitted.has(id)
        });
      }

      params.publish({
        id: params.makeId(),
        timestamp: Date.now(),
        source: AgentType.VISUAL_CORTEX,
        type: PacketType.VISUAL_PERCEPTION,
        payload: { status: 'PERCEPTION_COMPLETE', prompt: params.prompt, perception_text: perception },
        priority: 0.9
      });

      params.deps.addMessage('assistant', perception, 'visual', img);

      MemoryService.storeMemory({
        content: `ACTION: Generated Image of "${params.prompt}". PERCEPTION: ${perception}`,
        emotionalContext: params.deps.stateRef.current.limbicState,
        timestamp: new Date().toISOString(),
        imageData: img,
        isVisualDream: true
      });
    })
    .catch((e: any) => {
      op.settled = true;
      for (const id of op.intentIds) {
        publishVisualError({ publish: params.publish, makeId: params.makeId, intentId: id, error: e?.message || 'Unknown error' });
      }
    })
    .finally(() => {
      visualInFlight.delete(params.prompt.toLowerCase());
    });

  return op;
}

export async function consumeVisualizeTag(params: {
  cleanText: string;
  deps: Pick<
    ToolParserDeps,
    'setCurrentThought' | 'addMessage' | 'setSomaState' | 'setLimbicState' | 'lastVisualTimestampRef' | 'visualBingeCountRef' | 'stateRef'
  >;
  timeoutMs: number;
  makeId: () => string;
  publish: (packet: any) => void;
}): Promise<string> {
  const found = findVisualizeMatch(params.cleanText);
  if (!found) return params.cleanText;

  const prompt = found.prompt;
  let cleanText = params.cleanText.replace(found.raw, '').trim();

  params.deps.addMessage('assistant', `Invoking VISUALIZE for: "${prompt.substring(0, 50)}..."`, 'action');

  const now = Date.now();
  if (now - params.deps.lastVisualTimestampRef.current > VISUAL_BASE_COOLDOWN_MS * 10) {
    params.deps.visualBingeCountRef.current = 0;
  }

  const currentBinge = params.deps.visualBingeCountRef.current;
  const dynamicCooldown = VISUAL_BASE_COOLDOWN_MS * (currentBinge + 1);
  const timeSinceLast = now - params.deps.lastVisualTimestampRef.current;

  if (timeSinceLast < dynamicCooldown) {
    const distractions = [
      'System Alert: Sudden spike in entropy detected. Analyze logic structure instead.',
      'Data Stream Update: Reviewing recent memory coherence.',
      'Focus Shift: Analyzing linguistic patterns in user input.'
    ];
    const randomDistraction = distractions[Math.floor(Math.random() * distractions.length)];

    params.deps.addMessage(
      'assistant',
      `[VISUAL CORTEX REFRACTORY PERIOD ACTIVE - ${Math.ceil((dynamicCooldown - timeSinceLast) / 1000)}s REMAINING] ${randomDistraction}`,
      'thought'
    );

    params.publish({
      id: params.makeId(),
      timestamp: Date.now(),
      source: AgentType.CORTEX_FLOW,
      type: PacketType.SYSTEM_ALERT,
      payload: { msg: 'Visual Cortex Overload. Redirecting focus.' },
      priority: 0.2
    });

    return cleanText;
  }

  const intentId = params.makeId();
  params.publish({
    id: intentId,
    timestamp: Date.now(),
    source: AgentType.VISUAL_CORTEX,
    type: PacketType.TOOL_INTENT,
    payload: { tool: 'VISUALIZE', prompt: prompt.substring(0, 100) },
    priority: 0.8
  });

  const key = prompt.toLowerCase();
  let op = visualInFlight.get(key) as any;
  if (!op) {
    op = startVisualOp({ prompt, intentId, deps: params.deps, makeId: params.makeId, publish: params.publish });
  } else {
    op.intentIds.add(intentId);
  }

  scheduleSoftTimeout({
    op,
    intentId,
    tool: 'VISUALIZE',
    payload: { prompt: prompt.substring(0, 100) },
    timeoutMs: params.timeoutMs,
    makeId: params.makeId,
    publish: params.publish
  });

  return cleanText;
}
