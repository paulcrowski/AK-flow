import type { ContextMode, UnifiedContext } from '../../../core/context';

export function formatTask(ctx: UnifiedContext, mode: ContextMode): string {
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
