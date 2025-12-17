export interface TraitVector {
  arousal: number;
  verbosity: number;
  conscientiousness: number;
  socialAwareness: number;
  curiosity: number;
}

export interface NeurotransmitterState {
  dopamine: number;
  serotonin: number;
  norepinephrine: number;
}

export interface BioRhythm {
  preferredEnergy: number;
  sleepThreshold: number;
  wakeThreshold: number;
}

export interface NarrativeTraits {
  speakingStyle: string;
  emotionalRange: string;
  humorLevel: number;
}

export interface Agent {
  id: string;
  user_id: string;
  name: string;
  trait_vector: TraitVector;
  neurotransmitters: NeurotransmitterState;
  persona?: string;
  core_values?: string[];
  bio_rhythm?: BioRhythm;
  voice_style?: string;
  narrative_traits?: NarrativeTraits;
  language?: string;
  style_prefs?: {
    noEmoji?: boolean;
    maxLength?: number;
    noExclamation?: boolean;
    formalTone?: boolean;
  };
  created_at: string;
  last_active_at: string;
}

export interface SessionContextType {
  userId: string | null;
  agentId: string | null;
  currentAgent: Agent | null;
  agents: Agent[];
  isLoading: boolean;
  login: (email: string) => void;
  logout: () => void;
  selectAgent: (agentId: string) => void;
  createAgent: (name: string, persona?: string) => Promise<Agent | null>;
  refreshAgents: () => Promise<void>;
  getAgentIdentity: (agentId: string) => Promise<Agent | null>;
}
