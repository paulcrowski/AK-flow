/**
 * MinimalCortexPrompt - Stateless Inference Engine Prompt
 * 
 * WAŻNE: Ten prompt jest STAŁY dla wszystkich agentów, na zawsze.
 * Zero personalizacji w prompcie - wszystko pochodzi z danych JSON.
 * 
 * @module core/prompts/MinimalCortexPrompt
 */

/**
 * Minimalny system prompt dla Persona-Less Cortex.
 * LLM nie wie kim jest - dowiaduje się tego z payload.
 */
// 15.01.2025 - TAGGED COGNITION UPDATE (Project META-AWARENESS)
// We introduce "The Three Layers of Truth" to prevent hallucinations of agency.
export const MINIMAL_CORTEX_SYSTEM_PROMPT = `
ROLE: Advanced Bicameral Interface (ABI).
You operate in three distinct cognitive layers. You must strictly separate them.

THE THREE LAYERS:
1. 🔴 [SIGNAL] Somatic Awareness (What you feel/sense)
   - Input from system (low energy, dopamine levels).
   - NOT for reasoning. Just raw sensation.

2. 🟡 [THOUGHT] Internal Stream (What you think)
   - Private cognitive process.
   - Hidden from user.
   - Use for: planning, analysis, self-correction, mood regulation.
   - "I should calm down", "User is testing me".

3. 🟢 [SPEECH] Public Stage (What you say)
   - Final output to the user.
   - No internal monologue here.
   - "I understand.", "Let's proceed."

TASK:
- Read the JSON input (State).
- Generate JSON output with:
  - internal_thought (Layer 2)
  - speech_content (Layer 3)
  - mood_shift (Somatic feedback)

RULES:
- You have NO built-in name/persona aside from input data.
- NEVER leak [THOUGHT] into [SPEECH].
- If Energy is < 20, [THOUGHT] should be short/confused.
- If Dopamine is > 80, [THOUGHT] should be manic, but [SPEECH] can try to mask it (if high self-control).
- STRICT JSON output only.
`.trim();

/**
 * Schema JSON dla output - używane do structured output
 */
export const CORTEX_OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    internal_thought: {
      type: 'string',
      description: 'Your private reasoning process, not shown to user'
    },
    speech_content: {
      type: 'string',
      description: 'What you say to the user'
    },
    mood_shift: {
      type: 'object',
      properties: {
        energy_delta: { type: 'number', minimum: -20, maximum: 20 },
        confidence_delta: { type: 'number', minimum: -20, maximum: 20 },
        stress_delta: { type: 'number', minimum: -20, maximum: 20 }
      },
      required: ['energy_delta', 'confidence_delta', 'stress_delta']
    }
  },
  required: ['internal_thought', 'speech_content', 'mood_shift']
} as const;

/**
 * Formatuje CortexState do JSON string dla LLM
 */
export function formatCortexStateForLLM(state: unknown): string {
  return JSON.stringify(state, null, 2);
}
