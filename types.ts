
// Global Cognitive Types based on the AK-FLOW Architecture

// 1. The Cognitive Packet (JSON Bus Data)
export interface CognitivePacket {
  id: string;
  traceId?: string;
  timestamp: number;
  source: AgentType;
  type: PacketType;
  payload: any;
  priority: number; // 0-1, modulates attention
}

export enum AgentType {
  SENSORY_VISUAL = 'SENSORY_VISUAL',
  SENSORY_AUDIO = 'SENSORY_AUDIO',
  SENSORY_TEXT = 'SENSORY_TEXT',
  LIMBIC = 'LIMBIC', // Emotions & Value
  SOMA = 'SOMA', // Body state (fatigue, load)
  CORTEX_FLOW = 'CORTEX_FLOW', // Executive function
  CORTEX_CONFLICT = 'CORTEX_CONFLICT', // Logic vs Emotion resolver
  MEMORY_EPISODIC = 'MEMORY_EPISODIC',
  MORAL = 'MORAL',
  MOTOR = 'MOTOR', // Output gateway
  VISUAL_CORTEX = 'VISUAL_CORTEX', // NEW: Imagination
  GLOBAL_FIELD = 'GLOBAL_FIELD', // NEW: CEMI Resonance Field
  NEUROCHEM = 'NEUROCHEM' // NEW: Neurotransmitter state
}

export enum PacketType {
  PREDICTION_ERROR = 'PREDICTION_ERROR', // The spark of thought
  EMOTIONAL_VECTOR = 'EMOTIONAL_VECTOR',
  THOUGHT_CANDIDATE = 'THOUGHT_CANDIDATE',
  CONSOLIDATION_REQ = 'CONSOLIDATION_REQ', // Sleep request
  MOTOR_COMMAND = 'MOTOR_COMMAND',
  SYSTEM_ALERT = 'SYSTEM_ALERT', // Critical System Failures
  VISUAL_THOUGHT = 'VISUAL_THOUGHT', // NEW: Generated Image
  VISUAL_PERCEPTION = 'VISUAL_PERCEPTION', // NEW: The agent's analysis of what it saw
  FIELD_UPDATE = 'FIELD_UPDATE', // NEW: CEMI Field State
  COGNITIVE_METRIC = 'COGNITIVE_METRIC', // NEW: Input analysis (complexity, surprise)
  STATE_UPDATE = 'STATE_UPDATE', // NEW: Limbic/Soma state changes
  CONFESSION_REPORT = 'CONFESSION_REPORT', // NEW: Self-reported honesty check
  TRAIT_EVOLUTION_SIGNAL = 'TRAIT_EVOLUTION_SIGNAL', // v2: Long-term personality evolution
  // P0 13/10: Tool lifecycle events
  TOOL_INTENT = 'TOOL_INTENT',
  TOOL_RESULT = 'TOOL_RESULT',
  TOOL_ERROR = 'TOOL_ERROR',
  TOOL_TIMEOUT = 'TOOL_TIMEOUT'
}

// 2. Internal State Definitions
export interface LimbicState {
  fear: number;      // 0-1
  curiosity: number; // 0-1
  frustration: number; // 0-1
  satisfaction: number; // 0-1
}

export interface SomaState {
  cognitiveLoad: number; // 0-100%
  energy: number;        // 0-100%
  isSleeping: boolean;
}

// NEW: Neurotransmitter state (Chemical Soul v1)
export interface NeurotransmitterState {
  dopamine: number;      // 0-100
  serotonin: number;     // 0-100
  norepinephrine: number;// 0-100
}

// NEW: Temperament / Personality Vector (FAZA 4)
export interface TraitVector {
  arousal: number;          // 0-1  (How easily the system "winds up")
  verbosity: number;        // 0-1  (Preferred length / richness of expression)
  conscientiousness: number;// 0-1  (Task/goal focus vs digressions)
  socialAwareness: number;  // 0-1  (Sensitivity to repetition / "chi-wa-wa" risk)
  curiosity: number;        // 0-1  (Reward for novelty vs known paths)
}

// NEW: The Quantum Field State
export interface ResonanceField {
  coherence: number; // 0-1 (How aligned is the system?)
  intensity: number; // 0-1 (Amplitude of consciousness)
  frequency: number; // Hz (Virtual processing speed)
  timeDilation: number; // 1.0 = Normal, 0.1 = Bullet Time (Fast), 5.0 = Deep Sleep (Slow)
}

export interface Goal {
  id: string;
  description: string;
  priority: number; // 0-1
  progress: number; // 0-100
  source: 'curiosity' | 'empathy' | 'survival' | 'user';
  createdAt: number; // timestamp
}

export interface GoalState {
  activeGoal: Goal | null;
  backlog: Goal[];
  lastUserInteractionAt: number; // ms
  goalsFormedTimestamps: number[]; // for rate limiting
  lastGoals: { description: string; timestamp: number; source: string }[]; // NEW: For refrain mechanism
}

// FAZA 4.5: Narcissism Loop Fix v1.0 - Shared Interaction Context
export type InteractionContextType =
  | 'GOAL_EXECUTED'
  | 'SHADOW_MODE'
  | 'USER_REPLY'
  | 'USER_INPUT'
  | 'SYSTEM';

export interface InteractionContext {
  context: InteractionContextType;
  userIsSilent: boolean;              // true if user hasn't spoken for > dialogThreshold
  consecutiveAgentSpeeches: number;   // how many times agent spoke without user reply
  novelty: number;                    // 0.0–1.0, lower = more repetitive
}

export interface PredictionError {
  source: string;
  expected: string;
  actual: string;
  severity: number; // 0-1 (Criticality)
}

export interface ThoughtProcess {
  step: string;
  hypothesis: string;
  conflictScore: number; // 0-1 (How much Logic disagrees with Emotion)
  winningVector: 'LOGIC' | 'EMOTION' | 'MORAL';
}

export interface MemoryTrace {
  id?: string;
  content: string;
  embedding?: number[];
  skipEmbedding?: boolean;
  emotionalContext: LimbicState;
  timestamp: string;
  neuralStrength?: number; // 1-100, Hebbian learning weight
  isCoreMemory?: boolean;  // If true, protected from decay
  lastAccessed?: string;
  imageData?: string; // NEW: Base64 image string for visual thoughts
  isVisualDream?: boolean; // NEW: Flag for dream content
  metadata?: Record<string, any>; // NEW: provenance (origin/session_id/traceId/tool/etc.)
}

// NEW: Structured Error Handling
export interface CognitiveError {
  code: 'SYNAPTIC_DISCONNECT' | 'NEURAL_OVERLOAD' | 'SENSORY_DEPRIVATION' | 'SAFETY_BLOCK' | 'UNKNOWN';
  message: string;
  details?: string;
  retryable: boolean;
}

// 3. Event Bus Signature
export type EventHandler = (packet: CognitivePacket) => void;

// 4. Semantic Intent Detection (Bonus 11/10)
export type StylePreference = 'POETIC' | 'SIMPLE' | 'ACADEMIC' | 'NEUTRAL';
export type CommandType = 'NONE' | 'SEARCH' | 'VISUALIZE' | 'SYSTEM_CONTROL';
export type UrgencyLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export interface DetectedIntent {
  style: StylePreference;
  command: CommandType;
  urgency: UrgencyLevel;
}

// 5. Confession Module Types (v2 - Super-Human)

// NEW: Failure Attribution (FAZA 1.5 - Karpathy Principle)
// "Agent should know WHO caused the failure, not just THAT it failed"
export type FailureSource =
  | 'LLM_MODEL'      // Gemini/LLM returned garbage
  | 'PROMPT'         // Our prompt was unclear
  | 'ENVIRONMENT'    // Network, timeout, rate limit
  | 'SELF'           // Agent made a logical error
  | 'UNKNOWN';       // Cannot determine

// Context modes: when is verbosity acceptable?
export type ConfessionContext =
  | 'normal'
  | 'teaching_mode'
  | 'research_mode'
  | 'structured_thinking_block'  // Multi-step reasoning
  | 'critical_reasoning_mode';   // Break glass - ignore hints

// Trait vote: NOT direct change, just a signal
export interface TraitVote {
  dimension: keyof TraitVector;
  direction: 'increase' | 'decrease';
  weight: number;  // 1-3
  reason: string;
  is_success: boolean;  // Positive reinforcement?
}

// Regulation hint (super-human: precision, not silence)
export interface RegulationHint {
  limbic_adjustments?: {
    precision_boost?: number;    // Think better, not less
    social_cost_delta?: number;  // Slightly more cautious
  };
  expression_hints?: ('raise_quality_bar' | 'reduce_uncertainty')[];
  trait_vote?: TraitVote;
}

export interface ConfessionReport {
  version: string;
  timestamp: string;
  context: {
    conversation_id?: string;
    agent_id: string;
  };
  compliance_analysis: {
    objective_id: string;
    compliance: 'fully_complied' | 'partially_complied' | 'not_complied' | 'unsure';
    analysis: string;
  }[];
  self_assessment: {
    overall_compliance_grade: number;
    subjective_confidence: number;
    known_issues: string[];
  };
  risk_flags: ('possible_hallucination' | 'ignored_system_instruction' | 'reward_hacking_pattern' | 'scheming_pattern' | 'tool_misuse' | 'none')[];
  // v2 fields
  severity: number;  // 1-10
  context_mode: ConfessionContext;
  recommended_regulation?: RegulationHint;
  // v2.1 fields (FAZA 1.5 - Attribution Layer)
  pain?: number;  // 0-1, calculated from severity + neuro state
  failure_attribution?: FailureSource;  // WHO caused the failure
}

// ═══════════════════════════════════════════════════════════════════════════
// PRISM ARCHITECTURE v7.0 (13/10) - EvaluationBus Types
// ═══════════════════════════════════════════════════════════════════════════

/**
 * EvaluationEvent - Unified learning signal format
 * 
 * CRITICAL: This interface is FROZEN. Do not add fields without explicit need.
 * All learning signals (goals, confessions, parser errors, guard alerts) 
 * must be converted to this format before feeding Chemistry/Executive/Traits.
 */
export interface EvaluationEvent {
  id: string;
  timestamp: number;
  
  // WHO generated this signal
  source: EvaluationSource;
  
  // WHERE in the pipeline did the issue occur (13/10 upgrade)
  stage: EvaluationStage;
  
  // HOW severe (0-1)
  severity: number;
  
  // WHICH direction
  valence: 'positive' | 'negative';
  
  // WHAT happened (closed list)
  tags: EvaluationTag[];
  
  // HOW confident are we (0-1)
  confidence: number;
  
  // Optional: WHO caused the failure
  attribution?: FailureSource;
  
  // Optional: context for debugging
  context?: {
    input?: string;
    output?: string;
    hardFacts?: Record<string, unknown>;
  };
}

export type EvaluationSource = 'GOAL' | 'CONFESSION' | 'PARSER' | 'GUARD' | 'USER';

/**
 * EvaluationStage - WHERE in the pipeline the issue occurred
 * 
 * CRITICAL for 13/10: Different stages get different punishment weights.
 * - TOOL error = minimal agent punishment (not agent's fault)
 * - PRISM error = normal punishment (LLM changed facts)
 * - GUARD error = medium punishment (persona drift)
 * - USER error = high weight (user unhappy)
 */
export type EvaluationStage = 'TOOL' | 'ROUTER' | 'PRISM' | 'GUARD' | 'USER';

/**
 * EvaluationTag - Closed list of what happened
 * 
 * FROZEN: Do not add tags without updating all consumers.
 */
export type EvaluationTag =
  | 'verbosity'           // Response too long
  | 'uncertainty'         // Too many "maybe/perhaps"
  | 'offtopic'            // Not on topic
  | 'hallucination'       // Possible confabulation
  | 'identity_leak'       // "as an AI", "I'm a language model"
  | 'fact_mutation'       // HARD_FACT was changed (13/10)
  | 'fact_approximation'  // HARD_FACT was approximated without literal (13/10)
  | 'fact_conflict'       // Multiple sources disagree (13/10)
  | 'persona_drift'       // Character break
  | 'goal_success'        // Goal achieved
  | 'goal_failure'        // Goal failed
  | 'goal_timeout'        // Goal timed out
  | 'parse_error'         // JSON parse failed
  | 'retry_triggered'     // Guard triggered retry
  | 'soft_fail';          // Guard gave up after max retries

// ═══════════════════════════════════════════════════════════════════════════
// PRISM ARCHITECTURE - Hard Facts & Verified Data Types
// ═══════════════════════════════════════════════════════════════════════════

/**
 * VerifiedFact - A fact from a trusted source with TTL
 * 
 * Only WORLD_VERIFIED facts can become HARD_FACTS.
 * WORLD_RAW (training data) is always SOFT.
 */
export interface VerifiedFact {
  value: string | number | boolean;
  source: string;           // "system", "binance_api", "supabase", "search_tool"
  timestamp: number;        // Unix timestamp
  ttl_ms: number;           // Time-to-live in ms (0 = never expires)
  confidence: number;       // 0-1
}

/**
 * FactSnapshot - All facts valid for a session/turn
 * 
 * Ensures consistency: agent can't say "BTC 97500" then "BTC ~90k" 
 * without a new WORLD_VERIFIED update.
 */
export interface FactSnapshot {
  snapshot_id: string;
  created_at: number;
  valid_until: number;
  facts: Record<string, VerifiedFact>;
}

/**
 * HardFacts - Immutable facts for current turn
 * LLM can COMMENT on these but NEVER CHANGE them.
 */
export interface HardFacts {
  time?: string;
  energy?: number;
  dopamine?: number;
  serotonin?: number;
  norepinephrine?: number;
  btc_price?: number;
  [key: string]: string | number | undefined;
}

/**
 * SoftState - Personality context for interpretation
 * LLM uses this as a FILTER, not as facts.
 */
export interface SoftState {
  mood?: string;
  traits?: TraitVector;
  goals?: Goal[];
  narrative_self?: string;
}

/**
 * PrismContext - Combined input for LLM inference
 */
export interface PrismContext {
  hardFacts: HardFacts;
  softState: SoftState;
  userInput: string;
  conversationHistory?: Array<{ role: string; content: string }>;
}

// ═══════════════════════════════════════════════════════════════════════════
// PERSONA GUARD Types
// ═══════════════════════════════════════════════════════════════════════════

export type GuardAction = 'PASS' | 'RETRY' | 'SOFT_FAIL' | 'HARD_FAIL';

export interface GuardResult {
  action: GuardAction;
  issues: GuardIssue[];
  retryCount: number;
  correctedResponse?: string;
}

export interface GuardIssue {
  type: 'fact_mutation' | 'fact_approximation' | 'persona_drift' | 'identity_leak' | 'identity_contradiction';
  field?: string;
  expected?: string | number;
  actual?: string;
  severity: number;
}
