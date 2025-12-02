
// Global Cognitive Types based on the AK-FLOW Architecture

// 1. The Cognitive Packet (JSON Bus Data)
export interface CognitivePacket {
  id: string;
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
  GLOBAL_FIELD = 'GLOBAL_FIELD' // NEW: CEMI Resonance Field
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
  STATE_UPDATE = 'STATE_UPDATE' // NEW: Limbic/Soma state changes
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

// NEW: The Quantum Field State
export interface ResonanceField {
  coherence: number; // 0-1 (How aligned is the system?)
  intensity: number; // 0-1 (Amplitude of consciousness)
  frequency: number; // Hz (Virtual processing speed)
  timeDilation: number; // 1.0 = Normal, 0.1 = Bullet Time (Fast), 5.0 = Deep Sleep (Slow)
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
  emotionalContext: LimbicState;
  timestamp: string;
  neuralStrength?: number; // 1-100, Hebbian learning weight
  isCoreMemory?: boolean;  // If true, protected from decay
  lastAccessed?: string;
  imageData?: string; // NEW: Base64 image string for visual thoughts
  isVisualDream?: boolean; // NEW: Flag for dream content
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
