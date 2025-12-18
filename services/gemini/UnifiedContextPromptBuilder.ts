import type { ContextMode, UnifiedContext } from '../../core/context';
import { PromptComposer } from './PromptComposer';

export type UnifiedContextPromptBudgets = {
  contextMaxChars?: number;
  recentChatMaxChars?: number;
  sessionMemoryMaxChars?: number;
  taskMaxChars?: number;
};

const DEFAULT_BUDGETS: Required<UnifiedContextPromptBudgets> = {
  contextMaxChars: 8000,
  recentChatMaxChars: 6000,
  sessionMemoryMaxChars: 2000,
  taskMaxChars: 2500
};

function formatRecentChat(ctx: UnifiedContext): string {
  const turns = ctx.dialogueAnchor?.recentTurns ?? [];
  return turns.map((t) => `${String((t as any).role || 'unknown').toUpperCase()}: ${String((t as any).text || '')}`).join('\n');
}

function formatMemories(ctx: UnifiedContext): string {
  const episodes = ctx.memoryAnchor?.episodes ?? [];
  const matches = ctx.memoryAnchor?.semanticMatches ?? [];
  const lines = [...episodes.map((e) => `[EPISODE]: ${e}`), ...matches.map((m) => `[MEMORY]: ${m}`)];
  return lines.join('\n') || 'No relevant memories';
}

function formatStyleConstraints(ctx: UnifiedContext): string {
  const prefs = ctx.stylePrefs || {};
  const constraints: string[] = [];

  if (prefs.noEmoji) constraints.push('- NO emojis allowed');
  if (prefs.noExclamation) constraints.push('- NO exclamation marks');
  if (prefs.noCaps) constraints.push('- NO ALL CAPS words');
  if (prefs.formalTone) constraints.push('- Use formal, professional tone');
  if (prefs.maxLength) constraints.push(`- Maximum ${prefs.maxLength} characters`);
  if (prefs.language) constraints.push(`- Speak in ${prefs.language}`);

  return constraints.length === 0 ? '- Follow natural persona style' : constraints.join('\n');
}

function formatSessionMemory(ctx: UnifiedContext): string {
  const session = ctx.sessionMemory;
  if (!session) return '- No session data available';

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

  if (session.lastInteractionAt) {
    const lastTime = new Date(session.lastInteractionAt);
    const now = new Date();
    const diffMin = Math.round((now.getTime() - lastTime.getTime()) / 60000);

    if (diffMin < 60) lines.push(`- Last interaction: ${diffMin} minutes ago`);
    else if (diffMin < 1440) lines.push(`- Last interaction: ${Math.round(diffMin / 60)} hours ago`);
  }

  if (Array.isArray(session.recentTopics) && session.recentTopics.length > 0) {
    lines.push(`- Recent topics: ${session.recentTopics.slice(0, 3).join('; ')}`);
  }

  return lines.length > 0 ? lines.join('\n') : '- No prior session data';
}

function formatTask(ctx: UnifiedContext, mode: ContextMode): string {
  const language = String(ctx.hardFacts?.language || 'English');
  const agentName = String(ctx.hardFacts?.agentName || 'AK-FLOW');
  const lastUserMessage = String(ctx.dialogueAnchor?.lastUserMessage || '');

  if (mode === 'autonomous') {
    const actionPrompt = ctx.actionPrompt || '';
    return `
TASK: As ${agentName}, decide if you want to speak.
- You MUST respond in ${language} (if you speak)

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
  }

  if (mode === 'goal_driven') {
    const goal = ctx.activeGoal?.description || 'No goal';
    return `
TASK: As ${agentName}, execute ONE action to advance this goal:
"${goal}"

- You MUST respond in ${language}
- Stay true to your persona
- Be concise - one clear utterance
- Connect to the conversation context

OUTPUT JSON:
{
  "internal_thought": "How this serves the goal",
  "speech_content": "Your message to the user"
}`;
  }

  return `
TASK: Respond to the user's message as ${agentName}.
- You MUST respond in ${language}
- Stay true to your persona and values
- Address what the user said directly
- Be helpful and authentic

USER INPUT: "${lastUserMessage}"

OUTPUT JSON:
{
  "internal_thought": "Your reasoning",
  "speech_content": "Your response to the user"
}`;
}

export const UnifiedContextPromptBuilder = {
  build(ctx: UnifiedContext, mode: ContextMode, budgets?: UnifiedContextPromptBudgets): string {
    const b = { ...DEFAULT_BUDGETS, ...(budgets || {}) };

    const hardFacts = ctx.hardFacts;
    const basePersona = ctx.basePersona;

    const hardFactsBlock = PromptComposer.section('HARD FACTS (immutable)', [
      `- Date: ${hardFacts.date}`,
      `- Time: ${hardFacts.time}`,
      `- Agent: ${hardFacts.agentName}`,
      `- Language: ${String((hardFacts as any).language || 'English')}`,
      `- Energy: ${hardFacts.energy.toFixed(0)}%`,
      `- Mode: ${hardFacts.mode}`
    ]);

    const identityBlock = PromptComposer.section('IDENTITY', [
      `- Name: ${basePersona.name}`,
      `- Persona: ${basePersona.persona}`,
      `- Core Values: ${basePersona.coreValues.join(', ')}`
    ]);

    const styleBlock = PromptComposer.section('STYLE CONSTRAINTS (MUST FOLLOW)', [formatStyleConstraints(ctx)]);

    const limbic = ctx.limbic;
    const social = ctx.socialFrame;
    const stateBlock = PromptComposer.section('CURRENT STATE', [
      `- Limbic: Fear=${limbic.fear.toFixed(2)}, Curiosity=${limbic.curiosity.toFixed(2)}, Satisfaction=${limbic.satisfaction.toFixed(2)}`,
      `- Social: User presence=${social.userPresenceScore.toFixed(2)}, Silence=${social.silenceDurationSec.toFixed(0)}s`
    ]);

    const sessionBlock = PromptComposer.section('SESSION HISTORY (source of truth)', [formatSessionMemory(ctx)], {
      maxChars: b.sessionMemoryMaxChars
    });

    const contextBlock = PromptComposer.section('CONTEXT', [formatMemories(ctx)], { maxChars: b.contextMaxChars });

    const recentChat = formatRecentChat(ctx) || 'No prior conversation';
    const chatBlock = PromptComposer.section('RECENT CONVERSATION', [recentChat], { maxChars: b.recentChatMaxChars });

    const goalBlock = ctx.activeGoal
      ? PromptComposer.section(`ACTIVE GOAL (${String(ctx.activeGoal.source).toUpperCase()})`, [
          `- Description: ${ctx.activeGoal.description}`,
          `- Priority: ${Number(ctx.activeGoal.priority).toFixed(2)}`
        ])
      : '';

    const taskBlock = PromptComposer.block([formatTask(ctx, mode)], { maxChars: b.taskMaxChars });

    return PromptComposer.join([
      hardFactsBlock,
      identityBlock,
      styleBlock,
      stateBlock,
      sessionBlock,
      contextBlock,
      chatBlock,
      goalBlock,
      taskBlock
    ]);
  }
};
