
import React, { useEffect, useState, useRef } from 'react';
import { eventBus } from '../core/EventBus';
import { CognitivePacket, LimbicState, PacketType, AgentType, SomaState, ResonanceField, NeurotransmitterState, GoalState } from '../types';
import { Activity, Zap, Database, Copy, Check, Cpu, Download, Share2, BrainCircuit, ShieldAlert, Radio, Moon, Image as ImageIcon, ExternalLink, Globe, Waves, Eye, BedDouble, Scale } from 'lucide-react';
import { ConfessionLog } from './ConfessionLog';
import { VitalsPanel } from './neuro/VitalsPanel';

interface NeuroMonitorProps {
    limbicState: LimbicState;
    somaState: SomaState;
    resonanceField?: ResonanceField;
    injectStateOverride?: (type: 'limbic' | 'soma', key: string, value: number) => void;
    neuroState?: NeurotransmitterState;
    chemistryEnabled?: boolean;
    onToggleChemistry?: () => void;
    goalState?: GoalState;
}

const AGENT_LAYOUT: Record<string, { x: number, y: number, label: string, color: string }> = {
    [AgentType.CORTEX_FLOW]: { x: 50, y: 50, label: 'CORTEX', color: '#38bdf8' },
    [AgentType.CORTEX_CONFLICT]: { x: 75, y: 35, label: 'CONFLICT', color: '#fbbf24' },
    [AgentType.MEMORY_EPISODIC]: { x: 50, y: 15, label: 'EPISODIC', color: '#c084fc' },
    [AgentType.SENSORY_TEXT]: { x: 10, y: 40, label: 'TXT_IN', color: '#22c55e' },
    [AgentType.SENSORY_VISUAL]: { x: 10, y: 55, label: 'VIS_IN', color: '#10b981' },
    [AgentType.SENSORY_AUDIO]: { x: 10, y: 70, label: 'AUD_IN', color: '#34d399' },
    [AgentType.LIMBIC]: { x: 90, y: 50, label: 'EMOTION', color: '#ef4444' },
    [AgentType.SOMA]: { x: 90, y: 80, label: 'BIOMETRY', color: '#f97316' },
    [AgentType.MOTOR]: { x: 50, y: 90, label: 'MOTOR', color: '#94a3b8' },
    [AgentType.MORAL]: { x: 25, y: 25, label: 'MORAL', color: '#14b8a6' },
    [AgentType.VISUAL_CORTEX]: { x: 25, y: 75, label: 'VISION', color: '#f472b6' },
    [AgentType.NEUROCHEM]: { x: 75, y: 65, label: 'CHEMICAL', color: '#a855f7' },
    [AgentType.GLOBAL_FIELD]: { x: 50, y: 70, label: 'CEMI', color: '#22d3ee' },
};

const SQL_SETUP_CODE = `-- AK - FLOW V3.1 SQL
--Adds Visual Memory support(11 / 10 Upgrade)

--1. Ensure extension for Vectors
create extension if not exists vector;

--2. Create / Update Memories Table
create table if not exists memories(
    id uuid primary key default gen_random_uuid(),
    user_id uuid default auth.uid(),
    raw_text text,
    embedding vector(768),
    created_at timestamptz default now(),
    neural_strength int default 1,
    is_core_memory boolean default false,
    last_accessed_at timestamptz default now(),
    --NEW V3.1 COLUMNS:
    image_data text, --Stores Compressed Base64
  is_visual_dream boolean default false
);

--3. Match Function(Biological Search)
create or replace function match_memories(
    query_embedding vector(768),
        match_threshold float,
            match_count int
)
returns table(
                id uuid,
                raw_text text,
                neural_strength int,
                is_core_memory boolean,
                similarity float,
                image_data text, --Return images
  is_visual_dream boolean
            )
language sql stable
as $$
select
id,
    raw_text,
    neural_strength,
    is_core_memory,
    1 - (memories.embedding <=> query_embedding) as similarity,
    image_data,
    is_visual_dream
  from memories
  where 1 - (memories.embedding <=> query_embedding) > match_threshold
  order by similarity desc
  limit match_count;
$$;

--4. Reinforce Function(Hebbian)
create or replace function reinforce_memory(row_id uuid, amount int)
returns void language plpgsql as $$
begin
  update memories
  set neural_strength = neural_strength + amount,
    last_accessed_at = now()
  where id = row_id;
end;
$$; `;

type Tab = 'SYSTEM' | 'MIND' | 'SLEEP' | 'NETWORK' | 'SQL' | 'DEBUG';

export const NeuroMonitor: React.FC<NeuroMonitorProps> = ({ limbicState, somaState, resonanceField, injectStateOverride, neuroState, chemistryEnabled, onToggleChemistry, goalState }) => {
    const [packets, setPackets] = useState<CognitivePacket[]>([]);
    const [flowBursts5m, setFlowBursts5m] = useState<number>(0);
    const [recentNeuroSamples, setRecentNeuroSamples] = useState<{ dopamine: number; serotonin: number }[]>([]);
    const [dreamConsolidations5m, setDreamConsolidations5m] = useState<number>(0);
    const [recentDreamSummaries, setRecentDreamSummaries] = useState<{ timestamp: number; summary: string }[]>([]);
    const [sleepEvents, setSleepEvents] = useState<{ timestamp: number; type: 'SLEEP_START' | 'SLEEP_END'; energy: number }[]>([]);
    const [traitProposals, setTraitProposals] = useState<{ timestamp: number; proposal: any; reasoning: string }[]>([]);
    const [dreamLessons, setDreamLessons] = useState<{ timestamp: number; lessons: string[] }[]>([]);
    const [logFilter, setLogFilter] = useState<'ALL' | 'DREAMS' | 'CHEM' | 'SPEECH' | 'ERRORS' | 'FLOW' | 'CONFESS'>('ALL');
    const [activeTab, setActiveTab] = useState<Tab>('SYSTEM');
    const [copied, setCopied] = useState(false);
    const [agentActivity, setAgentActivity] = useState<Record<string, number>>({});
    const scrollRef = useRef<HTMLDivElement>(null);
    const stateRef = useRef({ limbicState, somaState });

    useEffect(() => {
        stateRef.current = { limbicState, somaState };
    }, [limbicState, somaState]);

    useEffect(() => {
        if (activeTab !== 'SQL' && activeTab !== 'NETWORK' && activeTab !== 'DEBUG' && scrollRef.current) {
            const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
            if (scrollHeight - scrollTop - clientHeight < 150) {
                scrollRef.current.scrollTop = scrollHeight;
            }
        }
    }, [packets, activeTab]);

    useEffect(() => {
        // Graph Activity Loop (Fast)
        const activityInterval = setInterval(() => {
            setAgentActivity(prev => {
                const next = { ...prev };
                let changed = false;
                Object.keys(next).forEach(k => {
                    if (next[k] > 0) {
                        // 11/10 UPGRADE: Slower decay (0.01) for longer "afterglow"
                        next[k] = Math.max(0, next[k] - 0.01);
                        changed = true;
                    }
                });
                return changed ? next : prev;
            });
        }, 50);

        // Packet Listener Loop (Slower)
        const packetInterval = setInterval(() => {
            const history = eventBus.getHistory();
            const recentPackets = history.slice(-100);
            setPackets(recentPackets);

            const now = Date.now();

            // Add bursts based on new packets
            // 11/10 UPGRADE: Look back 200ms to catch everything
            history.filter(p => now - p.timestamp < 200).forEach(p => {
                // SUPERCHARGE: Set to 2.0 so it stays "max bright" (1.0+) for a while before fading
                setAgentActivity(prev => ({ ...prev, [p.source]: 2.0 }));
            });

            // CHEM DASHBOARD: FLOW BURSTS + recent dopamine/serotonin
            const fiveMinutesAgo = now - 5 * 60 * 1000;
            const chemPackets = history.filter(p => p.source === AgentType.NEUROCHEM && p.timestamp >= fiveMinutesAgo);

            const bursts = chemPackets.filter(p => p.type === PacketType.SYSTEM_ALERT && p.payload?.event === 'CHEM_FLOW_ON').length;
            setFlowBursts5m(bursts);

            const neuroStates = chemPackets
                .filter(p => p.type === PacketType.STATE_UPDATE)
                .map(p => ({
                    dopamine: p.payload?.dopamine ?? 0,
                    serotonin: p.payload?.serotonin ?? 0
                }));

            const lastSamples = neuroStates.slice(-20); // last 20 samples
            setRecentNeuroSamples(lastSamples);

            // DREAM DASHBOARD: count consolidations & capture recent summaries
            const dreamPackets = history.filter(p =>
                p.source === AgentType.MEMORY_EPISODIC &&
                p.type === PacketType.SYSTEM_ALERT &&
                p.timestamp >= fiveMinutesAgo &&
                p.payload?.event === 'DREAM_CONSOLIDATION_COMPLETE'
            );

            setDreamConsolidations5m(dreamPackets.length);

            const dreamSummaries = dreamPackets
                .slice(-5)
                .map(p => ({
                    timestamp: p.timestamp,
                    summary: (p.payload?.summary || p.payload?.note || '').toString()
                }));
            setRecentDreamSummaries(dreamSummaries);

            // SLEEP DASHBOARD: track sleep events
            const sleepPackets = history.filter(p =>
                (p.payload?.event === 'SLEEP_START' || p.payload?.event === 'SLEEP_END') &&
                p.timestamp >= fiveMinutesAgo
            );

            const sleepEventList = sleepPackets.map(p => ({
                timestamp: p.timestamp,
                type: p.payload?.event as 'SLEEP_START' | 'SLEEP_END',
                energy: p.payload?.energy || somaState?.energy || 0
            }));
            setSleepEvents(sleepEventList);

            // SLEEP DASHBOARD: track trait evolution proposals
            const traitPackets = history.filter(p =>
                p.payload?.event === 'TRAIT_EVOLUTION_PROPOSAL' &&
                p.timestamp >= fiveMinutesAgo
            );

            const traitProposalList = traitPackets.map(p => ({
                timestamp: p.timestamp,
                proposal: p.payload?.traitProposal || {},
                reasoning: p.payload?.reasoning || ''
            }));
            setTraitProposals(traitProposalList);

            // SLEEP DASHBOARD: extract dream lessons
            const lessonPackets = history.filter(p =>
                p.payload?.event === 'DREAM_CONSOLIDATION_COMPLETE' &&
                p.payload?.lessons &&
                p.timestamp >= fiveMinutesAgo
            );

            const lessonList = lessonPackets.map(p => ({
                timestamp: p.timestamp,
                lessons: p.payload?.lessons || []
            }));
            setDreamLessons(lessonList);

        }, 100); // Faster polling for snappier response

        return () => {
            clearInterval(activityInterval);
            clearInterval(packetInterval);
        };
    }, []);

    const handleCopy = () => {
        navigator.clipboard.writeText(SQL_SETUP_CODE);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleExportLogs = () => {
        const fullHistory = eventBus.getHistory();
        const sanitizedHistory = fullHistory.map(packet => {
            const p = JSON.parse(JSON.stringify(packet));
            if (p.payload) {
                // We keep small thumbnails but remove massive base64 blocks for export clarity
                if (p.payload.imageData && p.payload.imageData.length > 1000) p.payload.imageData = "[VISUAL DATA REMOVED]";
                if (p.payload.image_data && p.payload.image_data.length > 1000) p.payload.image_data = "[VISUAL DATA REMOVED]";
            }
            return p;
        });
        const blob = new Blob([JSON.stringify({ logs: sanitizedHistory }, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const date = new Date();
        const dateStr = date.toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ak-flow-log-${dateStr}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    const renderPayload = (packet: CognitivePacket) => {
        // NEUROCHEMISTRY SNAPSHOTS (Chemical Soul v1)
        if (packet.source === AgentType.NEUROCHEM && packet.type === PacketType.STATE_UPDATE) {
            const p: any = packet.payload || {};
            return (
                <div className="space-y-1 text-[10px] text-purple-200">
                    <div className="flex justify-between text-[9px] text-purple-300">
                        <span>Context</span>
                        <span className="font-mono">{p.context || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                        <span>DOPAMINE</span>
                        <span className="font-mono">{(p.dopamine ?? 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                        <span>SEROTONIN</span>
                        <span className="font-mono">{(p.serotonin ?? 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                        <span>NOREPI</span>
                        <span className="font-mono">{(p.norepinephrine ?? 0).toFixed(2)}</span>
                    </div>
                </div>
            );
        }

        // NEUROCHEMISTRY EVENTS (FLOW / BIAS)
        if (packet.source === AgentType.NEUROCHEM && packet.type === PacketType.SYSTEM_ALERT) {
            const p: any = packet.payload || {};
            if (p.event === 'CHEM_FLOW_ON' || p.event === 'CHEM_FLOW_OFF') {
                return (
                    <div className="text-[10px] text-purple-200 space-y-1">
                        <div className="flex justify-between">
                            <span className="font-mono">{p.event}</span>
                            <span className="font-mono">D={p.dopamine?.toFixed(2)}</span>
                        </div>
                        {p.activity && (
                            <div className="text-[9px] text-purple-300">activity: {p.activity}</div>
                        )}
                    </div>
                );
            }

            if (p.event === 'DOPAMINE_VOICE_BIAS') {
                return (
                    <div className="text-[10px] text-purple-200 space-y-1">
                        <div className="flex justify-between">
                            <span className="font-mono">VOICE BIAS</span>
                            <span className="font-mono">D={p.dopamine?.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-[9px] text-purple-300">
                            <span>base → biased</span>
                            <span className="font-mono">{p.base_voice_pressure?.toFixed(2)} → {p.biased_voice_pressure?.toFixed(2)}</span>
                        </div>
                    </div>
                );
            }
        }
        // VISUAL PERCEPTION (NEW 11/10 Feature)
        if (packet.type === PacketType.VISUAL_PERCEPTION) {
            return (
                <div className="mt-2 border-l-2 border-purple-400 pl-2 bg-purple-900/10 p-2 rounded-r">
                    <div className="text-[10px] text-purple-300 font-bold mb-1 flex items-center gap-2">
                        <Eye size={12} /> VISUAL PERCEPTION
                    </div>
                    <div className="text-[9px] text-gray-300 italic mb-1">
                        Target: "{packet.payload.prompt}"
                    </div>
                    <div className="text-[9px] text-purple-100 border-t border-purple-500/30 pt-1">
                        {packet.payload.perception_text}
                    </div>
                </div>
            );
        }

        // VISUAL THOUGHT with Preview
        if (packet.type === PacketType.VISUAL_THOUGHT) {
            return (
                <div className="mt-2 border-l-2 border-pink-500 pl-2 bg-pink-900/10 p-2 rounded-r">
                    <div className="text-[10px] text-pink-300 font-bold mb-1 flex items-center gap-2">
                        <ImageIcon size={12} /> VISUAL CORTEX
                    </div>
                    {packet.payload.prompt && <div className="text-[9px] text-gray-300 italic mb-2">"{packet.payload.prompt}"</div>}
                    {/* Handle Perception Analysis Log specifically */}
                    {packet.payload.perception_text && (
                        <div className="text-[9px] text-pink-200 border-t border-pink-500/30 pt-1 mt-1">
                            <span className="font-bold">PERCEPTION:</span> {packet.payload.perception_text}
                        </div>
                    )}
                    {packet.payload.imageData && (
                        <div className="mt-1 w-full max-w-[150px] aspect-square rounded overflow-hidden border border-pink-500/30">
                            <img src={packet.payload.imageData} className="w-full h-full object-cover" alt="dream_thumb" />
                        </div>
                    )}
                    {packet.payload.status && <div className="text-[8px] text-pink-500 mt-1">{packet.payload.status}</div>}
                </div>
            );
        }
        // DEEP RESEARCH
        if (packet.payload?.action === "DEEP_RESEARCH_COMPLETE") {
            return (
                <div className="mt-2 space-y-2">
                    <div className="text-[10px] text-cyan-300 font-bold border-b border-cyan-800 pb-1 mb-1">
                        RESEARCH: "{packet.payload.topic}"
                    </div>
                    {packet.payload.found_sources && (
                        <div className="flex flex-wrap gap-1">
                            {packet.payload.found_sources.map((src: any, i: number) => (
                                <a key={i} href={src.uri} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 bg-cyan-900/30 border border-cyan-800 rounded px-2 py-1 text-[8px] text-cyan-200">
                                    <Globe size={8} /> <span className="max-w-[100px] truncate">{src.title}</span>
                                </a>
                            ))}
                        </div>
                    )}
                </div>
            );
        }

        try {
            // Safely render other JSON but hide massive base64 strings if they slipped through
            const safePayload = packet.payload ? { ...packet.payload } : {};
            if (safePayload.imageData && safePayload.imageData.length > 500) safePayload.imageData = "[IMAGE DATA HIDDEN]";

            return <pre className="whitespace-pre-wrap font-mono text-[9px] text-gray-400 mt-1 opacity-80 overflow-hidden">{JSON.stringify(safePayload, null, 2)}</pre>;
        } catch (e) {
            return <span className="text-red-500">[Error Rendering Payload]</span>;
        }
    };

    // FILTERING LOGIC
    const matchesLogFilter = (p: CognitivePacket) => {
        if (logFilter === 'ALL') return true;

        if (logFilter === 'DREAMS') {
            return (
                p.source === AgentType.MEMORY_EPISODIC &&
                p.type === PacketType.SYSTEM_ALERT &&
                p.payload?.event === 'DREAM_CONSOLIDATION_COMPLETE'
            );
        }

        if (logFilter === 'CHEM') {
            return p.source === AgentType.NEUROCHEM;
        }

        if (logFilter === 'SPEECH') {
            return (
                p.source === AgentType.CORTEX_FLOW &&
                p.type === PacketType.THOUGHT_CANDIDATE &&
                (typeof p.payload?.speech_content === 'string' || p.payload?.event === 'AGENT_SPOKE' || p.payload?.event === 'AUTONOMOUS_SPOKE')
            );
        }

        if (logFilter === 'ERRORS') {
            return (
                p.type === PacketType.PREDICTION_ERROR ||
                (p.type === PacketType.SYSTEM_ALERT && (p.payload?.code || p.payload?.error))
            );
        }

        if (logFilter === 'FLOW') {
            const isChem = p.source === AgentType.NEUROCHEM;
            const isSpeech = (
                p.source === AgentType.CORTEX_FLOW &&
                p.type === PacketType.THOUGHT_CANDIDATE &&
                (typeof p.payload?.speech_content === 'string' || p.payload?.event === 'AGENT_SPOKE' || p.payload?.event === 'AUTONOMOUS_SPOKE')
            );
            return isChem || isSpeech;
        }

        if (logFilter === 'CONFESS') {
            return p.type === PacketType.CONFESSION_REPORT;
        }

        return true;
    };

    const filteredPackets = packets.filter(p => {
        if (p.type === PacketType.FIELD_UPDATE && p.source === AgentType.GLOBAL_FIELD) return false;

        // Baseline inclusion by tab
        if (activeTab === 'SYSTEM') {
            const include = (
                p.type === PacketType.PREDICTION_ERROR ||
                p.source === AgentType.SOMA ||
                p.type === PacketType.SYSTEM_ALERT ||
                p.source === AgentType.NEUROCHEM
            );
            if (!include) return false;
            return matchesLogFilter(p);
        }

        if (activeTab === 'MIND') {
            const include = (
                p.type === PacketType.THOUGHT_CANDIDATE ||
                p.type === PacketType.VISUAL_THOUGHT ||
                p.type === PacketType.VISUAL_PERCEPTION ||
                p.source === AgentType.LIMBIC ||
                p.source === AgentType.MEMORY_EPISODIC ||
                p.source === AgentType.VISUAL_CORTEX ||
                p.source === AgentType.SENSORY_VISUAL ||
                p.source === AgentType.NEUROCHEM
            );
            if (!include) return false;
            return matchesLogFilter(p);
        }

        // Other tabs: keep packets available (so filters don't look broken), but still allow ERROR/SPEECH/CHEM narrowing
        return matchesLogFilter(p);
    });

    return (
        <div className="flex flex-col h-full bg-[#0f1219] border-l border-gray-800 overflow-hidden text-xs font-mono shadow-[0_0_50px_rgba(0,0,0,0.5)] relative">

            <div className="p-3 border-b border-gray-800 bg-[#0a0c10] flex justify-between items-center z-10">
                <div className="flex items-center gap-2">
                    <Activity className="text-brain-accent" size={16} />
                    <div>
                        <h2 className="text-gray-100 font-extrabold tracking-[0.2em] text-[13px]">NEURO-MONITOR</h2>
                        <div className="flex items-center gap-1 text-[10px] text-gray-500 font-bold">
                            <span className="text-cyan-400">ACTIVE RESONANCE</span>
                            <span>::</span>
                            <span>PROTOTYPE 13/10</span>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {typeof chemistryEnabled === 'boolean' && onToggleChemistry && (
                        <button
                            onClick={onToggleChemistry}
                            className={`px-2 py-1 rounded-full text-[9px] font-mono border transition-all ${chemistryEnabled
                                ? 'border-purple-500 text-purple-300 bg-purple-900/30'
                                : 'border-gray-700 text-gray-500 bg-gray-900/40 hover:border-purple-500 hover:text-purple-300'}
                            `}
                            title="Toggle Chemical Soul influence"
                        >
                            CHEM: {chemistryEnabled ? 'ON' : 'OFF'}
                        </button>
                    )}
                    <button onClick={handleExportLogs} className="text-gray-500 hover:text-brain-accent" title="Export Logs"><Download size={14} /></button>
                </div>
            </div>

            <div className="bg-[#0a0c12] border-b border-gray-800 p-4">
                <VitalsPanel limbicState={limbicState} somaState={somaState} neuroState={neuroState} />

                {neuroState && (
                    <div className="mt-4 pt-3 border-t border-gray-800">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-[9px] text-gray-500 uppercase tracking-wider flex items-center gap-1">
                                <Radio size={10} className="text-purple-400" /> CHEMICAL SOUL
                            </span>
                            <span className="text-[9px] font-mono text-purple-300">
                                FLOW: {neuroState.dopamine > 70 ? 'ON' : 'IDLE'}
                            </span>
                        </div>
                        <div className="space-y-1.5">
                            <div>
                                <div className="flex justify-between text-[9px] text-gray-500 mb-0.5">
                                    <span>DOPAMINE</span>
                                    <span className="text-purple-300 font-mono">{neuroState.dopamine.toFixed(0)}%</span>
                                </div>
                                <div className="h-1.5 w-full bg-gray-800 rounded-full overflow-hidden">
                                    <div className="h-full bg-gradient-to-r from-purple-600 to-purple-400" style={{ width: `${neuroState.dopamine}%` }} />
                                </div>
                            </div>
                            <div>
                                <div className="flex justify-between text-[9px] text-gray-500 mb-0.5">
                                    <span>SEROTONIN</span>
                                    <span className="text-sky-300 font-mono">{neuroState.serotonin.toFixed(0)}%</span>
                                </div>
                                <div className="h-1.5 w-full bg-gray-800 rounded-full overflow-hidden">
                                    <div className="h-full bg-gradient-to-r from-sky-600 to-sky-400" style={{ width: `${neuroState.serotonin}%` }} />
                                </div>
                            </div>
                            <div>
                                <div className="flex justify-between text-[9px] text-gray-500 mb-0.5">
                                    <span>NOREPI</span>
                                    <span className="text-amber-300 font-mono">{neuroState.norepinephrine.toFixed(0)}%</span>
                                </div>
                                <div className="h-1.5 w-full bg-gray-800 rounded-full overflow-hidden">
                                    <div className="h-full bg-gradient-to-r from-amber-600 to-amber-400" style={{ width: `${neuroState.norepinephrine}%` }} />
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                            {['ALL', 'DREAMS', 'CHEM', 'SPEECH', 'ERRORS', 'FLOW', 'CONFESS'].map(mode => (
                                <button
                                    key={mode}
                                    onClick={() => setLogFilter(mode as any)}
                                    className={`px-2 py-1 rounded-full border text-[8px] font-mono tracking-wider transition-all ${logFilter === mode
                                        ? 'border-brain-accent text-brain-accent bg-gray-900'
                                        : 'border-gray-800 text-gray-500 hover:text-gray-300 hover:bg-gray-900/60'
                                        }`}
                                >
                                    {mode}
                                </button>
                            ))}
                        </div>
                        {goalState && (
                            <div className="mt-3 pt-2 border-t border-gray-900 text-[9px] text-gray-400 flex justify-between items-center">
                                <div className="flex flex-col gap-0.5">
                                    <span className="uppercase tracking-wider text-gray-500">ACTIVE GOAL</span>
                                    <span className="font-mono text-[9px] text-gray-300">
                                        {goalState.activeGoal
                                            ? `[${goalState.activeGoal.source.toUpperCase()}] ${goalState.activeGoal.description}`
                                            : '— none —'}
                                    </span>
                                </div>
                                <div className="flex flex-col items-end gap-0.5">
                                    <span className="uppercase tracking-wider text-gray-500">LAST USER INPUT</span>
                                    <span className="font-mono text-[9px] text-gray-300">
                                        {(() => {
                                            const last = goalState.lastUserInteractionAt;
                                            if (!last) return 'n/a';
                                            const diffSec = Math.floor((Date.now() - last) / 1000);
                                            return `${diffSec}s ago`;
                                        })()}
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div className="flex bg-[#0f1219] border-b border-gray-800">
                {[
                    { id: 'SYSTEM', icon: Cpu, label: 'KERNEL' },
                    { id: 'MIND', icon: BrainCircuit, label: 'CORTEX' },
                    { id: 'SLEEP', icon: BedDouble, label: 'DREAMS' },
                    { id: 'NETWORK', icon: Share2, label: 'GRAPH' },
                    { id: 'SQL', icon: Database, label: 'DB' },
                    { id: 'DEBUG', icon: Zap, label: 'DEBUG' },
                ].map(tab => (
                    <button key={tab.id} onClick={() => setActiveTab(tab.id as Tab)} className={`flex-1 py-4 text-center text-[11px] font-black tracking-widest flex items-center justify-center gap-2 transition-all border-r border-gray-800 last:border-r-0 ${activeTab === tab.id ? 'text-white bg-gray-800/50 border-b-2 border-brain-accent shadow-[inset_0_-10px_20px_rgba(56,189,248,0.05)]' : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/30'}`}>
                        <tab.icon size={14} /> {tab.label}
                    </button>
                ))}
            </div>

            <div className="flex-1 overflow-y-auto bg-[#050608] scrollbar-thin scrollbar-thumb-gray-800 relative" ref={scrollRef}>
                {activeTab === 'DEBUG' && injectStateOverride && (
                    <div className="p-6 space-y-6">
                        <div className="text-xs text-gray-400 uppercase tracking-widest border-b border-gray-700 pb-2 mb-4 font-bold">Limbic System Control</div>
                        <div className="grid grid-cols-2 gap-3">
                            <button onClick={() => injectStateOverride('limbic', 'fear', limbicState.fear - 0.1)} className="bg-red-900/20 hover:bg-red-900/40 border border-red-900/50 text-red-300 p-3 rounded-lg text-[11px] font-semibold transition-all hover:scale-105">
                                ↓ REDUCE FEAR
                            </button>
                            <button onClick={() => injectStateOverride('limbic', 'fear', limbicState.fear + 0.1)} className="bg-red-900/20 hover:bg-red-900/40 border border-red-900/50 text-red-300 p-3 rounded-lg text-[11px] font-semibold transition-all hover:scale-105">
                                ↑ INCREASE FEAR
                            </button>
                            <button onClick={() => injectStateOverride('limbic', 'curiosity', limbicState.curiosity - 0.1)} className="bg-blue-900/20 hover:bg-blue-900/40 border border-blue-900/50 text-blue-300 p-3 rounded-lg text-[11px] font-semibold transition-all hover:scale-105">
                                ↓ REDUCE CURIOSITY
                            </button>
                            <button onClick={() => injectStateOverride('limbic', 'curiosity', limbicState.curiosity + 0.1)} className="bg-blue-900/20 hover:bg-blue-900/40 border border-blue-900/50 text-blue-300 p-3 rounded-lg text-[11px] font-semibold transition-all hover:scale-105">
                                ↑ INCREASE CURIOSITY
                            </button>
                            <button onClick={() => injectStateOverride('limbic', 'satisfaction', limbicState.satisfaction - 0.1)} className="bg-green-900/20 hover:bg-green-900/40 border border-green-900/50 text-green-300 p-3 rounded-lg text-[11px] font-semibold transition-all hover:scale-105">
                                ↓ REDUCE SATISFACTION
                            </button>
                            <button onClick={() => injectStateOverride('limbic', 'satisfaction', limbicState.satisfaction + 0.1)} className="bg-green-900/20 hover:bg-green-900/40 border border-green-900/50 text-green-300 p-3 rounded-lg text-[11px] font-semibold transition-all hover:scale-105">
                                ↑ INCREASE SATISFACTION
                            </button>
                        </div>

                        <div className="text-xs text-gray-400 uppercase tracking-widest border-b border-gray-700 pb-2 mb-4 mt-6 font-bold">Somatic Energy Control</div>
                        <div className="grid grid-cols-2 gap-3">
                            <button onClick={() => injectStateOverride('soma', 'energy', somaState.energy - 10)} className="bg-orange-900/20 hover:bg-orange-900/40 border border-orange-900/50 text-orange-300 p-3 rounded-lg text-[11px] font-semibold transition-all hover:scale-105">
                                ↓ DRAIN ENERGY (-10%)
                            </button>
                            <button onClick={() => injectStateOverride('soma', 'energy', somaState.energy + 10)} className="bg-orange-900/20 hover:bg-orange-900/40 border border-orange-900/50 text-orange-300 p-3 rounded-lg text-[11px] font-semibold transition-all hover:scale-105">
                                ↑ BOOST ENERGY (+10%)
                            </button>
                        </div>
                    </div>
                )}

                {activeTab === 'SQL' && (
                    <div className="p-6">
                        <div className="flex justify-between items-center mb-4">
                            <div className="text-gray-400 text-xs font-bold uppercase tracking-wider">V3.1 MEMORY SCHEMA</div>
                            <button onClick={handleCopy} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[11px] font-bold transition-all ${copied ? 'bg-green-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}>
                                {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'COPIED' : 'COPY SQL'}
                            </button>
                        </div>
                        <div className="bg-[#0f1219] p-4 rounded-lg border border-gray-700 overflow-x-auto">
                            <pre className="text-gray-400 font-mono text-[10px] leading-relaxed select-all whitespace-pre">{SQL_SETUP_CODE}</pre>
                        </div>
                    </div>
                )}

                {activeTab === 'SLEEP' && (
                    <div className="p-4 space-y-4">
                        {/* Sleep Status Header */}
                        <div className="bg-[#0a0c10] border border-purple-900/30 rounded-lg p-4">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <BedDouble size={16} className="text-purple-400" />
                                    <h3 className="text-purple-300 font-bold text-[11px] uppercase tracking-wider">Sleep & Dream Dashboard</h3>
                                </div>
                                <div className="flex items-center gap-2">
                                    {somaState.isSleeping ? (
                                        <>
                                            <Moon size={12} className="text-purple-400 animate-pulse" />
                                            <span className="text-[9px] font-mono text-purple-300">SLEEPING</span>
                                        </>
                                    ) : (
                                        <span className="text-[9px] font-mono text-gray-500">AWAKE</span>
                                    )}
                                </div>
                            </div>

                            {/* Sleep Events Timeline */}
                            <div className="space-y-2">
                                <div className="text-[9px] text-gray-500 uppercase tracking-wider">Recent Sleep Events (5m)</div>
                                {sleepEvents.length > 0 ? (
                                    <div className="space-y-1 max-h-[80px] overflow-y-auto">
                                        {sleepEvents.map((event, idx) => (
                                            <div key={event.timestamp + '-' + idx} className="flex items-center justify-between text-[8px] font-mono">
                                                <span className={`flex items-center gap-1 ${event.type === 'SLEEP_START' ? 'text-purple-300' : 'text-orange-300'}`}>
                                                    {event.type === 'SLEEP_START' ? <Moon size={8} /> : <Activity size={8} />}
                                                    {event.type.replace('_', ' ')}
                                                </span>
                                                <span className="text-gray-500">
                                                    {new Date(event.timestamp).toLocaleTimeString()} • {event.energy.toFixed(0)}% energy
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-[8px] text-gray-600 italic">No sleep events in last 5 minutes</div>
                                )}
                            </div>
                        </div>

                        {/* Dream Lessons */}
                        <div className="bg-[#0a0c10] border border-cyan-900/30 rounded-lg p-4">
                            <div className="text-[9px] text-cyan-500 uppercase tracking-wider mb-2">Lessons from Dreams</div>
                            {dreamLessons.length > 0 ? (
                                <div className="space-y-2 max-h-[120px] overflow-y-auto">
                                    {dreamLessons.map((lessonSet, idx) => (
                                        <div key={lessonSet.timestamp + '-' + idx} className="border-l border-cyan-800/30 pl-2">
                                            <div className="text-[8px] text-gray-500 mb-1">
                                                {new Date(lessonSet.timestamp).toLocaleTimeString()}
                                            </div>
                                            <ul className="space-y-1">
                                                {lessonSet.lessons.map((lesson, lessonIdx) => (
                                                    <li key={lessonIdx} className="text-[8px] text-cyan-200 flex items-start gap-1">
                                                        <span className="text-cyan-500">•</span>
                                                        <span>{lesson}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-[8px] text-gray-600 italic">No dream lessons available</div>
                            )}
                        </div>

                        {/* Trait Evolution Proposals */}
                        <div className="bg-[#0a0c10] border border-pink-900/30 rounded-lg p-4">
                            <div className="text-[9px] text-pink-500 uppercase tracking-wider mb-2">Trait Evolution Proposals</div>
                            {traitProposals.length > 0 ? (
                                <div className="space-y-3 max-h-[200px] overflow-y-auto">
                                    {traitProposals.map((proposal, idx) => (
                                        <div key={proposal.timestamp + '-' + idx} className="border-l border-pink-800/30 pl-2 space-y-2">
                                            <div className="text-[8px] text-gray-500">
                                                {new Date(proposal.timestamp).toLocaleTimeString()}
                                            </div>

                                            {/* Trait Changes */}
                                            {proposal.proposal && Object.keys(proposal.proposal).length > 0 && (
                                                <div className="space-y-1">
                                                    {Object.entries(proposal.proposal).map(([trait, delta]: [string, any]) => (
                                                        <div key={trait} className="text-[8px] font-mono flex items-center justify-between">
                                                            <span className="text-pink-300">{trait}</span>
                                                            <span className="text-pink-400">
                                                                {typeof delta === 'number' ? (delta > 0 ? '+' : '') + delta.toFixed(3) : JSON.stringify(delta)}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            {/* Reasoning */}
                                            {proposal.reasoning && (
                                                <div className="text-[8px] text-gray-400 italic border-t border-pink-900/20 pt-1">
                                                    {proposal.reasoning.slice(0, 200)}{proposal.reasoning.length > 200 ? '...' : ''}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-[8px] text-gray-600 italic">No trait evolution proposals available</div>
                            )}

                            <div className="text-[7px] text-gray-600 mt-2 border-t border-gray-800 pt-2">
                                Note: Trait proposals are logged only - no automatic changes applied
                            </div>
                        </div>

                        {/* Dream Consolidation Counter */}
                        <div className="bg-[#0a0c10] border border-gray-800 rounded-lg p-3">
                            <div className="flex items-center justify-between">
                                <span className="text-[9px] text-gray-500 uppercase tracking-wider">Dream Consolidations (5m)</span>
                                <span className="text-[9px] font-mono text-cyan-300">{dreamConsolidations5m}</span>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'NETWORK' && (
                    <div className="h-full flex flex-col items-center justify-center relative bg-[#050608]">
                        <div className="w-full h-full p-8 flex items-center justify-center">
                            <svg viewBox="-5 -5 110 110" className="w-full h-full max-w-[500px] max-h-[500px]">
                                <defs>
                                    <filter id="glow" x="-100%" y="-100%" width="300%" height="300%">
                                        <feGaussianBlur stdDeviation="2.5" result="coloredBlur" />
                                        <feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge>
                                    </filter>
                                </defs>

                                {/* CEMI FIELD VISUALIZATION */}
                                {resonanceField && (
                                    <g>
                                        <circle cx="50" cy="50" r={40 + (resonanceField.intensity * 15)} fill="none" stroke="#22d3ee" strokeWidth="0.5" opacity="0.3">
                                            <animate attributeName="r" from={40} to={55} dur={`${4 * resonanceField.timeDilation}s`} repeatCount="indefinite" />
                                            <animate attributeName="opacity" values="0.1;0.3;0.1" dur={`${4 * resonanceField.timeDilation}s`} repeatCount="indefinite" />
                                        </circle>
                                    </g>
                                )}

                                {/* CONNECTIONS */}
                                {Object.entries(AGENT_LAYOUT).map(([key, pos]) => {
                                    if (key === AgentType.CORTEX_FLOW) return null;
                                    const center = AGENT_LAYOUT[AgentType.CORTEX_FLOW];
                                    const activityLevel = agentActivity[key] || 0;
                                    // Dynamic width based on activity
                                    const isActive = activityLevel > 0.1;
                                    const strokeW = isActive ? 0.4 + (activityLevel * 1.6) : 0.4;

                                    return (
                                        <line key={`conn-${key}`} x1={center.x} y1={center.y} x2={pos.x} y2={pos.y} stroke={isActive ? pos.color : '#334155'} strokeWidth={strokeW} strokeDasharray={isActive ? "none" : "3 3"} opacity={isActive ? Math.max(0.4, activityLevel) : 0.25} className="transition-all duration-700" />
                                    );
                                })}
                                {/* NODES */}
                                {Object.entries(AGENT_LAYOUT).map(([key, pos]) => {
                                    const rawActivity = agentActivity[key] || 0;
                                    const activityLevel = Math.min(1, rawActivity); // Clamp for opacity
                                    const intensity = Math.min(2, rawActivity); // Allow over-driving radius
                                    const isActive = rawActivity > 0.1;

                                    return (
                                        <g key={key} className="transition-all duration-500">
                                            <circle cx={pos.x} cy={pos.y} r={key === AgentType.CORTEX_FLOW ? 10 : 6} fill="#050608" stroke={isActive ? pos.color : '#475569'} strokeWidth={isActive ? 1.2 + (activityLevel * 0.8) : 0.8} />
                                            {isActive && (
                                                <circle
                                                    cx={pos.x} cy={pos.y}
                                                    r={(key === AgentType.CORTEX_FLOW ? 10 : 6) + (intensity * 5)}
                                                    fill={pos.color}
                                                    opacity={activityLevel * 0.5} // Brighter glow
                                                    filter="url(#glow)"
                                                />
                                            )}
                                            <text x={pos.x} y={pos.y + 1.8} textAnchor="middle" fill={isActive ? '#fff' : '#64748b'} fontSize="3.5" fontWeight="900" style={{ pointerEvents: 'none', textShadow: '0 1px 3px rgba(0,0,0,0.9)' }}>{pos.label}</text>
                                        </g>
                                    );
                                })}
                            </svg>
                        </div>
                    </div>
                )}

                {activeTab === 'MIND' && (
                    <div className="px-3 pt-3 pb-2 border-b border-gray-800 bg-[#050608] flex flex-col gap-1 text-[9px] text-gray-400">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="uppercase tracking-wider text-gray-500">FLOW BURSTS (5m)</span>
                                <span className="font-mono text-purple-300">{flowBursts5m}</span>
                            </div>
                            {recentNeuroSamples.length > 0 && (
                                <div className="flex items-center gap-2">
                                    <span className="uppercase tracking-wider text-gray-500">DOP / SER TREND</span>
                                    <span className="font-mono text-[8px] text-purple-300">
                                        {recentNeuroSamples.map((s, i) => (i % 2 === 0 ? Math.round(s.dopamine) : '.')).join(' ')}
                                    </span>
                                    <span className="font-mono text-[8px] text-sky-300 ml-1">
                                        {recentNeuroSamples.map((s, i) => (i % 2 === 0 ? Math.round(s.serotonin) : '.')).join(' ')}
                                    </span>
                                </div>
                            )}
                        </div>

                        <div className="flex items-start justify-between mt-1">
                            <div className="flex items-center gap-2">
                                <span className="uppercase tracking-wider text-gray-500">DREAMS (5m)</span>
                                <span className="font-mono text-cyan-300">{dreamConsolidations5m}</span>
                            </div>
                            {recentDreamSummaries.length > 0 && (
                                <div className="flex-1 ml-3 overflow-hidden">
                                    <div className="text-[8px] text-gray-500 uppercase tracking-wider mb-0.5">LAST DREAM CONSOLIDATIONS</div>
                                    <div className="space-y-0.5 max-h-[46px] overflow-y-auto pr-1">
                                        {recentDreamSummaries.map((d, idx) => (
                                            <div key={d.timestamp + '-' + idx} className="text-[8px] text-gray-300 truncate">
                                                <span className="text-gray-500 mr-1 font-mono">{new Date(d.timestamp).toLocaleTimeString()}:</span>
                                                <span className="opacity-80">{d.summary.replace(/^DREAM CONSOLIDATION:\s*/i, '')}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {activeTab !== 'SQL' && activeTab !== 'NETWORK' && activeTab !== 'DEBUG' && (
                    <div className="p-3 space-y-2">
                        {filteredPackets.map((packet) => {
                            let style = { border: 'border-gray-800', bg: 'bg-[#0a0c10]', text: 'text-gray-400', icon: Activity };
                            if (packet.type === PacketType.VISUAL_THOUGHT) style = { border: 'border-pink-500/50', bg: 'bg-pink-900/10', text: 'text-pink-400', icon: ImageIcon };
                            else if (packet.type === PacketType.VISUAL_PERCEPTION) style = { border: 'border-purple-500/50', bg: 'bg-purple-900/10', text: 'text-purple-300', icon: Eye };
                            else if (packet.type === PacketType.THOUGHT_CANDIDATE) style = { border: 'border-purple-900/50', bg: 'bg-purple-900/10', text: 'text-purple-300', icon: BrainCircuit };
                            else if (packet.type === PacketType.PREDICTION_ERROR) style = { border: 'border-red-900/50', bg: 'bg-red-900/10', text: 'text-red-400', icon: ShieldAlert };
                            else if (packet.type === PacketType.SYSTEM_ALERT) style = { border: 'border-orange-500/50', bg: 'bg-orange-900/10', text: 'text-orange-400', icon: ShieldAlert };

                            return (
                                <div key={packet.id} className={`border-l-4 p-4 rounded-r-xl ${style.border} ${style.bg} transition-all hover:bg-gray-800/80 shadow-lg group`}>
                                    <div className="flex justify-between items-center mb-2">
                                        <span className={`text-[11px] font-black flex items-center gap-2 tracking-widest ${style.text} uppercase`}><style.icon size={12} className="group-hover:animate-pulse" />{packet.type.replace(/_/g, ' ')}</span>
                                        <span className="text-[9px] text-gray-500 font-mono font-bold">{new Date(packet.timestamp).toLocaleTimeString()}</span>
                                    </div>
                                    <div className="pl-4 border-l border-gray-800/50 ml-1.5 py-1">{renderPayload(packet)}</div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};
