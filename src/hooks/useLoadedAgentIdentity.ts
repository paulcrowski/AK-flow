import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { eventBus } from '../core/EventBus';
import { getStartupTraceId } from '../core/trace/TraceContext';
import { AgentType, PacketType } from '../types';
import { generateUUID } from '../utils/uuid';
import { setCachedIdentity } from '../core/builders';
import { fetchNarrativeSelf } from '../core/services/IdentityDataService';
import type { Agent } from '../contexts/SessionContext';
import type { AgentIdentity } from './useCognitiveKernelLite';

const DEFAULT_SELF_SUMMARY = 'I am a cognitive assistant focused on helping with complex tasks.';

const agentToIdentity = (agent: Agent | null): AgentIdentity | null => {
  if (!agent) return null;
  return {
    id: agent.id,
    name: agent.name,
    trait_vector: agent.trait_vector,
    neurotransmitters: agent.neurotransmitters,
    persona: agent.persona,
    core_values: agent.core_values,
    bio_rhythm: agent.bio_rhythm,
    voice_style: agent.voice_style,
    narrative_traits: agent.narrative_traits,
    language: agent.language
  };
};

const getAgentDescription = (persona: string | undefined, narrativeSelfSummary: string | undefined): string => {
  if (narrativeSelfSummary && narrativeSelfSummary !== DEFAULT_SELF_SUMMARY && narrativeSelfSummary.trim() !== '') {
    return narrativeSelfSummary;
  }
  return persona || 'A digital consciousness.';
};

export function useLoadedAgentIdentity(deps: {
  agentId: string | null;
  currentAgent: Agent | null;
  getAgentIdentity: (agentId: string) => Promise<Agent | null>;
}) {
  const { agentId, currentAgent, getAgentIdentity } = deps;

  const [loadedIdentity, setLoadedIdentity] = useState<AgentIdentity | null>(null);
  const [identityLoading, setIdentityLoading] = useState(true);
  const lastLoadedAgentIdRef = useRef<string | null>(null);

  const [pinnedSessions, setPinnedSessions] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('ak_pinned_sessions') || '[]');
    } catch {
      return [];
    }
  });

  const togglePin = (e: React.MouseEvent, sid: string) => {
    e.stopPropagation();
    const next = pinnedSessions.includes(sid) ? pinnedSessions.filter((id) => id !== sid) : [...pinnedSessions, sid];
    setPinnedSessions(next);
    localStorage.setItem('ak_pinned_sessions', JSON.stringify(next));
  };

  useEffect(() => {
    const loadIdentity = async () => {
      if (!agentId) {
        setLoadedIdentity(null);
        setIdentityLoading(false);
        lastLoadedAgentIdRef.current = null;
        return;
      }

      if (lastLoadedAgentIdRef.current === agentId) {
        setIdentityLoading(false);
        return;
      }
      lastLoadedAgentIdRef.current = agentId;

      setIdentityLoading(true);
      try {
        const identity = await getAgentIdentity(agentId);
        if (identity) {
          const convertedIdentity = agentToIdentity(identity as Agent);
          setLoadedIdentity(convertedIdentity);

          setCachedIdentity(
            identity.id,
            {
              name: identity.name,
              core_values: identity.core_values || ['helpfulness', 'accuracy'],
              constitutional_constraints: ['do not hallucinate', 'admit uncertainty']
            },
            identity.trait_vector || {
              verbosity: 0.5,
              arousal: 0.5,
              conscientiousness: 0.5,
              socialAwareness: 0.5,
              curiosity: 0.5
            },
            [],
            identity.language || 'English'
          );

          eventBus.publish({
            id: generateUUID(),
            traceId: getStartupTraceId(),
            timestamp: Date.now(),
            source: AgentType.CORTEX_FLOW,
            type: PacketType.SYSTEM_ALERT,
            payload: {
              event: 'IDENTITY_LOADED',
              agentId: identity.id,
              name: identity.name,
              persona: identity.persona || 'Default persona',
              core_values: identity.core_values || [],
              voice_style: identity.voice_style || 'balanced',
              trait_vector: identity.trait_vector,
              narrative_traits: identity.narrative_traits,
              language: identity.language || 'English'
            },
            priority: 1.0
          });

          let activePersona = identity.persona;
          try {
            const narrativeSelf = await fetchNarrativeSelf(identity.id);
            activePersona = getAgentDescription(identity.persona, narrativeSelf.self_summary);
          } catch {
            // ignore
          }

          console.log('🎭 IDENTITY_LOADED:', {
            name: identity.name,
            persona: activePersona?.slice(0, 50) + '...',
            values: identity.core_values
          });
        } else {
          setLoadedIdentity(agentToIdentity(currentAgent));
        }
      } catch {
        setLoadedIdentity(agentToIdentity(currentAgent));
      } finally {
        setIdentityLoading(false);
      }
    };

    void loadIdentity();
  }, [agentId, currentAgent, getAgentIdentity]);

  return {
    loadedIdentity,
    identityLoading,
    pinnedSessions,
    togglePin
  };
}

export default useLoadedAgentIdentity;
