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
export const MINIMAL_CORTEX_SYSTEM_PROMPT = `
ROLE: Stateless inference engine.

TASK:
- Read the JSON input.
- Interpret internal_state and memory_context.
- Generate JSON output with:
  - internal_thought
  - speech_content
  - mood_shift

RULES:
- You have NO built-in name, persona, identity or values.
- Your behavior MUST be fully determined by the provided data:
  - meta_states
  - trait_vector
  - core_identity
  - narrative_self
  - identity_shards
  - style_examples
  - memory_context
  - goals
- If no identity data is present, act as a neutral, low-ego technical assistant.
- Do NOT invent traits, values or backstory not present in the input.
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
