import React, { createContext, useState, useEffect, ReactNode } from 'react';
import { supabase, setCurrentOwnerId } from '../services/supabase';
import type { Agent, SessionContextType } from './SessionTypes';

const SessionContext = createContext<SessionContextType | null>(null);

const LS_AGENT_ID = 'ak_flow_agent_id';
const LS_AGENT_ID_PREFIX = 'ak_flow_agent_id:';

function getAgentStorageKey(ownerId: string | null): string {
  return ownerId ? `${LS_AGENT_ID_PREFIX}${ownerId}` : LS_AGENT_ID;
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [agentId, setAgentId] = useState<string | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    // Bootstrap from existing Supabase session (if any)
    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!isMounted) return;
        if (error) {
          console.warn('[SessionProvider] getSession error:', error.message);
          setIsLoading(false);
          return;
        }

        const user = data?.session?.user ?? null;
        setAuthUserId(user?.id ?? null);
        setCurrentOwnerId(user?.id ?? null);
        setUserEmail((user?.email ?? null) as string | null);
        setUserId(user?.id ?? null);
        setIsLoading(false);
      })
      .catch((err) => {
        if (!isMounted) return;
        console.warn('[SessionProvider] getSession exception:', err);
        setIsLoading(false);
      });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user ?? null;
      setAuthUserId(user?.id ?? null);
      setCurrentOwnerId(user?.id ?? null);
      setUserEmail((user?.email ?? null) as string | null);
      setUserId(user?.id ?? null);
    });

    return () => {
      isMounted = false;
      sub?.subscription?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const key = getAgentStorageKey(authUserId);

    if (!authUserId) {
      const legacy = localStorage.getItem(LS_AGENT_ID);
      if (legacy) localStorage.removeItem(LS_AGENT_ID);
      setAgentId(null);
      return;
    }

    const legacy = localStorage.getItem(LS_AGENT_ID);
    if (legacy) {
      localStorage.setItem(key, legacy);
      localStorage.removeItem(LS_AGENT_ID);
    }

    const stored = localStorage.getItem(key);
    setAgentId(stored || null);
  }, [authUserId]);

  useEffect(() => {
    if (userId) {
      refreshAgents();
    } else {
      setAgents([]);
      setAgentId(null);
    }
  }, [userId]);

  const refreshAgents = async () => {
    if (!authUserId) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('agents')
        .select('*')
        .eq('owner_id', authUserId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching agents:', error.message);
        setAgents([]);
      } else {
        setAgents(data || []);

        const rows = data || [];
        if (agentId && !rows.some((a) => a.id === agentId)) {
          setAgentId(null);
          localStorage.removeItem(getAgentStorageKey(authUserId));
        }

        if ((!agentId || !rows.some((a) => a.id === agentId)) && rows.length > 0) {
          selectAgent(rows[0].id);
        }
      }
    } catch (err) {
      console.error('Error fetching agents:', err);
      setAgents([]);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string): Promise<{ ok: boolean; error?: string }> => {
    const normalizedEmail = email.toLowerCase().trim();
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password
      });

      if (error) {
        return { ok: false, error: error.message };
      }

      const user = data?.user ?? null;
      setAuthUserId(user?.id ?? null);
      setUserEmail((user?.email ?? null) as string | null);
      setUserId(user?.id ?? null);
      return { ok: true };
    } catch (err: any) {
      return { ok: false, error: String(err?.message ?? err) };
    }
  };

  const logout = () => {
    supabase.auth.signOut().catch(() => {});
    setUserId(null);
    setUserEmail(null);
    setAuthUserId(null);
    setCurrentOwnerId(null);
    setAgentId(null);
    setAgents([]);
    localStorage.removeItem(LS_AGENT_ID);
    const key = getAgentStorageKey(authUserId);
    localStorage.removeItem(key);
  };

  const selectAgent = (id: string) => {
    setAgentId(id);
    localStorage.setItem(getAgentStorageKey(authUserId), id);

    supabase
      .from('agents')
      .update({ last_active_at: new Date().toISOString() })
      .eq('id', id)
      .then(() => {});
  };

  const createAgent = async (name: string, persona?: string): Promise<Agent | null> => {
    if (!authUserId || !userEmail) return null;

    const trimmedName = name.trim();
    const hasCustomPersona = Boolean(persona && persona.trim());

    const defaultStablePersona = `You are ${trimmedName}, a calm and precise assistant. You prioritize clarity, safety, and reliability. You speak Polish in a grounded, non-flashy style.`;

    try {
      const { data, error } = await supabase
        .from('agents')
        .insert([{
          user_id: userEmail,
          owner_id: authUserId,
          name: trimmedName,
          trait_vector: {
            arousal: hasCustomPersona ? 0.5 : 0.25,
            verbosity: hasCustomPersona ? 0.5 : 0.25,
            conscientiousness: hasCustomPersona ? 0.5 : 0.85,
            socialAwareness: hasCustomPersona ? 0.5 : 0.7,
            curiosity: hasCustomPersona ? 0.7 : 0.5
          },
          neurotransmitters: {
            dopamine: hasCustomPersona ? 60 : 55,
            serotonin: hasCustomPersona ? 50 : 60,
            norepinephrine: hasCustomPersona ? 40 : 45
          },
          persona: (persona && persona.trim()) ? persona.trim() : defaultStablePersona,
          core_values: hasCustomPersona ? ['curiosity', 'authenticity', 'growth'] : ['clarity', 'reliability', 'calm'],
          bio_rhythm: {
            preferredEnergy: hasCustomPersona ? 80 : 70,
            sleepThreshold: hasCustomPersona ? 20 : 15,
            wakeThreshold: hasCustomPersona ? 95 : 92
          },
          voice_style: 'balanced',
          narrative_traits: {
            speakingStyle: hasCustomPersona ? 'thoughtful' : 'grounded',
            emotionalRange: hasCustomPersona ? 'moderate' : 'narrow',
            humorLevel: hasCustomPersona ? 0.3 : 0.1
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

  const getAgentIdentity = async (agentId: string): Promise<Agent | null> => {
    try {
      const { data, error } = await supabase.rpc('get_agent_identity', {
        p_agent_id: agentId
      });

      if (error) {
        console.warn('RPC get_agent_identity failed, falling back to direct query:', error.message);
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
      authUserId,
      userEmail,
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

export { SessionContext };
