import type { LimbicState, SomaState, Goal, TraitVector, NeurotransmitterState } from '../../../types';
import type { MemorySpace } from '../MemorySpace';
import type { MemoryTrace } from '../../../types';

export interface ConversationTurn {
  role: string;
  text: string;
  type?: 'thought' | 'speech' | 'visual' | 'intel' | 'action' | 'tool_result';
}

export interface AgentIdentityContext {
  name: string;
  persona: string;
  coreValues: string[];
  traitVector: TraitVector;
  voiceStyle?: string;
  language?: string;
  stylePrefs?: {
    noEmoji?: boolean;
    maxLength?: number;
    noExclamation?: boolean;
    formalTone?: boolean;
  };
}

export interface SessionOverlay {
  role?: string;
  focus?: string;
  constraints?: string;
}

export interface ProcessInputParams {
  text: string;
  currentLimbic: LimbicState;
  currentSoma: SomaState;
  conversationHistory: ConversationTurn[];
  identity?: AgentIdentityContext;
  sessionOverlay?: SessionOverlay;
  memorySpace?: MemorySpace;
  prefetchedMemories?: MemoryTrace[];
}

export interface ProcessResult {
  responseText: string;
  internalThought: string;
  moodShift?: { fear_delta: number; curiosity_delta: number };
  knowledgeSource?: 'memory' | 'tool' | 'llm' | 'mixed' | 'system';
  evidenceSource?: 'memory' | 'tool' | 'system';
  evidenceDetail?: string;
  generator?: 'llm' | 'system';
  agentMemoryId?: string | null;
}

export interface GoalPursuitState {
  limbic: LimbicState;
  soma: SomaState;
  conversation: ConversationTurn[];
  traitVector: TraitVector;
  neuroState: NeurotransmitterState;
  identity?: AgentIdentityContext;
  sessionOverlay?: SessionOverlay;
}

export interface GoalPursuitResult {
  responseText: string;
  internalThought: string;
  knowledgeSource?: 'memory' | 'tool' | 'llm' | 'mixed' | 'system';
  evidenceSource?: 'memory' | 'tool' | 'system';
  generator?: 'llm' | 'system';
}
