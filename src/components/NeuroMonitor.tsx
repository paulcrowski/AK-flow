
import React, { useEffect, useState, useRef } from 'react';
import { eventBus } from '../core/EventBus';
import { CognitivePacket, LimbicState, PacketType, AgentType, SomaState, ResonanceField, NeurotransmitterState, GoalState } from '../types';
import { Activity } from 'lucide-react';
import { BioMonitor } from './neuro/BioMonitor';
import { NetworkGraph } from './neuro/NetworkGraph';
import { AuditStream } from './neuro/AuditStream';
import { SQL_SETUP_CODE } from './neuro/sqlSetupCode';
import { NeuroMonitorHeader } from './neuro/NeuroMonitorHeader';
import { NeuroMonitorTabs, type Tab } from './neuro/NeuroMonitorTabs';
import { NeuroMonitorSqlPanel } from './neuro/NeuroMonitorSqlPanel';
import { NeuroMonitorDebugPanel } from './neuro/NeuroMonitorDebugPanel';
import { NeuroMonitorSleepPanel } from './neuro/NeuroMonitorSleepPanel';

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

type LocalLogFilter = 'ALL' | 'DREAMS' | 'CHEM' | 'SPEECH' | 'ERRORS' | 'FLOW' | 'CONFESS';

export const NeuroMonitor: React.FC<NeuroMonitorProps> = ({ limbicState, somaState, resonanceField, injectStateOverride, neuroState, chemistryEnabled, onToggleChemistry, goalState }) => {
    const [packets, setPackets] = useState<CognitivePacket[]>([]);
    const [flowBursts5m, setFlowBursts5m] = useState<number>(0);
    const [recentNeuroSamples, setRecentNeuroSamples] = useState<{ dopamine: number; serotonin: number }[]>([]);
    const [dreamConsolidations5m, setDreamConsolidations5m] = useState<number>(0);
    const [recentDreamSummaries, setRecentDreamSummaries] = useState<{ timestamp: number; summary: string }[]>([]);
    const [sleepEvents, setSleepEvents] = useState<{ timestamp: number; type: 'SLEEP_START' | 'SLEEP_END'; energy: number }[]>([]);
    const [traitProposals, setTraitProposals] = useState<{ timestamp: number; proposal: any; reasoning: string }[]>([]);
    const [dreamLessons, setDreamLessons] = useState<{ timestamp: number; lessons: string[] }[]>([]);
    const [logFilter, setLogFilter] = useState<LocalLogFilter>('ALL');
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

            <NeuroMonitorHeader
                chemistryEnabled={chemistryEnabled}
                onToggleChemistry={onToggleChemistry}
                onExportLogs={handleExportLogs}
            />

            <BioMonitor
                limbicState={limbicState}
                somaState={somaState}
                neuroState={neuroState}
                logFilter={logFilter}
                onLogFilterChange={setLogFilter}
                goalState={goalState}
            />

            <NeuroMonitorTabs activeTab={activeTab} setActiveTab={setActiveTab} />

            <div className="flex-1 overflow-y-auto bg-[#050608] scrollbar-thin scrollbar-thumb-gray-800 relative" ref={scrollRef}>
                {activeTab === 'DEBUG' && injectStateOverride && (
                    <NeuroMonitorDebugPanel injectStateOverride={injectStateOverride} limbicState={limbicState} somaState={somaState} />
                )}

                {activeTab === 'SQL' && (
                    <NeuroMonitorSqlPanel sqlCode={SQL_SETUP_CODE} copied={copied} onCopy={handleCopy} />
                )}

                {activeTab === 'SLEEP' && (
                    <NeuroMonitorSleepPanel
                        somaState={somaState}
                        sleepEvents={sleepEvents}
                        dreamLessons={dreamLessons}
                        traitProposals={traitProposals}
                        dreamConsolidations5m={dreamConsolidations5m}
                    />
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
