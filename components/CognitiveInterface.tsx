import React, { useState, useEffect, useRef } from 'react';
import { eventBus } from '../core/EventBus';
import { getStartupTraceId } from '../core/trace/TraceContext';
import { AgentType, PacketType } from '../types';
import { generateUUID } from '../utils/uuid';
import { setCurrentAgentId } from '../services/supabase';
import { NeuroMonitor } from './NeuroMonitor';
import { useCognitiveKernelLite, AgentIdentity } from '../hooks/useCognitiveKernelLite';
import { useSession, Agent } from '../contexts/SessionContext';
import { AgentSelector } from './AgentSelector';
import { LibraryPanel } from './LibraryPanel';
import { confessionService } from '../services/ConfessionService';
import { initLimbicConfessionListener } from '../core/listeners/LimbicConfessionListener';
import { successSignalService } from '../services/SuccessSignalService';
import { setCachedIdentity } from '../core/builders';
// IDENTITY-LITE: Import fetchNarrativeSelf for fallback chain
import { fetchNarrativeSelf } from '../core/services/IdentityDataService';
import { useTraceAnalytics } from '../hooks/useTraceAnalytics';
import { Loader2, Zap, Power, Moon, EyeOff } from 'lucide-react';
import { LeftSidebar } from './layout/LeftSidebar';
import { ChatContainer } from './chat/ChatContainer';
import { ChatInput } from './chat/ChatInput';

// Convert Agent from SessionContext to AgentIdentity for Kernel
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

// ═══════════════════════════════════════════════════════════════
// IDENTITY-LITE: Fallback Chain for Agent Description
// Priority: narrative_self.self_summary > agents.persona
// ═══════════════════════════════════════════════════════════════
const DEFAULT_SELF_SUMMARY = 'I am a cognitive assistant focused on helping with complex tasks.';

const getAgentDescription = (persona: string | undefined, narrativeSelfSummary: string | undefined): string => {
    // 1. Dynamic (if narrative_self exists and is not default)
    if (narrativeSelfSummary && narrativeSelfSummary !== DEFAULT_SELF_SUMMARY && narrativeSelfSummary.trim() !== '') {
        return narrativeSelfSummary;
    }
    // 2. Fallback to seed persona
    return persona || 'A digital consciousness.';
};

export function CognitiveInterface() {
    // --- SESSION (Multi-Agent) ---
    const { userId, agentId, currentAgent, getAgentIdentity, logout } = useSession();

    const {
        traceHud,
        traceHudOpen,
        setTraceHudOpen,
        traceHudCopyState,
        traceHudFrozen,
        toggleFrozen,
        copyCurrentTrace,
        copyCurrentTraceWithWindow
    } = useTraceAnalytics();

    // FAZA 5: Load full agent identity from DB
    const [loadedIdentity, setLoadedIdentity] = useState<AgentIdentity | null>(null);
    const [pinnedSessions, setPinnedSessions] = useState<string[]>(() => {
        try {
            return JSON.parse(localStorage.getItem('ak_pinned_sessions') || '[]');
        } catch { return []; }
    });

    const togglePin = (e: React.MouseEvent, sid: string) => {
        e.stopPropagation();
        const next = pinnedSessions.includes(sid)
            ? pinnedSessions.filter(id => id !== sid)
            : [...pinnedSessions, sid];
        setPinnedSessions(next);
        localStorage.setItem('ak_pinned_sessions', JSON.stringify(next));
    };
    const [identityLoading, setIdentityLoading] = useState(true);
    const lastLoadedAgentIdRef = useRef<string | null>(null); // Guard against StrictMode double-fire

    

    // FAZA 5: Boot Protocol v2 - Load identity from DB
    useEffect(() => {
        const loadIdentity = async () => {
            if (!agentId) {
                setLoadedIdentity(null);
                setIdentityLoading(false);
                lastLoadedAgentIdRef.current = null;
                return;
            }

            // Guard: Skip if already loading/loaded this agent (StrictMode protection)
            if (lastLoadedAgentIdRef.current === agentId) {
                setIdentityLoading(false);
                return;
            }
            // Mark IMMEDIATELY to prevent race condition with StrictMode double-invoke
            lastLoadedAgentIdRef.current = agentId;

            setIdentityLoading(true);
            try {
                const identity = await getAgentIdentity(agentId);
                if (identity) {
                    console.log('[CognitiveInterface] Loaded agent identity:', identity.name);
                    const convertedIdentity = agentToIdentity(identity as Agent);
                    setLoadedIdentity(convertedIdentity);

                    // MVP: Cache identity for Cortex
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
                        [], // coreShards - empty for now
                        identity.language || 'English'
                    );

                    // FAZA 5: Publish IDENTITY_LOADED event to EventBus
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

                    // IDENTITY-LITE: Load narrative_self for fallback chain
                    let activePersona = identity.persona;
                    try {
                        const narrativeSelf = await fetchNarrativeSelf(identity.id);
                        activePersona = getAgentDescription(identity.persona, narrativeSelf.self_summary);
                        console.log('🎭 [Identity-Lite] Active persona:', activePersona.slice(0, 50) + '...');
                    } catch (narrativeErr) {
                        console.warn('[CognitiveInterface] Could not load narrative_self, using persona');
                    }

                    console.log('🎭 IDENTITY_LOADED:', {
                        name: identity.name,
                        persona: activePersona?.slice(0, 50) + '...',
                        values: identity.core_values
                    });
                } else {
                    // Fallback to currentAgent from context
                    console.log('[CognitiveInterface] Using fallback identity from context');
                    setLoadedIdentity(agentToIdentity(currentAgent));
                }
            } catch (err) {
                console.error('[CognitiveInterface] Failed to load identity:', err);
                setLoadedIdentity(agentToIdentity(currentAgent));
            } finally {
                setIdentityLoading(false);
            }
        };

        loadIdentity();
    }, [agentId, currentAgent, getAgentIdentity]);

    // --- COGNITIVE KERNEL (The Brain) ---
    const {
        limbicState,
        somaState,
        resonanceField,
        neuroState,
        autonomousMode,
        conversationSessions,
        activeConversationSessionId,
        conversation,
        isProcessing,
        currentThought,
        systemError,
        handleInput,
        selectConversationSession,
        retryLastAction,
        toggleAutonomy,
        toggleSleep,
        chemistryEnabled,
        toggleChemistry,
        injectStateOverride,
        goalState,
        resetKernel
    } = useCognitiveKernelLite(loadedIdentity);

    const [input, setInput] = useState('');
    const [sessionTokens, setSessionTokens] = useState(0);
    const chatEndRef = useRef<HTMLDivElement>(null);
    const chatScrollRef = useRef<HTMLDivElement>(null);
    const shouldAutoScrollRef = useRef(true);
    const lastResetSessionRef = useRef<string | null>(null); // Guard against StrictMode double-reset

    // --- KERNEL RESET ON SESSION CHANGE ---
    useEffect(() => {
        const sessionKey = `${userId}-${agentId}`;
        // Guard: Skip if already reset for this session (StrictMode protection)
        if (lastResetSessionRef.current === sessionKey) return;
        lastResetSessionRef.current = sessionKey;

        // When user or agent changes, fully reset cognitive kernel state
        resetKernel();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userId, agentId]);

    // --- SUBSCRIPTIONS (UI Only) ---
    useEffect(() => {
        const unsubscribe = eventBus.subscribe(PacketType.PREDICTION_ERROR, (packet) => {
            if (packet.source === AgentType.SOMA && packet.payload?.metric === "TOKEN_USAGE") {
                setSessionTokens(prev => prev + (packet.payload.total || 0));
            }
        });
        return () => unsubscribe();
    }, []);

    // --- CONFESSION V2 LISTENER INIT ---
    const limbicRef = useRef(limbicState);
    limbicRef.current = limbicState;

    useEffect(() => {
        // Initialize limbic confession listener with getter/setter
        // Returns cleanup function, singleton guard prevents duplicates
        const cleanup = initLimbicConfessionListener(
            () => limbicRef.current,
            (newState) => {
                // Use injectStateOverride to update individual keys
                injectStateOverride('limbic', 'frustration', newState.frustration);
            }
        );
        console.log('[CognitiveInterface] ✅ Confession v2 listeners initialized');

        return cleanup;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Empty deps - singleton, only init once


    useEffect(() => {
        const el = chatScrollRef.current;
        if (!el) return;

        const onScroll = () => {
            const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 160;
            shouldAutoScrollRef.current = atBottom;
        };

        el.addEventListener('scroll', onScroll, { passive: true });
        onScroll();
        return () => el.removeEventListener('scroll', onScroll);
    }, []);

    useEffect(() => {
        if (!shouldAutoScrollRef.current) return;
        if (chatEndRef.current) {
            chatEndRef.current.scrollIntoView({ behavior: 'auto' });
        }
    }, [conversation]);

    // FAZA 5: Show loading screen while identity is being fetched
    // All hooks are above this point, so React rules are satisfied
    if (identityLoading) {
        return (
            <div className="flex h-[100dvh] items-center justify-center bg-brain-dark text-gray-100">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="w-8 h-8 animate-spin text-brain-accent" />
                    <span className="text-sm text-gray-400">Loading agent identity...</span>
                </div>
            </div>
        );
    }

    const onSend = () => {
        if (!input.trim()) return;
        shouldAutoScrollRef.current = true;
        handleInput(input);
        setInput('');
    };

    // Biological States
    const isFatigued = somaState.energy < 20;
    const isCritical = somaState.energy < 5;
    const isSleeping = somaState.isSleeping;

    return (
        <div className={`flex h-[100dvh] text-gray-100 font-sans transition-all duration-100 overflow-hidden 
        ${isSleeping ? 'brightness-50 grayscale-[0.5]' : ''} 
        ${isFatigued && !isSleeping ? 'brightness-75' : ''}
    `}>

            {/* EXHAUSTION VIGNETTE */}
            <div className={`absolute inset-0 pointer-events-none z-50 transition-opacity duration-[3000ms]
          ${isFatigued ? 'opacity-100' : 'opacity-0'}
          bg-[radial-gradient(circle_at_center,transparent_50%,rgba(0,0,0,0.8)_100%)]
      `}></div>

            {/* SLEEP BLUR OVERLAY */}
            {isSleeping && (
                <div className="absolute inset-0 z-40 backdrop-blur-sm pointer-events-none animate-pulse bg-[#0a0c10]/40"></div>
            )}

            {/* LEFT SIDEBAR */}
            <LeftSidebar
                userId={userId}
                currentAgentName={currentAgent?.name || null}
                autonomousMode={autonomousMode}
                isSleeping={isSleeping}
                chemistryEnabled={chemistryEnabled}
                conversation={conversation}
                conversationSessions={conversationSessions}
                activeConversationSessionId={activeConversationSessionId}
                pinnedSessions={pinnedSessions}
                onLogout={logout}
                onToggleAutonomy={toggleAutonomy}
                onToggleSleep={toggleSleep}
                onToggleChemistry={toggleChemistry}
                onResetKernel={resetKernel}
                onSelectSession={selectConversationSession}
                onTogglePin={togglePin}
            />

            <div className="flex-1 flex flex-col relative z-10 min-w-0">
                {/* Header */}
                <header className={`h-16 border-b flex items-center justify-between px-6 transition-colors duration-1000 ${isFatigued ? 'bg-[#151010] border-red-900/20' : 'bg-brain-dark border-gray-700'}`}>
                    <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full transition-all duration-1000 
                    ${isProcessing ? 'bg-brain-accent shadow-[0_0_10px_#38bdf8]' : ''}
                    ${isSleeping ? 'bg-indigo-500 animate-[pulse_4s_infinite]' : ''}
                    ${!isProcessing && !isSleeping && isFatigued ? 'bg-yellow-600 animate-[pulse_2s_infinite]' : 'bg-green-500'}
                `}></div>
                        <h1 className="font-extrabold text-2xl tracking-tighter flex items-center gap-2 bg-gradient-to-r from-brain-accent to-cyan-200 bg-clip-text text-transparent">
                            AK-FLOW
                            <span className="text-gray-600 text-[10px] font-mono tracking-widest border border-gray-800 px-1.5 py-0.5 rounded ml-1">V4.0</span>
                        </h1>
                        <AgentSelector />
                    </div>
                    <div className="flex gap-4 text-xs font-mono text-gray-400 items-center relative">
                        <div className="flex items-center gap-2 opacity-50 hover:opacity-100 transition-opacity">
                            <span title="Session Usage">{sessionTokens.toLocaleString()} toks</span>
                        </div>

                        {traceHud && (
                            <button
                                onClick={() => setTraceHudOpen((v) => !v)}
                                className={`flex items-center gap-2 px-3 py-1 rounded border transition-all ${traceHud.skipped
                                    ? 'border-yellow-500/50 text-yellow-300 bg-yellow-900/10'
                                    : traceHud.lastCommit?.blocked
                                        ? 'border-orange-500/50 text-orange-300 bg-orange-900/10'
                                        : 'border-cyan-500/40 text-cyan-300 bg-cyan-900/10'
                                    }`}
                                title="Trace Debug"
                            >
                                <span className="text-[10px] tracking-widest">TRACE</span>
                                <span className="text-[10px]">#{traceHud.tickNumber ?? '—'}</span>
                                <span className="text-[10px] opacity-80">
                                    {traceHud.skipped
                                        ? 'SKIP'
                                        : traceHud.lastCommit?.blocked
                                            ? 'BLOCK'
                                            : 'OK'}
                                </span>
                            </button>
                        )}

                        {traceHudOpen && traceHud && (
                            <div className="absolute top-[52px] right-0 w-[420px] bg-[#0a0c10]/95 backdrop-blur-md border border-gray-800 rounded-xl shadow-xl p-4 z-50">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="text-[10px] font-mono tracking-widest text-gray-400">TRACE HUD</div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={toggleFrozen}
                                            className={`px-2 py-1 rounded border text-[10px] font-mono tracking-widest transition-colors ${traceHud?.traceId
                                                ? traceHudFrozen
                                                    ? 'border-yellow-500/40 text-yellow-300 bg-yellow-900/10'
                                                    : 'border-gray-700 text-gray-300 hover:bg-gray-900/40'
                                                : 'border-gray-800 text-gray-600 cursor-not-allowed'
                                                }`}
                                            title="Freeze HUD on current traceId"
                                            disabled={!traceHud?.traceId}
                                        >
                                            {traceHudFrozen ? 'FROZEN' : 'FREEZE'}
                                        </button>
                                        <button
                                            onClick={copyCurrentTrace}
                                            className={`px-2 py-1 rounded border text-[10px] font-mono tracking-widest transition-colors ${traceHud?.traceId
                                                ? traceHudCopyState === 'ok'
                                                    ? 'border-green-500/40 text-green-300 bg-green-900/10'
                                                    : traceHudCopyState === 'fail'
                                                        ? 'border-red-500/40 text-red-300 bg-red-900/10'
                                                        : 'border-gray-700 text-gray-300 hover:bg-gray-900/40'
                                                : 'border-gray-800 text-gray-600 cursor-not-allowed'
                                                }`}
                                            title="Copy trace events (JSON)"
                                            disabled={!traceHud?.traceId}
                                        >
                                            {traceHudCopyState === 'ok' ? 'COPIED' : traceHudCopyState === 'fail' ? 'COPY FAIL' : 'COPY FULL'}
                                        </button>
                                        <button
                                            onClick={() => copyCurrentTraceWithWindow(2000)}
                                            className={`px-2 py-1 rounded border text-[10px] font-mono tracking-widest transition-colors ${traceHud?.traceId
                                                ? traceHudCopyState === 'ok'
                                                    ? 'border-green-500/40 text-green-300 bg-green-900/10'
                                                    : traceHudCopyState === 'fail'
                                                        ? 'border-red-500/40 text-red-300 bg-red-900/10'
                                                        : 'border-gray-700 text-gray-300 hover:bg-gray-900/40'
                                                : 'border-gray-800 text-gray-600 cursor-not-allowed'
                                                }`}
                                            title="Copy trace events with ±2s window (captures correlated events with different traceIds)"
                                            disabled={!traceHud?.traceId}
                                        >
                                            COPY +2S
                                        </button>
                                        <button
                                            onClick={() => setTraceHudOpen(false)}
                                            className="text-gray-500 hover:text-gray-300 transition-colors text-[11px]"
                                        >
                                            CLOSE
                                        </button>
                                    </div>
                                </div>
                                <div className="space-y-2 text-[11px] font-mono">
                                    <div className="flex justify-between gap-3">
                                        <span className="text-gray-500">traceId</span>
                                        <span className="text-gray-200 truncate" title={traceHud.traceId || ''}>{traceHud.traceId || '—'}</span>
                                    </div>
                                    <div className="flex justify-between gap-3">
                                        <span className="text-gray-500">tickNumber</span>
                                        <span className="text-gray-200">{traceHud.tickNumber ?? '—'}</span>
                                    </div>
                                    <div className="flex justify-between gap-3">
                                        <span className="text-gray-500">durationMs</span>
                                        <span className="text-gray-200">{typeof traceHud.durationMs === 'number' ? traceHud.durationMs : '—'}</span>
                                    </div>
                                    <div className="flex justify-between gap-3">
                                        <span className="text-gray-500">skipped</span>
                                        <span className={`${traceHud.skipped ? 'text-yellow-300' : 'text-gray-200'}`}>{traceHud.skipped ? 'true' : 'false'}</span>
                                    </div>
                                    <div className="flex justify-between gap-3">
                                        <span className="text-gray-500">skipReason</span>
                                        <span className="text-gray-200 truncate" title={traceHud.skipReason || ''}>{traceHud.skipReason || '—'}</span>
                                    </div>

                                    <div className="mt-3 pt-3 border-t border-gray-800">
                                        <div className="text-[10px] font-mono tracking-widest text-gray-400 mb-2">LAST COMMIT</div>
                                        <div className="flex justify-between gap-3">
                                            <span className="text-gray-500">origin</span>
                                            <span className="text-gray-200">{traceHud.lastCommit?.origin || '—'}</span>
                                        </div>
                                        <div className="flex justify-between gap-3">
                                            <span className="text-gray-500">blocked</span>
                                            <span className={`${traceHud.lastCommit?.blocked ? 'text-orange-300' : 'text-gray-200'}`}>{String(!!traceHud.lastCommit?.blocked)}</span>
                                        </div>
                                        <div className="flex justify-between gap-3">
                                            <span className="text-gray-500">deduped</span>
                                            <span className={`${traceHud.lastCommit?.deduped ? 'text-orange-300' : 'text-gray-200'}`}>{String(!!traceHud.lastCommit?.deduped)}</span>
                                        </div>
                                        <div className="flex justify-between gap-3">
                                            <span className="text-gray-500">blockReason</span>
                                            <span className="text-gray-200 truncate" title={traceHud.lastCommit?.blockReason || ''}>{traceHud.lastCommit?.blockReason || '—'}</span>
                                        </div>
                                        <div className="flex justify-between gap-3">
                                            <span className="text-gray-500">counters</span>
                                            <span className="text-gray-200">
                                                {(traceHud.lastCommit?.counters?.totalCommits ?? 0)}/{(traceHud.lastCommit?.counters?.blockedCommits ?? 0)}/{(traceHud.lastCommit?.counters?.dedupedCommits ?? 0)}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        <button
                            onClick={toggleAutonomy}
                            className={`flex items-center gap-2 px-3 py-1 rounded border transition-all 
                        ${autonomousMode ? 'border-green-500 text-green-400 bg-green-900/20' : 'border-gray-600 text-gray-500 hover:bg-gray-800'} 
                        ${isCritical ? 'border-red-500/50 text-red-400' : ''}
                    `}
                        >
                            <Power size={12} /> {autonomousMode ? 'AUTONOMY: ON' : 'AUTONOMY: OFF'}
                        </button>
                    </div>
                </header>

                <div className={`min-h-14 py-3 border-b border-gray-700 flex items-start px-6 text-sm font-mono transition-colors duration-1000 ${systemError ? 'bg-red-900/20 text-red-400' :
                    isSleeping ? 'bg-indigo-950/20 text-indigo-300' :
                        isFatigued ? 'bg-[#1a1010] text-orange-300' :
                            'bg-brain-panel text-brain-accent'
                    }`}>
                    <span className="mr-2 font-bold flex items-center gap-2 opacity-70 shrink-0">
                        {isProcessing ? <Loader2 size={12} className="animate-spin" /> :
                            isSleeping ? <Moon size={12} /> :
                                isFatigued ? <EyeOff size={12} /> : <Zap size={12} />}

                        {systemError ? 'CRITICAL:' :
                            isSleeping ? 'REM STATE:' :
                                isFatigued ? 'DROWSY:' : 'CORTEX:'}
                    </span>
                    <span className={`${isProcessing ? 'animate-pulse' : ''} italic opacity-90 break-words overflow-wrap-anywhere`}>
                        {currentThought}
                    </span>
                </div>

                {/* Chat Area */}
                <ChatContainer
                    conversation={conversation}
                    systemError={systemError}
                    onRetry={retryLastAction}
                />

                {/* Input Area */}
                <ChatInput
                    value={input}
                    onChange={setInput}
                    onSend={onSend}
                    onToggleSleep={toggleSleep}
                    disabled={isSleeping || !!systemError}
                    isSleeping={isSleeping}
                    isFatigued={isFatigued}
                    isCritical={isCritical}
                />
            </div>

            {/* RIGHT: NEURO-MONITOR */}
            <div className="w-[450px] shrink-0 h-full border-l border-gray-800 hidden lg:block overflow-hidden bg-[#0a0c12]">
                <NeuroMonitor
                    limbicState={limbicState}
                    somaState={somaState}
                    resonanceField={resonanceField}
                    injectStateOverride={injectStateOverride}
                    neuroState={neuroState}
                    chemistryEnabled={chemistryEnabled}
                    onToggleChemistry={toggleChemistry}
                    goalState={goalState}
                />
            </div>
        </div>
    );
}

export default CognitiveInterface;
