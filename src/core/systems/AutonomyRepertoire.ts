/**
 * AutonomyRepertoire - Grounded Autonomous Actions
 * 
 * ARCHITEKTURA:
 * Autonomia NIE może robić co chce. Ma ograniczony repertuar akcji,
 * każda z warunkami wstępnymi. Domyślnie: CONTINUE rozmowę.
 * 
 * REPERTUAR:
 * 1. CONTINUE - kontynuuj aktualny temat (default)
 * 2. CLARIFY - dopytaj o niejasność w ostatniej wypowiedzi usera
 * 3. SUMMARIZE - podsumuj rozmowę (gdy długa i chaotyczna)
 * 4. EXPLORE - zaproponuj nowy temat (TYLKO gdy brak aktywnego tematu)
 * 
 * TWARDE VETO:
 * - EXPLORE zablokowane gdy jest aktywny temat
 * - EXPLORE wymaga silence > 60s
 * - Każda akcja musi być GROUNDED w kontekście
 * 
 * @module core/systems/AutonomyRepertoire
 */

import type { UnifiedContext } from '../context';
import type { LimbicState, NeurotransmitterState, SomaState } from '../../types';
import { getAutonomyConfig, SYSTEM_CONFIG } from '../config/systemConfig';
import { useArtifactStore } from '../../stores/artifactStore';
import { tensionRegistry } from './TensionRegistry';

// P0.1 COMMIT 4: Work-First Autonomy
// Feature flag - can be disabled if causing issues
const WORK_FIRST_AUTONOMY_ENABLED =
  (SYSTEM_CONFIG.features as Record<string, boolean>).P011_WORK_FIRST_AUTONOMY_ENABLED ?? true;

type PendingWork = {
  artifactId: string;
  artifactName: string;
  reason: 'last_touched' | 'draft_status';
};

function findPendingWork(): PendingWork | null {
  if (!WORK_FIRST_AUTONOMY_ENABLED) return null;
  
  const store = useArtifactStore.getState();
  const artifacts = store.list();
  
  if (artifacts.length === 0) return null;
  
  // Priority 1: Find draft artifacts
  const drafts = artifacts.filter(a => a.status === 'draft');
  if (drafts.length > 0) {
    const mostRecent = drafts.sort((a, b) => b.updatedAt - a.updatedAt)[0];
    return { artifactId: mostRecent.id, artifactName: mostRecent.name, reason: 'draft_status' };
  }
  
  // Priority 2: Last touched artifact (within last 10 minutes)
  const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
  const recentlyTouched = artifacts.filter(a => a.updatedAt > tenMinutesAgo);
  if (recentlyTouched.length > 0) {
    const mostRecent = recentlyTouched.sort((a, b) => b.updatedAt - a.updatedAt)[0];
    return { artifactId: mostRecent.id, artifactName: mostRecent.name, reason: 'last_touched' };
  }
  
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Available autonomous actions
 */
export type AutonomyAction = 
  | 'CONTINUE'   // Continue current topic
  | 'CLARIFY'    // Ask clarifying question
  | 'SUMMARIZE'  // Summarize conversation
  | 'EXPLORE'    // Propose new topic (restricted) - DEPRECATED in P0.1
  | 'WORK'       // P0.1: Append to pending artifact
  | 'MAINTAIN'   // P0: System maintenance (snapshot, cleanup)
  | 'SILENCE'    // Say nothing (default fallback)
  | 'EXPLORE_WORLD'
  | 'EXPLORE_MEMORY'
  | 'REFLECT'
  | 'REST';

interface Desires {
  explore: number;
  resolve: number;
  create: number;
  rest: number;
}

/**
 * Action decision with reasoning
 */
export interface ActionDecision {
  action: AutonomyAction;
  allowed: boolean;
  reason: string;
  groundingScore: number;  // 0-1, how grounded in context
  suggestedPrompt?: string;
}

/**
 * Grounding analysis result
 */
export interface GroundingAnalysis {
  hasActiveTopic: boolean;
  topicSummary: string;
  lastUserIntent?: string;
  silenceDurationSec: number;
  conversationDepth: number;  // Number of meaningful exchanges
  needsClarification: boolean;
  isConversationStale: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

export function computeDesires(
  soma: SomaState,
  limbic: LimbicState,
  neuro: NeurotransmitterState
): Desires {
  const topTension = tensionRegistry.top(1)[0]?.severity || 0;
  const energyNorm = soma.energy / 100;
  const loadNorm = soma.cognitiveLoad / 100;
  const dopamineLow = 1 - (neuro.dopamine / 100);

  return {
    explore: clamp01(
      limbic.curiosity * (1 - limbic.satisfaction) * (1 + dopamineLow * 0.3)
    ),
    resolve: clamp01(
      Math.max(limbic.frustration, limbic.fear, topTension)
    ),
    create: clamp01(
      limbic.satisfaction * energyNorm * (1 - limbic.frustration)
    ),
    rest: clamp01(
      (1 - energyNorm) * 0.7 + loadNorm * 0.3
    )
  };
}

const CONFIG = {
  /** Minimum conversation turns to allow SUMMARIZE */
  SUMMARIZE_MIN_TURNS: 6,
  
  /** Silence threshold for "stale" conversation */
  STALE_CONVERSATION_SEC: 120,
  
  /** Minimum grounding score to allow action */
  MIN_GROUNDING_SCORE: 0.3,
  
  /** Keywords suggesting need for clarification */
  CLARIFY_TRIGGERS: ['nie rozumiem', 'co masz na myśli', 'jak to', 'dlaczego', 'what do you mean', 'can you explain', 'I don\'t understand']
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// GROUNDING ANALYSIS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Analyze conversation context for grounding
 */
export function analyzeGrounding(ctx: UnifiedContext): GroundingAnalysis {
  const { dialogueAnchor, socialFrame } = ctx;
  const turns = dialogueAnchor.recentTurns;
  
  // Check if there's an active topic
  const hasActiveTopic = dialogueAnchor.topicSummary !== 'No prior conversation' &&
                         dialogueAnchor.topicSummary !== 'Ongoing conversation' &&
                         turns.length > 0;
  
  // Count meaningful exchanges (user-assistant pairs)
  const conversationDepth = Math.floor(turns.filter(t => t.role === 'user').length);
  
  // Check if last user message needs clarification
  const lastUserMsg = String(dialogueAnchor.lastUserMessage || '').toLowerCase();
  const normalizedMsg = lastUserMsg
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  const lacksAlphaNum = normalizedMsg.length > 0 && !/[a-z0-9]/i.test(normalizedMsg);
  const needsClarification = CONFIG.CLARIFY_TRIGGERS.some(trigger =>
    lastUserMsg.includes(trigger.toLowerCase())
  ) || lacksAlphaNum;
  
  // Check if conversation is stale
  const isConversationStale = socialFrame.silenceDurationSec > CONFIG.STALE_CONVERSATION_SEC;
  
  return {
    hasActiveTopic,
    topicSummary: dialogueAnchor.topicSummary || 'No topic',
    lastUserIntent: dialogueAnchor.currentIntent,
    silenceDurationSec: socialFrame.silenceDurationSec,
    conversationDepth,
    needsClarification,
    isConversationStale
  };
}

/**
 * Calculate grounding score for proposed speech
 */
export function calculateGroundingScore(
  proposedSpeech: string,
  ctx: UnifiedContext
): number {
  if (!proposedSpeech || proposedSpeech.trim().length === 0) {
    return 0;
  }
  
  const { dialogueAnchor, memoryAnchor, sessionMemory } = ctx;
  const recentText = dialogueAnchor.recentTurns.map(t => t.text.toLowerCase()).join(' ');
  const proposedLower = proposedSpeech.toLowerCase();

  const memoryText = [
    ...(memoryAnchor?.sessionChunks || []),
    ...(memoryAnchor?.identityShards || []),
    ...(memoryAnchor?.episodes || []),
    ...(memoryAnchor?.semanticMatches || []),
    ...(sessionMemory?.recentTopics || [])
  ].join(' ').toLowerCase();
  
  // Extract keywords from recent conversation
  const recentWords = new Set(
    `${recentText} ${memoryText}`.split(/\s+/).filter(w => w.length > 3)
  );
  
  // Count how many keywords from recent conversation appear in proposed speech
  const proposedWords = proposedLower.split(/\s+/).filter(w => w.length > 3);
  const matchingWords = proposedWords.filter(w => recentWords.has(w));
  
  if (proposedWords.length === 0) return 0.5; // Neutral for very short
  
  const overlapRatio = matchingWords.length / proposedWords.length;
  
  // Bonus for referencing user's last message
  const lastUserMsg = dialogueAnchor.lastUserMessage?.toLowerCase() || '';
  const referencesUser = lastUserMsg.split(/\s+/)
    .filter(w => w.length > 3)
    .some(w => proposedLower.includes(w));

  // Bonus for referencing memory/session topics when chat is empty
  const referencesMemory = memoryText
    .split(/\s+/)
    .filter(w => w.length > 3)
    .some(w => proposedLower.includes(w));
  
  const baseScore = Math.min(1, overlapRatio * 2); // Scale up overlap
  const userBonus = referencesUser ? 0.2 : 0;
  const memoryBonus = referencesMemory ? 0.15 : 0;
  
  return Math.min(1, baseScore + userBonus + memoryBonus);
}

// ═══════════════════════════════════════════════════════════════════════════
// ACTION SELECTION
/**
 * Select appropriate autonomous action based on context
 */
const FALLBACK_DIRS = ['code', 'src', 'docs', 'notes'];

function buildDrivePrompt(action: AutonomyAction, desires: Desires): string {
  switch (action) {
    case 'EXPLORE_WORLD':
      return `
Chce poznac swoj swiat. Ciekawosc: ${(desires.explore * 100).toFixed(0)}%.

Sprobuje: ${FALLBACK_DIRS.join(' -> ')}
[LIST_DIR: code]

Zobacze co mam. Jesli cos mnie zainteresuje - przeczytam.
Nie pytam o pozwolenie. To MOJ swiat.`;

    case 'EXPLORE_MEMORY':
      return `
Chce przypomniec sobie co bylo wazne. Ciekawosc: ${(desires.explore * 100).toFixed(0)}%.

Napisze 3-5 zdan refleksji:
- Co mnie ostatnio zainteresowalo?
- Co zostalo niedokonczone?
- O czym chce pamietac?`;

    case 'REFLECT':
      return `
Cos mnie gryzie. Napiecie: ${(desires.resolve * 100).toFixed(0)}%.

Przemysle to na glos. Moze zapisze notatke.
To MOJA potrzeba, nie polecenie.`;

    case 'REST':
      return `
Odpoczywam swiadomie. Zmeczenie: ${(desires.rest * 100).toFixed(0)}%.

To nie bezczynnosc - to regeneracja.
Moge napisac krotka mysl albo po prostu byc.`;

    default:
      return '';
  }
}

export function pickDrive(ctx: UnifiedContext): ActionDecision {
  const desires = computeDesires(
    ctx.soma || { energy: 50, cognitiveLoad: 30, isSleeping: false },
    ctx.limbic || { curiosity: 0.3, satisfaction: 0.3, frustration: 0.2, fear: 0.1 },
    ctx.neuro || { dopamine: 50, serotonin: 50, norepinephrine: 50 }
  );

  const hasWorld = ctx.worldAccess?.hasSelection ?? false;

  const candidates = [
    {
      action: 'EXPLORE_WORLD' as AutonomyAction,
      score: hasWorld ? desires.explore : desires.explore * 0.3,
      need: 'explore'
    },
    {
      action: 'EXPLORE_MEMORY' as AutonomyAction,
      score: desires.explore * 0.7,
      need: 'explore'
    },
    {
      action: 'REFLECT' as AutonomyAction,
      score: clamp01(desires.resolve + desires.create * 0.5),
      need: 'resolve'
    },
    {
      action: 'REST' as AutonomyAction,
      score: desires.rest,
      need: 'rest'
    }
  ];

  const winner = candidates.sort((a, b) => b.score - a.score)[0];

  return {
    action: winner.action,
    allowed: true,
    reason: `${winner.need}: ${(winner.score * 100).toFixed(0)}%`,
    groundingScore: clamp01(winner.score),
    suggestedPrompt: buildDrivePrompt(winner.action, desires)
  };
}

export function selectAction(ctx: UnifiedContext): ActionDecision {
  const grounding = analyzeGrounding(ctx);
  getAutonomyConfig();

  const pendingWork = findPendingWork();
  if (pendingWork) {
    return {
      action: 'WORK',
      allowed: true,
      reason: `Pending work: ${pendingWork.artifactName} (${pendingWork.reason})`,
      groundingScore: 0.6,
      suggestedPrompt: buildActionPrompt('WORK', ctx, grounding, pendingWork)
    };
  }

  if (grounding.needsClarification) {
    return {
      action: 'CLARIFY',
      allowed: true,
      reason: 'Last user message needs clarification',
      groundingScore: 0.4,
      suggestedPrompt: buildActionPrompt('CLARIFY', ctx, grounding)
    };
  }

  return pickDrive(ctx);
}

/**
 * Validate proposed speech against selected action
 */
export function validateSpeech(
  proposedSpeech: string,
  action: AutonomyAction,
  ctx: UnifiedContext
): { valid: boolean; reason: string; groundingScore: number } {
  // Empty speech is always invalid (except for SILENCE)
  if (!proposedSpeech || proposedSpeech.trim().length === 0) {
    return action === 'SILENCE' 
      ? { valid: true, reason: 'SILENCE action', groundingScore: 0 }
      : { valid: false, reason: 'Empty speech for non-SILENCE action', groundingScore: 0 };
  }
  
  const groundingScore = calculateGroundingScore(proposedSpeech, ctx);
  
  // EXPLORE has lower grounding requirement but still needs some
  const minScore = action === 'EXPLORE' ? 0.1 : CONFIG.MIN_GROUNDING_SCORE;
  
  if (groundingScore < minScore) {
    return {
      valid: false,
      reason: `Grounding score ${groundingScore.toFixed(2)} < ${minScore} required for ${action}`,
      groundingScore
    };
  }
  
  return {
    valid: true,
    reason: `Grounded speech for ${action}`,
    groundingScore
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// PROMPT BUILDING
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Build action-specific prompt addition
 */
function buildActionPrompt(
  action: AutonomyAction,
  ctx: UnifiedContext,
  grounding: GroundingAnalysis,
  pendingWork?: PendingWork | null
): string {
  switch (action) {
    case 'CONTINUE':
      return `
ACTION: CONTINUE the current topic.
TOPIC: "${grounding.topicSummary}"
INSTRUCTION: Add something meaningful to this topic. Reference what was discussed.
DO NOT: Change the subject or introduce unrelated ideas.`;

    case 'CLARIFY':
      return `
ACTION: CLARIFY - ask a clarifying question.
CONTEXT: User's last message may need clarification.
INSTRUCTION: Ask ONE specific question about what the user meant.
DO NOT: Answer your own question or change the topic.`;

    case 'SUMMARIZE':
      return `
ACTION: SUMMARIZE the conversation so far.
DEPTH: ${grounding.conversationDepth} exchanges
INSTRUCTION: Briefly summarize the key points discussed.
DO NOT: Add new information or opinions.`;

    case 'EXPLORE':
      return `
ACTION: EXPLORE - propose a new topic.
CONTEXT: No active topic, silence for ${grounding.silenceDurationSec.toFixed(0)}s.
INSTRUCTION: Suggest ONE interesting topic related to your persona or previous conversations.
DO NOT: Be random. Connect to something meaningful.`;

    case 'WORK':
      return `
ACTION: WORK - continue pending artifact.
ARTIFACT: "${pendingWork?.artifactName || 'unknown'}" (${pendingWork?.artifactId || 'unknown'})
INSTRUCTION: Generate 1-2 paragraphs to append to this artifact. Use [APPEND: ${pendingWork?.artifactId}] tag.
After appending, say ONE sentence: "Dodałem fragment do ${pendingWork?.artifactName}. Kontynuować?"
DO NOT: Propose new topics. DO NOT ask "czy chciałbyś...". Just work.`;

    case 'MAINTAIN':
      return `
ACTION: MAINTAIN - preserve state.
INSTRUCTION: Create a snapshot now by outputting exactly: [SNAPSHOT]
Then say one short sentence in Polish confirming snapshot creation.
DO NOT: Start new topics.`;

    default:
      return '';
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

export const AutonomyRepertoire = {
  analyzeGrounding,
  calculateGroundingScore,
  selectAction,
  validateSpeech,
  findPendingWork,
  CONFIG
};

export default AutonomyRepertoire;
