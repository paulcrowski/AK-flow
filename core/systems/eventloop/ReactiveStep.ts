import { isMainFeatureEnabled } from '../../config/featureFlags';
import { CortexService } from '../../../services/gemini';
import { TickCommitter } from '../TickCommitter';
import { LimbicSystem } from '../LimbicSystem';
import { CortexSystem } from '../CortexSystem';
import { useArtifactStore } from '../../../stores/artifactStore';

// P0.1 COMMIT 3: Action-First Policy
// Feature flag - can be disabled if causing issues
const ACTION_FIRST_ENABLED = true;

type ActionFirstResult = {
  handled: boolean;
  action?: string;
  target?: string;
  assumption?: string;
};

function updateContextAfterAction(ctx: any): void {
  const now = Date.now();
  ctx.silenceStart = now;
  ctx.lastSpeakTimestamp = now;
  ctx.goalState.lastUserInteractionAt = now;
  ctx.consecutiveAgentSpeeches = 0;
  ctx.hadExternalRewardThisTick = true;
  ctx.ticksSinceLastReward = 0;
}

function detectActionableIntent(input: string): ActionFirstResult {
  const lower = input.toLowerCase().trim();
  
  // CREATE patterns: "stwórz plik X", "create file X", "napisz X", "write X"
  const createMatch = lower.match(/(?:stwórz|utwórz|create|napisz|write|zrób)\s+(?:plik\s+)?([^\s,]+(?:\.[a-z]+)?)/i);
  if (createMatch) {
    return { handled: true, action: 'CREATE', target: createMatch[1] };
  }
  
  // APPEND patterns: "dodaj do X", "append to X", "dopisz do X"
  const appendMatch = lower.match(/(?:dodaj|dopisz|append|add)\s+(?:do|to)\s+([^\s,]+)/i);
  if (appendMatch) {
    return { handled: true, action: 'APPEND', target: appendMatch[1] };
  }
  
  // READ patterns: "pokaż X", "read X", "otwórz X", "open X"
  const readMatch = lower.match(/(?:pokaż|pokaz|read|otwórz|otworz|open|wyświetl|wyswietl|show)\s+([^\s,]+)/i);
  if (readMatch) {
    return { handled: true, action: 'READ', target: readMatch[1] };
  }
  
  return { handled: false };
}

export type TraceLike = {
  traceId: string;
  tickNumber: number;
  agentId: string | null;
};

export type ReactiveCallbacksLike = {
  onMessage: (role: string, text: string, type: any, meta?: any) => void;
  onThought: (thought: string) => void;
  onLimbicUpdate: (limbic: any) => void;
};

export async function runReactiveStep(input: {
  ctx: any;
  userInput: string;
  callbacks: ReactiveCallbacksLike;
  memorySpace: any;
  trace: TraceLike;
}): Promise<void> {
  const { ctx, userInput, callbacks, memorySpace, trace } = input;

  TickCommitter.markUserInput();

  // P0.1: Action-First - execute tool commands immediately without asking
  if (ACTION_FIRST_ENABLED) {
    const actionIntent = detectActionableIntent(userInput);
    if (actionIntent.handled && actionIntent.action && actionIntent.target) {
      const store = useArtifactStore.getState();
      const target = actionIntent.target;
      
      try {
        if (actionIntent.action === 'CREATE') {
          const id = store.create(target, '');
          callbacks.onMessage('assistant', `Utworzyłem ${target} (${id}). Poprawić coś?`, 'speech');
          updateContextAfterAction(ctx);
          return;
        }
        
        if (actionIntent.action === 'READ') {
          const byName = store.getByName(target);
          if (byName.length === 1) {
            const art = byName[0];
            callbacks.onMessage('assistant', `${art.name}:\n\n${art.content || '(pusty)'}`, 'speech');
            updateContextAfterAction(ctx);
            return;
          } else if (target.startsWith('art-')) {
            const art = store.get(target);
            if (art) {
              callbacks.onMessage('assistant', `${art.name}:\n\n${art.content || '(pusty)'}`, 'speech');
              updateContextAfterAction(ctx);
              return;
            }
          }
          // Not found - fall through to LLM
        }
        
        if (actionIntent.action === 'APPEND') {
          const byName = store.getByName(target);
          if (byName.length === 1) {
            // Found artifact, but need content from user - fall through to LLM
            // LLM will generate content to append
          }
          // Fall through to LLM for content generation
        }
      } catch (e) {
        // Action failed, fall through to normal processing
        callbacks.onThought(`[ACTION_FIRST_ERROR] ${(e as Error)?.message || 'unknown'}`);
      }
    }
  }

  const prefetchedMemories = isMainFeatureEnabled('ONE_MIND_ENABLED')
    ? ((await memorySpace.hot.semanticSearch(userInput)) as any)
    : undefined;

  const result = await CortexSystem.processUserMessage({
    text: userInput,
    currentLimbic: ctx.limbic,
    currentSoma: ctx.soma,
    conversationHistory: ctx.conversation,
    identity: ctx.agentIdentity,
    sessionOverlay: ctx.sessionOverlay,
    memorySpace,
    prefetchedMemories
  });

  const intent = await CortexService.detectIntent(userInput);

  if (intent.style === 'POETIC') {
    ctx.poeticMode = true;
    console.log('Intent Detected: POETIC MODE ENABLED');
  } else if (intent.style === 'SIMPLE') {
    ctx.poeticMode = false;
    console.log('Intent Detected: POETIC MODE DISABLED (Simple Style Requested)');
  } else if (intent.style === 'ACADEMIC') {
    ctx.poeticMode = false;
  }

  if (result.moodShift) {
    ctx.limbic = LimbicSystem.applyMoodShift(ctx.limbic, result.moodShift);
    callbacks.onLimbicUpdate(ctx.limbic);
  }

  if (result.internalThought) {
    callbacks.onMessage('assistant', result.internalThought, 'thought');
  }

  if (isMainFeatureEnabled('ONE_MIND_ENABLED') && trace.agentId) {
    try {
      const commit = TickCommitter.commitSpeech({
        agentId: trace.agentId,
        traceId: trace.traceId,
        tickNumber: trace.tickNumber,
        origin: 'reactive',
        speechText: result.responseText
      });

      if (commit.committed) {
        callbacks.onMessage('assistant', result.responseText, 'speech', {
          knowledgeSource: result.knowledgeSource,
          evidenceSource: result.evidenceSource,
          evidenceDetail: result.evidenceDetail,
          generator: result.generator
        });
      } else {
        callbacks.onThought(`[REACTIVE_SUPPRESSED] ${commit.blockReason || 'UNKNOWN'}`);
      }
    } catch (e) {
      callbacks.onThought(`[REACTIVE_COMMIT_ERROR] ${(e as Error)?.message || 'unknown'}`);
      callbacks.onMessage('assistant', result.responseText, 'speech', {
        knowledgeSource: result.knowledgeSource,
        evidenceSource: result.evidenceSource,
        evidenceDetail: result.evidenceDetail,
        generator: result.generator
      });
    }
  } else {
    callbacks.onMessage('assistant', result.responseText, 'speech', {
      knowledgeSource: result.knowledgeSource,
      evidenceSource: result.evidenceSource,
      evidenceDetail: result.evidenceDetail,
      generator: result.generator
    });
  }

  const now = Date.now();
  ctx.silenceStart = now;
  ctx.lastSpeakTimestamp = now;
  ctx.goalState.lastUserInteractionAt = now;

  ctx.consecutiveAgentSpeeches = 0;

  ctx.hadExternalRewardThisTick = true;
  ctx.ticksSinceLastReward = 0;
}
