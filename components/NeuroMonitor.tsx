
import React, { useEffect, useState, useRef } from 'react';
import { eventBus } from '../core/EventBus';
import { CognitivePacket, LimbicState, PacketType, AgentType, SomaState, ResonanceField, NeurotransmitterState, GoalState } from '../types';
import { Activity, Zap, Database, Copy, Check, Cpu, Download, Share2, BrainCircuit, Moon, BedDouble } from 'lucide-react';
import { BioMonitor } from './neuro/BioMonitor';
import { NetworkGraph } from './neuro/NetworkGraph';
import { AuditStream } from './neuro/AuditStream';

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

            <BioMonitor
                limbicState={limbicState}
                somaState={somaState}
                neuroState={neuroState}
                logFilter={logFilter}
                onLogFilterChange={setLogFilter}
                goalState={goalState}
            />

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
                    <NetworkGraph resonanceField={resonanceField} agentActivity={agentActivity} />
                )}

                {activeTab !== 'SQL' && activeTab !== 'NETWORK' && activeTab !== 'DEBUG' && (
                    <AuditStream
                        activeTab={activeTab}
                        filteredPackets={filteredPackets}
                        flowBursts5m={flowBursts5m}
                        recentNeuroSamples={recentNeuroSamples}
                        dreamConsolidations5m={dreamConsolidations5m}
                        recentDreamSummaries={recentDreamSummaries}
                    />
                )}
            </div>
        </div>
    );
};
