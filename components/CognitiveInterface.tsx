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
import { Brain, Send, Moon, Sun, Loader2, Zap, Power, AlertTriangle, RefreshCw, EyeOff, Image as ImageIcon, Sparkles, Globe, FileText, LogOut } from 'lucide-react';

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

    const [traceHudOpen, setTraceHudOpen] = useState(false);
    const [traceHudCopyState, setTraceHudCopyState] = useState<'idle' | 'ok' | 'fail'>('idle');
    const [traceHudFrozen, setTraceHudFrozen] = useState(false);
    const traceHudFrozenRef = useRef(false);
    const [traceHud, setTraceHud] = useState<{
        traceId?: string;
        tickNumber?: number;
        skipped?: boolean;
        skipReason?: string | null;
        durationMs?: number;
        lastCommit?: {
            committed?: boolean;
            blocked?: boolean;
            deduped?: boolean;
            blockReason?: string;
            origin?: string;
            counters?: { totalCommits?: number; blockedCommits?: number; dedupedCommits?: number };
        };
    } | null>(null);

    // FAZA 5: Load full agent identity from DB
    const [loadedIdentity, setLoadedIdentity] = useState<AgentIdentity | null>(null);
    const [identityLoading, setIdentityLoading] = useState(true);
    const lastLoadedAgentIdRef = useRef<string | null>(null); // Guard against StrictMode double-fire

    // Set agent ID for memory service when it changes
    useEffect(() => {
        setCurrentAgentId(agentId);
    }, [agentId]);

    useEffect(() => {
        const unsubscribe = eventBus.subscribe(PacketType.SYSTEM_ALERT, (packet: any) => {
            const ev = packet?.payload?.event;
            if (!ev) return;

            if (traceHudFrozenRef.current && (ev === 'TICK_START' || ev === 'TICK_SKIPPED' || ev === 'TICK_COMMIT' || ev === 'TICK_END')) {
                return;
            }

            if (ev === 'TICK_START') {
                setTraceHud((prev) => ({
                    ...(prev || {}),
                    traceId: packet.traceId,
                    tickNumber: packet.payload?.tickNumber,
                    skipped: false,
                    skipReason: null,
                    durationMs: undefined,
                }));
                return;
            }

            if (ev === 'TICK_SKIPPED') {
                setTraceHud((prev) => ({
                    ...(prev || {}),
                    traceId: packet.traceId ?? prev?.traceId,
                    tickNumber: packet.payload?.tickNumber ?? prev?.tickNumber,
                    skipped: true,
                    skipReason: packet.payload?.reason ?? packet.payload?.skipReason ?? prev?.skipReason ?? null,
                }));
                return;
            }

            if (ev === 'TICK_COMMIT') {
                setTraceHud((prev) => ({
                    ...(prev || {}),
                    traceId: packet.traceId ?? prev?.traceId,
                    tickNumber: packet.payload?.tickNumber ?? prev?.tickNumber,
                    lastCommit: {
                        committed: packet.payload?.committed,
                        blocked: packet.payload?.blocked,
                        deduped: packet.payload?.deduped,
                        blockReason: packet.payload?.blockReason,
                        origin: packet.payload?.origin,
                        counters: packet.payload?.counters
                    }
                }));
                return;
            }

            if (ev === 'TICK_END') {
                setTraceHud((prev) => ({
                    ...(prev || {}),
                    traceId: packet.traceId ?? prev?.traceId,
                    tickNumber: packet.payload?.tickNumber ?? prev?.tickNumber,
                    skipped: packet.payload?.skipped ?? prev?.skipped,
                    skipReason: packet.payload?.skipReason ?? prev?.skipReason,
                    durationMs: packet.payload?.durationMs
                }));
            }
        });

        return () => unsubscribe();
    }, []);

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

    const copyTraceToClipboard = async (exportPayload: string) => {
        if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(exportPayload);
            return;
        }
        if (typeof document !== 'undefined') {
            const el = document.createElement('textarea');
            el.value = exportPayload;
            el.setAttribute('readonly', '');
            el.style.position = 'fixed';
            el.style.left = '-9999px';
            document.body.appendChild(el);
            el.select();
            document.execCommand('copy');
            document.body.removeChild(el);
            return;
        }
        throw new Error('clipboard_unavailable');
    };

    const sanitizeTracePacketForExport = (packet: any) => {
        const p = JSON.parse(JSON.stringify(packet));
        if (p?.payload) {
            if (p.payload.imageData && p.payload.imageData.length > 1000) p.payload.imageData = "[VISUAL DATA REMOVED]";
            if (p.payload.image_data && p.payload.image_data.length > 1000) p.payload.image_data = "[VISUAL DATA REMOVED]";
        }
        return p;
    };

    const buildTraceExportPayload = (packets: any[], meta: { windowMs: number; traceId?: string | null }) => {
        const traceId = meta.traceId ?? null;
        const traceEvents = traceId ? packets.filter((p: any) => p?.traceId === traceId) : [];
        const timestamps = traceEvents.map((p: any) => p?.timestamp).filter((t: any) => typeof t === 'number');
        const minTs = timestamps.length ? Math.min(...timestamps) : null;
        const maxTs = timestamps.length ? Math.max(...timestamps) : null;

        return JSON.stringify(
            {
                traceId,
                tickNumber: traceHud?.tickNumber ?? null,
                durationMs: typeof traceHud?.durationMs === 'number' ? traceHud?.durationMs : null,
                exportedAt: Date.now(),
                windowMs: meta.windowMs,
                tickEnvelope: traceId
                    ? {
                        traceId,
                        minTs,
                        maxTs,
                        eventCount: traceEvents.length
                    }
                    : null,
                events: packets.map(sanitizeTracePacketForExport)
            },
            null,
            2
        );
    };

    const dedupeAndSortPackets = (packets: any[]) => {
        const seen = new Set<string>();
        const out: any[] = [];
        for (const p of packets) {
            const id = p?.id;
            if (typeof id !== 'string') continue;
            if (seen.has(id)) continue;
            seen.add(id);
            out.push(p);
        }
        out.sort((a: any, b: any) => {
            const at = typeof a?.timestamp === 'number' ? a.timestamp : 0;
            const bt = typeof b?.timestamp === 'number' ? b.timestamp : 0;
            return at - bt;
        });
        return out;
    };

    const copyCurrentTrace = async () => {
        try {
            const traceId = traceHud?.traceId ?? null;
            const snapA = eventBus.getHistory().slice();
            const merged = dedupeAndSortPackets(snapA);
            const exportPayload = buildTraceExportPayload(merged, { windowMs: 0, traceId });

            await copyTraceToClipboard(exportPayload);

            setTraceHudCopyState('ok');
            setTimeout(() => setTraceHudCopyState('idle'), 1500);
        } catch {
            setTraceHudCopyState('fail');
            setTimeout(() => setTraceHudCopyState('idle'), 2000);
        }
    };

    const renderEvidenceSourceBadge = (evidenceSource?: string, evidenceDetail?: string) => {
        if (!evidenceSource) return null;

        const es = String(evidenceSource);
        const detail = typeof evidenceDetail === 'string' && evidenceDetail.trim() ? evidenceDetail.trim() : '';
        const label = detail ? `EVID:${es.toUpperCase()}(${detail.toUpperCase()})` : `EVID:${es.toUpperCase()}`;

        const cls = es === 'tool'
            ? 'border-emerald-500/40 bg-emerald-900/10 text-emerald-300'
            : es === 'memory'
                ? 'border-violet-500/40 bg-violet-900/10 text-violet-300'
                : es === 'system'
                    ? 'border-red-500/40 bg-red-900/10 text-red-300'
                    : 'border-gray-500/40 bg-gray-900/10 text-gray-300';

        return (
            <span className={`ml-2 inline-flex items-center px-2 py-0.5 rounded border text-[9px] font-mono tracking-widest ${cls}`}>
                {label}
            </span>
        );
    };

    const renderGeneratorBadge = (generator?: string) => {
        if (!generator) return null;

        const gen = String(generator);
        const label = `GEN:${gen.toUpperCase()}`;

        const cls = gen === 'system'
            ? 'border-red-500/40 bg-red-900/10 text-red-300'
            : 'border-gray-500/40 bg-gray-900/10 text-gray-300';

        return (
            <span className={`ml-2 inline-flex items-center px-2 py-0.5 rounded border text-[9px] font-mono tracking-widest ${cls}`}>
                {label}
            </span>
        );
    };

    const copyCurrentTraceWithWindow = async (windowMs: number) => {
        try {
            const traceId = traceHud?.traceId ?? null;
            const snapA = eventBus.getHistory().slice();
            await new Promise((r) => setTimeout(r, Math.max(0, windowMs)));
            const snapB = eventBus.getHistory().slice();
            const merged = dedupeAndSortPackets([...snapA, ...snapB]);
            const exportPayload = buildTraceExportPayload(merged, { windowMs, traceId });

            await copyTraceToClipboard(exportPayload);

            setTraceHudCopyState('ok');
            setTimeout(() => setTraceHudCopyState('idle'), 1500);
        } catch {
            setTraceHudCopyState('fail');
            setTimeout(() => setTraceHudCopyState('idle'), 2000);
        }
    };

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

            {/* LEFT SIDEBAR: Session/Settings/Conversation (desktop only) */}
            <div className="hidden xl:flex w-[280px] shrink-0 h-full border-r border-gray-800 bg-[#0f1219] flex-col relative z-10">
                {/* Session Info */}
                <div className="p-4 border-b border-gray-800 bg-[#0a0c10]">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_10px_#38bdf8]" />
                            <div className="text-[10px] font-mono tracking-widest text-gray-300">SESSION</div>
                        </div>
                        <button
                            onClick={() => logout()}
                            className="text-gray-500 hover:text-red-400 transition-colors"
                            title="Logout"
                        >
                            <LogOut size={14} />
                        </button>
                    </div>
                    <div className="mt-3 space-y-1">
                        <div className="text-[10px] text-gray-500 font-mono truncate">{userId || '—'}</div>
                        <div className="text-sm text-gray-200 font-semibold truncate">{currentAgent?.name || 'No agent selected'}</div>
                    </div>
                    <div className="mt-3">
                        <AgentSelector />
                    </div>
                </div>

                {/* Quick Settings */}
                <div className="p-4 border-b border-gray-800">
                    <div className="text-[10px] font-mono tracking-widest text-gray-500 mb-3">QUICK SETTINGS</div>
                    <div className="grid grid-cols-1 gap-2">
                        <button
                            onClick={toggleAutonomy}
                            className={`flex items-center justify-between px-3 py-2 rounded-lg border text-[11px] font-mono transition-colors ${autonomousMode ? 'border-green-500/50 bg-green-900/20 text-green-300' : 'border-gray-700 bg-gray-900/30 text-gray-400 hover:bg-gray-900/60'}`}
                        >
                            <span className="flex items-center gap-2"><Power size={12} /> AUTONOMY</span>
                            <span>{autonomousMode ? 'ON' : 'OFF'}</span>
                        </button>

                        <button
                            onClick={toggleSleep}
                            className={`flex items-center justify-between px-3 py-2 rounded-lg border text-[11px] font-mono transition-colors ${isSleeping ? 'border-indigo-500/50 bg-indigo-900/20 text-indigo-300' : 'border-gray-700 bg-gray-900/30 text-gray-400 hover:bg-gray-900/60'}`}
                        >
                            <span className="flex items-center gap-2">{isSleeping ? <Sun size={12} /> : <Moon size={12} />} SLEEP</span>
                            <span>{isSleeping ? 'ON' : 'OFF'}</span>
                        </button>

                        {typeof chemistryEnabled === 'boolean' && (
                            <button
                                onClick={toggleChemistry}
                                className={`flex items-center justify-between px-3 py-2 rounded-lg border text-[11px] font-mono transition-colors ${chemistryEnabled ? 'border-purple-500/50 bg-purple-900/20 text-purple-300' : 'border-gray-700 bg-gray-900/30 text-gray-400 hover:bg-gray-900/60'}`}
                            >
                                <span className="flex items-center gap-2"><Zap size={12} /> CHEM</span>
                                <span>{chemistryEnabled ? 'ON' : 'OFF'}</span>
                            </button>
                        )}

                        <button
                            onClick={resetKernel}
                            className="flex items-center justify-between px-3 py-2 rounded-lg border border-gray-700 bg-gray-900/30 text-[11px] font-mono text-gray-400 hover:bg-gray-900/60 transition-colors"
                        >
                            <span className="flex items-center gap-2"><RefreshCw size={12} /> RESET</span>
                            <span>NOW</span>
                        </button>
                    </div>
                </div>

                <LibraryPanel />

                <div className="p-4 border-b border-gray-800">
                    <div className="flex items-center justify-between mb-2">
                        <div className="text-[10px] font-mono tracking-widest text-gray-500">CONVERSATIONS</div>
                        <div className="text-[10px] font-mono text-gray-600">{conversationSessions?.length ?? 0}</div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 mb-3">
                        <button
                            onClick={() => selectConversationSession(activeConversationSessionId)}
                            className="px-3 py-2 rounded-lg border border-gray-700 bg-gray-900/30 text-[11px] font-mono text-gray-300 hover:bg-gray-900/60 transition-colors"
                            title="Continue active session"
                            disabled={!activeConversationSessionId}
                        >
                            CONTINUE
                        </button>
                        <button
                            onClick={() => selectConversationSession(null)}
                            className="px-3 py-2 rounded-lg border border-gray-700 bg-gray-900/30 text-[11px] font-mono text-gray-300 hover:bg-gray-900/60 transition-colors"
                            title="Start new session thread"
                        >
                            NEW
                        </button>
                    </div>

                    <div className="space-y-2">
                        {(conversationSessions || []).slice(0, 25).map((s) => {
                            const isActive = activeConversationSessionId === s.sessionId;
                            const label = s.preview || s.sessionId;
                            const ts = Number.isFinite(s.lastTimestamp) ? new Date(s.lastTimestamp).toLocaleString() : '';
                            return (
                                <button
                                    key={s.sessionId}
                                    onClick={() => selectConversationSession(s.sessionId)}
                                    className={`w-full text-left rounded-lg border px-3 py-2 text-[11px] transition-colors ${isActive
                                        ? 'border-cyan-500/40 bg-cyan-900/10 text-cyan-100'
                                        : 'border-gray-800 bg-gray-900/20 text-gray-200 hover:bg-gray-900/40'
                                        }`}
                                    title={s.sessionId}
                                >
                                    <div className="flex items-center justify-between gap-2 mb-1">
                                        <span className="text-[9px] font-mono uppercase tracking-wider text-gray-500">{ts || '—'}</span>
                                        <span className="text-[9px] font-mono text-gray-600">{s.messageCount}</span>
                                    </div>
                                    <div className="break-words opacity-90">
                                        {String(label).slice(0, 120)}{String(label).length > 120 ? '…' : ''}
                                    </div>
                                </button>
                            );
                        })}

                        {(conversationSessions || []).length === 0 && (
                            <div className="text-[11px] text-gray-600 italic">No archived sessions yet.</div>
                        )}
                    </div>
                </div>

                {/* Last Conversation Preview */}
                <div className="flex-1 overflow-y-auto p-4">
                    <div className="flex items-center justify-between mb-2">
                        <div className="text-[10px] font-mono tracking-widest text-gray-500">LAST CONVERSATION</div>
                        <div className="text-[10px] font-mono text-gray-600">{conversation.length}</div>
                    </div>
                    <div className="space-y-2">
                        {conversation.slice(-25).reverse().map((msg, idx) => (
                            <div
                                key={`sidebar-${msg.role}-${idx}`}
                                className={`rounded-lg border px-3 py-2 text-[11px] leading-snug ${msg.role === 'user'
                                    ? 'border-blue-900/30 bg-blue-900/10 text-blue-100'
                                    : msg.type === 'thought'
                                        ? 'border-gray-800 bg-gray-900/30 text-gray-400 italic'
                                        : 'border-gray-800 bg-gray-900/20 text-gray-200'
                                    }`}
                            >
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-[9px] font-mono uppercase tracking-wider text-gray-500">{msg.role}</span>
                                    <span className="text-[9px] font-mono text-gray-600">{msg.type || 'speech'}</span>
                                </div>
                                <div className="break-words opacity-90">
                                    {String(msg.text || '').slice(0, 140)}{String(msg.text || '').length > 140 ? '…' : ''}
                                </div>
                            </div>
                        ))}
                        {conversation.length === 0 && (
                            <div className="text-[11px] text-gray-600 italic">No messages yet.</div>
                        )}
                    </div>
                </div>
            </div>

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
                                            onClick={() => {
                                                if (!traceHud?.traceId) return;
                                                setTraceHudFrozen((prev) => {
                                                    const next = !prev;
                                                    traceHudFrozenRef.current = next;
                                                    return next;
                                                });
                                            }}
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
                <div ref={chatScrollRef} className="flex-1 min-h-0 overflow-y-auto p-6 space-y-6 bg-gradient-to-b from-brain-dark to-gray-900 scrollbar-thin relative">
                    {conversation.length === 0 && (
                        <div className="h-full flex flex-col items-center justify-center text-gray-600 opacity-50">
                            <Brain size={64} className="mb-4" />
                            <p>Cognitive Kernel Active.</p>
                        </div>
                    )}
                    {conversation.map((msg, idx) => (
                        <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} relative z-10 animate-in slide-in-from-bottom-2 fade-in duration-500`}>

                            {/* 1. VISUAL DREAM CARD */}
                            {msg.type === 'visual' ? (
                                <div className="max-w-[75%] bg-black/60 border border-pink-500/50 rounded-xl overflow-hidden shadow-[0_0_30px_rgba(236,72,153,0.15)] group hover:shadow-[0_0_50px_rgba(236,72,153,0.3)] transition-shadow duration-500">
                                    <div className="h-64 w-full bg-gray-900 relative overflow-hidden">
                                        {msg.imageData ? (
                                            <img src={msg.imageData} alt="Dream" className="w-full h-full object-cover animate-in fade-in duration-1000 group-hover:scale-105 transition-transform duration-1000" />
                                        ) : (
                                            <div className="w-full h-full flex flex-col items-center justify-center text-pink-700/50 font-mono text-xs gap-2">
                                                <ImageIcon size={32} />
                                                <span>[VISUAL MEMORY CORRUPTED]</span>
                                            </div>
                                        )}
                                        <div className="absolute top-0 inset-x-0 p-3 bg-gradient-to-b from-black/80 to-transparent flex justify-between items-start">
                                            <div className="px-2 py-1 text-[9px] text-pink-300 font-bold tracking-widest border border-pink-500/30 rounded bg-black/40 backdrop-blur-sm flex items-center gap-2 shadow-lg">
                                                <Sparkles size={10} /> VISUAL CORTEX OUTPUT
                                            </div>
                                        </div>
                                    </div>
                                    <div className="p-4 bg-gray-900/90 backdrop-blur-md border-t border-gray-800">
                                        <p className="text-sm text-pink-100 font-serif leading-relaxed italic">"{msg.text}"</p>
                                    </div>
                                </div>

                                /* 2. INTELLIGENCE BRIEFING CARD (SEARCH) */
                            ) : msg.type === 'intel' ? (
                                <div className="max-w-[85%] bg-[#0a1018] border-l-4 border-cyan-500 rounded-r-lg shadow-lg overflow-hidden">
                                    <div className="bg-cyan-950/20 p-2 px-4 border-b border-cyan-900/30 flex justify-between items-center">
                                        <span className="text-[10px] font-bold text-cyan-400 flex items-center gap-2 tracking-widest uppercase">
                                            <Globe size={12} /> Intelligence Briefing
                                        </span>
                                        <span className="text-[9px] text-cyan-600 font-mono">{new Date().toLocaleTimeString()}</span>
                                    </div>
                                    <div className="p-4 text-sm text-gray-300 font-mono leading-relaxed whitespace-pre-wrap">
                                        {msg.text}
                                    </div>
                                    {msg.sources && msg.sources.length > 0 && (
                                        <div className="bg-[#05080c] p-2 px-4 border-t border-gray-800 flex flex-wrap gap-2">
                                            {msg.sources.map((src: any, i: number) => (
                                                <a key={i} href={src.uri} target="_blank" rel="noopener noreferrer" className="text-[10px] text-cyan-600 hover:text-cyan-400 flex items-center gap-1 bg-cyan-900/10 px-2 py-1 rounded border border-cyan-900/30 transition-colors">
                                                    <FileText size={8} /> {src.title.substring(0, 20)}...
                                                </a>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                /* 3. STANDARD MESSAGE OR THOUGHT */
                            ) : (
                                <div className={`max-w-[85%] rounded-lg shadow-2xl overflow-hidden ${msg.role === 'user'
                                    ? 'bg-gradient-to-br from-blue-900/90 to-blue-800/80 text-white rounded-br-none border border-blue-600/50 backdrop-blur-sm'
                                    : msg.type === 'thought'
                                        ? 'bg-gradient-to-br from-gray-900/80 to-gray-800/60 text-gray-400 italic border border-dashed border-gray-700/50 backdrop-blur-sm'
                                        : 'bg-gradient-to-br from-gray-800/90 to-gray-700/80 text-gray-100 rounded-bl-none border border-gray-600/50 backdrop-blur-sm shadow-[0_0_20px_rgba(56,189,248,0.15)]'
                                    }`}>
                                    {msg.type === 'thought' && (
                                        <div className="bg-black/30 px-3 py-1.5 border-b border-gray-700/50">
                                            <span className="text-[10px] text-gray-500 uppercase tracking-widest flex items-center gap-1.5 font-bold">
                                                <Brain size={10} /> INTERNAL MONOLOGUE
                                            </span>
                                        </div>
                                    )}
                                    {msg.role !== 'user' && msg.type !== 'thought' && (
                                        <div className="bg-gradient-to-r from-cyan-900/30 to-transparent px-3 py-1.5 border-b border-cyan-800/30">
                                            <span className="text-[10px] text-cyan-400 uppercase tracking-widest flex items-center gap-1.5 font-bold">
                                                <Sparkles size={10} /> COGNITIVE OUTPUT
                                                {renderEvidenceSourceBadge((msg as any)?.evidenceSource ?? (msg as any)?.knowledgeSource, (msg as any)?.evidenceDetail)}
                                                {renderGeneratorBadge((msg as any)?.generator)}
                                            </span>
                                        </div>
                                    )}
                                    <div className="p-4 px-5">
                                        <p className={`leading-relaxed ${msg.type === 'thought' ? 'text-sm font-mono opacity-80' : 'text-base font-medium'}`}>
                                            {msg.text}
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}

                    {/* SYSTEM ERROR ALERT */}
                    {systemError && (
                        <div className="flex justify-center animate-pulse z-20 relative">
                            <div className="bg-red-900/20 border border-red-600/50 rounded p-4 max-w-md w-full flex flex-col gap-2">
                                <div className="flex items-center gap-2 text-red-400 font-bold text-sm uppercase tracking-widest">
                                    <AlertTriangle size={16} />
                                    {systemError.code}
                                </div>
                                <div className="text-xs text-red-300 font-mono">
                                    {systemError.message}
                                </div>
                                {systemError.retryable && (
                                    <button
                                        onClick={retryLastAction}
                                        className="mt-2 bg-red-900/50 hover:bg-red-800 text-red-200 text-xs py-2 px-4 rounded flex items-center justify-center gap-2 transition-colors border border-red-700"
                                    >
                                        <RefreshCw size={12} /> RETRY CONNECTION
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                    <div ref={chatEndRef} />
                </div>

                {/* Input Area */}
                <div className={`p-4 border-t transition-colors duration-1000 ${isFatigued ? 'bg-[#151010] border-red-900/20' : 'bg-brain-dark border-gray-700'}`}>
                    <div className="relative flex items-center">
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && onSend()}
                            placeholder={
                                isSleeping ? "System is Dreaming (REM Cycle active)..." :
                                    isCritical ? "Consciousness fading..." :
                                        isFatigued ? "Alberto is tired..." :
                                            "Inject data into the cognitive stream..."
                            }
                            disabled={isSleeping || !!systemError}
                            className={`w-full bg-gray-900/80 text-white rounded-2xl px-8 py-5 pr-16 focus:outline-none focus:ring-2 border placeholder-gray-600 shadow-2xl transition-all text-lg ${isSleeping
                                ? 'border-indigo-500/30 opacity-50 cursor-not-allowed italic'
                                : isFatigued
                                    ? 'border-orange-900/50 focus:ring-orange-800'
                                    : 'border-gray-700 focus:ring-brain-accent hover:border-gray-500'
                                }`}
                        />
                        <button
                            onClick={onSend}
                            disabled={isSleeping || !input.trim() || !!systemError}
                            className={`absolute right-2 p-2 rounded-full text-brain-dark transition-all disabled:opacity-50 disabled:cursor-not-allowed
                         ${isFatigued ? 'bg-orange-600 hover:bg-orange-500' : 'bg-brain-accent hover:bg-white'}
                    `}
                        >
                            <Send size={20} />
                        </button>
                    </div>
                    <div className="flex justify-end mt-2 px-2">
                        <button
                            onClick={toggleSleep}
                            className={`text-xs flex items-center gap-1 hover:text-white transition-all duration-300 border px-3 py-1 rounded-full ${isSleeping
                                ? "border-indigo-500/50 text-indigo-300 bg-indigo-900/20 animate-pulse"
                                : isFatigued
                                    ? "border-orange-500/50 text-orange-400 bg-orange-900/20 animate-pulse"
                                    : "border-gray-700 text-gray-500 hover:bg-gray-800"
                                }`}
                        >
                            {isSleeping ? <Sun size={12} /> : <Moon size={12} />}
                            {isSleeping
                                ? "WAKE UP"
                                : isCritical
                                    ? "DRIFTING..."
                                    : isFatigued
                                        ? "ALLOW REST"
                                        : "FORCE SLEEP"}
                        </button>
                    </div>
                </div>
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
