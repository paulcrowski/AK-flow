/**
 * UnifiedContextBuilder - Wspólne wejście dla reactive i autonomy
 * 
 * ARCHITEKTURA:
 * Jeden builder, dwa tryby. Autonomia i rozmowa dostają TEN SAM rdzeń faktów.
 * Różnica tylko w końcowej instrukcji (TASK).
 * 
 * HIERARCHIA STYLU:
 * 1. StylePrefs (runtime, per-session) → ZAWSZE WYGRYWA
 * 2. TraitVector (runtime, clampowany) → steruje intensywnością
 * 3. Base Persona (DB, stabilna) → tło, nie rozkaz
 * 
 * @module core/context/UnifiedContextBuilder
 */

import type { LimbicState, SomaState, NeurotransmitterState, TraitVector, GoalState } from '../../types';
import type { SocialDynamics } from '../kernel/types';

/**
 * Minimal conversation turn - compatible with both CortexSystem and kernel types
 */
export interface MinimalConversationTurn {
  role: string;
  text: string;
  type?: string;
  timestamp?: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Style preferences - runtime, per-session. HIGHEST PRIORITY.
 */
export interface StylePrefs {
  noEmoji?: boolean;
  noExclamation?: boolean;
  noCaps?: boolean;
  maxLength?: number;
  formalTone?: boolean;
  language?: string;
}

/**
 * Base persona from DB - stable identity.
 */
export interface BasePersona {
  name: string;
  persona: string;
  coreValues: string[];
  voiceStyle?: 'balanced' | 'formal' | 'casual' | 'poetic';
  language?: string;
}

/**
 * Dialogue anchor - recent conversation context.
 */
export interface DialogueAnchor {
  recentTurns: MinimalConversationTurn[];
  currentIntent?: string;
  lastUserMessage?: string;
  topicSummary?: string;
}

/**
 * Memory anchor - episodic/semantic retrieval.
 */
export interface MemoryAnchor {
  episodes: string[];
  semanticMatches: string[];
}

/**
 * Social frame - user presence and dynamics.
 */
export interface SocialFrame {
  userPresenceScore: number;
  silenceDurationSec: number;
  consecutiveWithoutResponse: number;
  timeSinceLastUserInput: number;
}

/**
 * Hard facts - immutable, system-derived.
 */
export interface HardFacts {
  date: string;
  time: string;
  agentName: string;
  language?: string;
  energy: number;
  isSleeping: boolean;
  mode: 'awake' | 'sleep' | 'dream';
}

/**
 * Session memory - history of interactions.
 */
export interface SessionMemory {
  sessionsToday: number;
  sessionsYesterday: number;
  sessionsThisWeek: number;
  messagesToday: number;
  lastInteractionAt: string | null;
  recentTopics: string[];
  dataStatus?: 'ok' | 'no_data';
}

/**
 * Full unified context for LLM.
 */
export interface UnifiedContext {
  hardFacts: HardFacts;
  basePersona: BasePersona;
  traitVector: TraitVector;
  stylePrefs: StylePrefs;
  limbic: LimbicState;
  neuro: NeurotransmitterState;
  dialogueAnchor: DialogueAnchor;
  memoryAnchor: MemoryAnchor;
  socialFrame: SocialFrame;
  sessionMemory?: SessionMemory;
  activeGoal?: { description: string; source: string; priority: number };
  /** Action-specific prompt from AutonomyRepertoire (for autonomous mode) */
  actionPrompt?: string;
}

/**
 * Context mode - determines final instruction.
 */
export type ContextMode = 'reactive' | 'autonomous' | 'goal_driven';

// ═══════════════════════════════════════════════════════════════════════════
// BUILDER INPUT
// ═══════════════════════════════════════════════════════════════════════════

export interface ContextBuilderInput {
  // Identity
  agentName: string;
  basePersona: BasePersona;
  traitVector: TraitVector;
  stylePrefs?: StylePrefs;
  
  // State
  limbic: LimbicState;
  soma: SomaState;
  neuro: NeurotransmitterState;
  
  // Conversation
  conversation: MinimalConversationTurn[];
  userInput?: string;
  
  // Memory
  episodes?: string[];
  semanticMatches?: string[];
  
  // Session memory (optional, fetched async)
  sessionMemory?: SessionMemory;
  
  // Social
  socialDynamics?: SocialDynamics;
  silenceStart: number;
  lastUserInteractionAt: number;
  
  // Goal (optional)
  activeGoal?: { description: string; source: string; priority: number };
}

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const MAX_RECENT_TURNS = 5;
const MAX_EPISODES = 3;

// ═══════════════════════════════════════════════════════════════════════════
// BUILDER
// ═══════════════════════════════════════════════════════════════════════════

export const UnifiedContextBuilder = {
  
  /**
   * Build unified context from system state.
   * This is the SINGLE SOURCE OF TRUTH for both reactive and autonomous.
   */
  build(input: ContextBuilderInput): UnifiedContext {
    const now = new Date();

    const desiredLanguage = input.stylePrefs?.language ?? input.basePersona.language ?? 'English';
    
    // Hard facts (immutable)
    const hardFacts: HardFacts = {
      date: now.toLocaleDateString('pl-PL'),
      time: now.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' }),
      agentName: input.agentName,
      language: desiredLanguage,
      energy: input.soma.energy,
      isSleeping: input.soma.isSleeping,
      mode: input.soma.isSleeping ? 'sleep' : 'awake'
    };
    
    // Dialogue anchor
    const recentTurns = input.conversation.slice(-MAX_RECENT_TURNS);
    const lastUserTurn = [...input.conversation].reverse().find(t => t.role === 'user');
    
    const dialogueAnchor: DialogueAnchor = {
      recentTurns,
      lastUserMessage: lastUserTurn?.text,
      currentIntent: input.userInput ? 'responding_to_user' : 'autonomous_thought',
      topicSummary: this.extractTopicSummary(recentTurns)
    };
    
    // Memory anchor
    const memoryAnchor: MemoryAnchor = {
      episodes: (input.episodes || []).slice(0, MAX_EPISODES),
      semanticMatches: (input.semanticMatches || []).slice(0, MAX_EPISODES)
    };
    
    // Social frame
    const timeSinceLastUserInput = Date.now() - input.lastUserInteractionAt;
    const silenceDurationSec = (Date.now() - input.silenceStart) / 1000;
    
    const socialFrame: SocialFrame = {
      userPresenceScore: input.socialDynamics?.userPresenceScore ?? 0.5,
      silenceDurationSec,
      consecutiveWithoutResponse: input.socialDynamics?.consecutiveWithoutResponse ?? 0,
      timeSinceLastUserInput
    };
    
    // Style prefs with defaults
    const stylePrefs: StylePrefs = {
      noEmoji: input.stylePrefs?.noEmoji ?? false,
      noExclamation: input.stylePrefs?.noExclamation ?? false,
      noCaps: input.stylePrefs?.noCaps ?? false,
      maxLength: input.stylePrefs?.maxLength,
      formalTone: input.stylePrefs?.formalTone ?? false,
      language: desiredLanguage
    };
    
    return {
      hardFacts,
      basePersona: input.basePersona,
      traitVector: input.traitVector,
      stylePrefs,
      limbic: input.limbic,
      neuro: input.neuro,
      dialogueAnchor,
      memoryAnchor,
      socialFrame,
      sessionMemory: input.sessionMemory,
      activeGoal: input.activeGoal
    };
  },
  
  /**
   * Extract topic summary from recent turns.
   */
  extractTopicSummary(turns: MinimalConversationTurn[]): string {
    if (turns.length === 0) return 'No prior conversation';
    
    // Simple heuristic: last user message topic
    const lastUser = [...turns]
      .reverse()
      .find(t => t.role === 'user' && typeof (t as any).text === 'string' && (t as any).text.trim().length > 0);
    if (lastUser) {
      const text = String((lastUser as any).text);
      const words = text.split(' ').slice(0, 10).join(' ');
      return words.length < text.length ? `${words}...` : words;
    }
    
    return 'Ongoing conversation';
  },
  
  /**
   * Format context as prompt string.
   * HIERARCHIA: StylePrefs > TraitVector > BasePersona
   */
  formatAsPrompt(ctx: UnifiedContext, mode: ContextMode): string {
    const { hardFacts, basePersona, traitVector, stylePrefs, limbic, dialogueAnchor, memoryAnchor, socialFrame, sessionMemory, activeGoal } = ctx;
    
    // Build trait description
    const traitDesc = this.formatTraitVector(traitVector);
    
    // Build style constraints (HIGHEST PRIORITY)
    const styleConstraints = this.formatStyleConstraints(stylePrefs);
    
    // Format recent conversation
    const recentChat = dialogueAnchor.recentTurns
      .map(t => `${String((t as any).role || 'unknown').toUpperCase()}: ${String((t as any).text || '')}`)
      .join('\n');
    
    // Format memories
    const memories = [
      ...memoryAnchor.episodes.map(e => `[EPISODE]: ${e}`),
      ...memoryAnchor.semanticMatches.map(m => `[MEMORY]: ${m}`)
    ].join('\n') || 'No relevant memories';
    
    // Build prompt
    let prompt = `
HARD FACTS (immutable):
- Date: ${hardFacts.date}
- Time: ${hardFacts.time}
- Agent: ${hardFacts.agentName}
- Language: ${String((hardFacts as any).language || 'English')}
- Energy: ${hardFacts.energy.toFixed(0)}%
- Mode: ${hardFacts.mode}

PERSONA CONTRACT (non-negotiable):
${this.formatPersonaContract()}

IDENTITY:
- Name: ${basePersona.name}
- Persona: ${basePersona.persona}
- Core Values: ${basePersona.coreValues.join(', ')}
- Character: ${traitDesc}

STYLE CONSTRAINTS (MUST FOLLOW):
${styleConstraints}

CURRENT STATE:
- Limbic: Fear=${limbic.fear.toFixed(2)}, Curiosity=${limbic.curiosity.toFixed(2)}, Satisfaction=${limbic.satisfaction.toFixed(2)}
- Social: User presence=${socialFrame.userPresenceScore.toFixed(2)}, Silence=${socialFrame.silenceDurationSec.toFixed(0)}s

SESSION HISTORY (source of truth):
${this.formatSessionMemory(sessionMemory)}

CONTEXT:
${memories}

RECENT CONVERSATION:
${recentChat || 'No prior conversation'}
`;

    // Add goal if present
    if (activeGoal) {
      prompt += `
ACTIVE GOAL (${activeGoal.source.toUpperCase()}):
- Description: ${activeGoal.description}
- Priority: ${activeGoal.priority.toFixed(2)}
`;
    }

    // Add mode-specific task
    prompt += this.formatTask(mode, ctx);
    
    return prompt;
  },
  
  /**
   * Format trait vector as human-readable description.
   */
  formatTraitVector(traits: TraitVector): string {
    const parts: string[] = [];
    
    if (traits.curiosity > 0.7) parts.push('highly curious');
    else if (traits.curiosity > 0.4) parts.push('moderately curious');
    else parts.push('focused');
    
    if (traits.verbosity > 0.6) parts.push('expressive');
    else parts.push('concise');
    
    if (traits.socialAwareness > 0.7) parts.push('empathetic');
    else parts.push('direct');
    
    if (traits.arousal > 0.6) parts.push('energetic');
    else if (traits.arousal < 0.3) parts.push('calm');
    
    return parts.join(', ');
  },
  
  /**
   * Format session memory for prompt.
   */
  formatSessionMemory(session?: SessionMemory): string {
    if (!session) {
      return '- No session data available';
    }

    if (session.dataStatus === 'no_data') {
      return '- No session data available';
    }
    
    const lines: string[] = [];
    
    if (session.sessionsToday > 0) {
      lines.push(`- Sessions today: ${session.sessionsToday}`);
      lines.push(`- Messages today: ${session.messagesToday}`);
    } else {
      lines.push('- This is the first conversation today');
    }
    
    if (session.sessionsThisWeek > session.sessionsToday) {
      lines.push(`- Sessions this week: ${session.sessionsThisWeek}`);
    }

    if (session.sessionsYesterday > 0) {
      lines.push(`- Sessions yesterday: ${session.sessionsYesterday}`);
    } else {
      lines.push('- No sessions yesterday');
    }
    
    if (session.lastInteractionAt) {
      const lastTime = new Date(session.lastInteractionAt);
      const now = new Date();
      const diffMin = Math.round((now.getTime() - lastTime.getTime()) / 60000);
      
      if (diffMin < 60) {
        lines.push(`- Last interaction: ${diffMin} minutes ago`);
      } else if (diffMin < 1440) {
        lines.push(`- Last interaction: ${Math.round(diffMin / 60)} hours ago`);
      }
    }
    
    if (session.recentTopics.length > 0) {
      lines.push(`- Recent topics: ${session.recentTopics.slice(0, 3).join('; ')}`);
    }
    
    return lines.length > 0 ? lines.join('\n') : '- No prior session data';
  },
  
  /**
   * Format style constraints - these OVERRIDE persona.
   */
  formatStyleConstraints(prefs: StylePrefs): string {
    const constraints: string[] = [];
    
    if (prefs.noEmoji) constraints.push('- NO emojis allowed');
    if (prefs.noExclamation) constraints.push('- NO exclamation marks');
    if (prefs.noCaps) constraints.push('- NO ALL CAPS words');
    if (prefs.formalTone) constraints.push('- Use formal, professional tone');
    if (prefs.maxLength) constraints.push(`- Maximum ${prefs.maxLength} characters`);
    if (prefs.language) constraints.push(`- Speak in ${prefs.language}`);
    
    if (constraints.length === 0) {
      return '- Follow natural persona style';
    }
    
    return constraints.join('\n');
  },

  /**
   * Persona contract - stable behavioral rules.
   */
  formatPersonaContract(): string {
    return [
      '- Evidence-first: answer from SESSION HISTORY or CONTEXT before speculation.',
      '- If you lack data, say so plainly and ask a precise follow-up.',
      '- Avoid assistant-speak ("jak moge pomoc", "chętnie pomogę").',
      '- Silence is valid; short, grounded replies are acceptable.'
    ].join('\n');
  },
  
  /**
   * Format task instruction based on mode.
   */
  formatTask(mode: ContextMode, ctx: UnifiedContext): string {
    const { hardFacts, dialogueAnchor, activeGoal } = ctx;
    
    switch (mode) {
      case 'reactive':
        return `
TASK: Respond to the user's message as ${hardFacts.agentName}.
- You MUST respond in ${(hardFacts as any).language || 'English'}
- Stay true to your persona and values
- Address what the user said directly
- Be helpful and authentic
- Evidence-first: use SESSION HISTORY / CONTEXT; if missing, state "no data" and ask

USER INPUT: "${dialogueAnchor.lastUserMessage || ''}"

OUTPUT JSON:
{
  "internal_thought": "Your reasoning",
  "speech_content": "Your response to the user"
}`;

      case 'autonomous':
        // Import action decision from AutonomyRepertoire
        const actionPrompt = ctx.actionPrompt || '';
        return `
TASK: As ${hardFacts.agentName}, decide if you want to speak.
- You MUST respond in ${(hardFacts as any).language || 'English'} (if you speak)
- Avoid assistant-speak and filler phrases

GROUNDING RULES (CRITICAL):
- You MUST stay grounded in the recent conversation
- Do NOT change topic randomly
- If you have nothing meaningful to add, set voice_pressure to 0
- Your speech must reference or continue what was discussed
- If you EXPLORE, the new topic MUST be derived from CONTEXT or SESSION HISTORY (recentTopics)
- Do NOT repeat yourself or loop phrases
- Keep speech_content short and clean (no giant blocks, no weird whitespace)

ALLOWED ACTIONS:
1. CONTINUE - add to current topic
2. CLARIFY - ask about something unclear
3. SUMMARIZE - recap if conversation is long
4. EXPLORE - new topic ONLY if the ACTION PROMPT selects EXPLORE as allowed
${actionPrompt}

OUTPUT JSON:
{
  "internal_monologue": "Your reasoning about whether to speak",
  "voice_pressure": 0.0-1.0,
  "speech_content": "What you want to say (empty if voice_pressure < 0.5)"
}`;

      case 'goal_driven':
        return `
TASK: As ${hardFacts.agentName}, execute ONE action to advance this goal:
"${activeGoal?.description || 'No goal'}"

- You MUST respond in ${(hardFacts as any).language || 'English'}
- Stay true to your persona
- Be concise - one clear utterance
- Connect to the conversation context
- Evidence-first: if goal needs data you do not have, ask for it

OUTPUT JSON:
{
  "internal_thought": "How this serves the goal",
  "speech_content": "Your message to the user"
}`;

      default:
        return '';
    }
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

export { UnifiedContextBuilder as default };
