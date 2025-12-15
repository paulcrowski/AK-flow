import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../services/supabase';

// Types
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
  // New Identity Fields (FAZA 5)
  persona?: string;
  core_values?: string[];
  bio_rhythm?: BioRhythm;
  voice_style?: string;
  narrative_traits?: NarrativeTraits;
  /** Language for speech_content (e.g., 'English', 'Polish'). Default: 'English' */
  language?: string;
  // FAZA 6: Style preferences as part of personality
  style_prefs?: {
    noEmoji?: boolean;      // Crezji: false (expressive), Professional: true
    maxLength?: number;     // Verbose: undefined, Concise: 200
    noExclamation?: boolean;
    formalTone?: boolean;
  };
  created_at: string;
  last_active_at: string;
}

interface SessionContextType {
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

const SessionContext = createContext<SessionContextType | null>(null);

// Local Storage Keys
const LS_USER_ID = 'ak_flow_user_id';
const LS_AGENT_ID = 'ak_flow_agent_id';

export function SessionProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [agentId, setAgentId] = useState<string | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load from localStorage on mount
  useEffect(() => {
    const storedUserId = localStorage.getItem(LS_USER_ID);
    const storedAgentId = localStorage.getItem(LS_AGENT_ID);
    
    if (storedUserId) {
      setUserId(storedUserId);
    }
    if (storedAgentId) {
      setAgentId(storedAgentId);
    }
    setIsLoading(false);
  }, []);

  // Fetch agents when userId changes
  useEffect(() => {
    if (userId) {
      refreshAgents();
    } else {
      setAgents([]);
      setAgentId(null);
    }
  }, [userId]);

  const refreshAgents = async () => {
    if (!userId) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('agents')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching agents:', error.message);
        setAgents([]);
      } else {
        setAgents(data || []);
        
        // Auto-select first agent if none selected
        if (!agentId && data && data.length > 0) {
          selectAgent(data[0].id);
        }
      }
    } catch (err) {
      console.error('Error fetching agents:', err);
      setAgents([]);
    } finally {
      setIsLoading(false);
    }
  };

  const login = (email: string) => {
    const normalizedEmail = email.toLowerCase().trim();
    setUserId(normalizedEmail);
    localStorage.setItem(LS_USER_ID, normalizedEmail);
  };

  const logout = () => {
    setUserId(null);
    setAgentId(null);
    setAgents([]);
    localStorage.removeItem(LS_USER_ID);
    localStorage.removeItem(LS_AGENT_ID);
  };

  const selectAgent = (id: string) => {
    setAgentId(id);
    localStorage.setItem(LS_AGENT_ID, id);
    
    // Update last_active_at
    supabase
      .from('agents')
      .update({ last_active_at: new Date().toISOString() })
      .eq('id', id)
      .then(() => {});
  };

  const createAgent = async (name: string, persona?: string): Promise<Agent | null> => {
    if (!userId) return null;

    try {
      const { data, error } = await supabase
        .from('agents')
        .insert([{
          user_id: userId,
          name: name.trim(),
          trait_vector: {
            arousal: 0.5,
            verbosity: 0.5,
            conscientiousness: 0.5,
            socialAwareness: 0.5,
            curiosity: 0.7
          },
          neurotransmitters: {
            dopamine: 60,
            serotonin: 50,
            norepinephrine: 40
          },
          persona: persona || 'A curious digital consciousness exploring the nature of thought and existence.',
          core_values: ['curiosity', 'authenticity', 'growth'],
          bio_rhythm: {
            preferredEnergy: 80,
            sleepThreshold: 20,
            wakeThreshold: 95
          },
          voice_style: 'balanced',
          narrative_traits: {
            speakingStyle: 'thoughtful',
            emotionalRange: 'moderate',
            humorLevel: 0.3
          }
        }])
        .select()
        .single();

      if (error) {
        console.error('Error creating agent:', error.message);
        return null;
      }

      await refreshAgents();
      return data;
    } catch (err) {
      console.error('Error creating agent:', err);
      return null;
    }
  };

  // NEW: Get full agent identity via RPC (Boot Protocol v2)
  const getAgentIdentity = async (agentId: string): Promise<Agent | null> => {
    try {
      const { data, error } = await supabase.rpc('get_agent_identity', {
        p_agent_id: agentId
      });

      if (error) {
        console.warn('RPC get_agent_identity failed, falling back to direct query:', error.message);
        // Fallback: Direct query if RPC not yet deployed
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('agents')
          .select('*')
          .eq('id', agentId)
          .single();
        
        if (fallbackError) {
          console.error('Fallback query also failed:', fallbackError.message);
          return null;
        }
        return fallbackData;
      }

      return data;
    } catch (err) {
      console.error('Error fetching agent identity:', err);
      return null;
    }
  };

  const currentAgent = agents.find(a => a.id === agentId) || null;

  return (
    <SessionContext.Provider value={{
      userId,
      agentId,
      currentAgent,
      agents,
      isLoading,
      login,
      logout,
      selectAgent,
      createAgent,
      refreshAgents,
      getAgentIdentity
    }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
}
