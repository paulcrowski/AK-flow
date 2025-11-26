
import React, { useEffect, useState, useRef } from 'react';
import { eventBus } from '../core/EventBus';
import { CognitivePacket, LimbicState, PacketType, AgentType, SomaState, ResonanceField } from '../types';
import { Activity, Zap, Database, Copy, Check, Cpu, Download, Share2, BrainCircuit, ShieldAlert, Radio, Moon, Image as ImageIcon, ExternalLink, Globe, Waves, Eye } from 'lucide-react';

interface NeuroMonitorProps {
  limbicState: LimbicState;
  somaState: SomaState;
  resonanceField?: ResonanceField;
}

const AGENT_LAYOUT: Record<string, { x: number, y: number, label: string, color: string }> = {
    [AgentType.CORTEX_FLOW]: { x: 50, y: 50, label: 'CORTEX', color: '#38bdf8' }, 
    [AgentType.CORTEX_CONFLICT]: { x: 70, y: 35, label: 'CONFLICT', color: '#eab308' }, 
    [AgentType.MEMORY_EPISODIC]: { x: 50, y: 20, label: 'MEMORY', color: '#c084fc' },
    [AgentType.SENSORY_TEXT]: { x: 20, y: 50, label: 'INPUT', color: '#22c55e' }, 
    [AgentType.LIMBIC]: { x: 80, y: 50, label: 'LIMBIC', color: '#ef4444' }, 
    [AgentType.SOMA]: { x: 80, y: 75, label: 'SOMA', color: '#f97316' }, 
    [AgentType.MOTOR]: { x: 50, y: 80, label: 'OUTPUT', color: '#94a3b8' }, 
    [AgentType.MORAL]: { x: 30, y: 35, label: 'MORAL', color: '#14b8a6' },
    [AgentType.VISUAL_CORTEX]: { x: 30, y: 65, label: 'VISION', color: '#f472b6' }, 
};

const CircularGauge = ({ value, color, label, icon: Icon }: { value: number, color: string, label: string, icon: any }) => {
    const radius = 16;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (value * circumference);
    return (
        <div className="flex flex-col items-center justify-center relative group">
            <div className="relative w-12 h-12 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90">
                    <circle cx="24" cy="24" r={radius} stroke="#1e293b" strokeWidth="4" fill="transparent" />
                    <circle 
                        cx="24" cy="24" r={radius} 
                        stroke={color} 
                        strokeWidth="4" 
                        fill="transparent" 
                        strokeDasharray={circumference} 
                        strokeDashoffset={offset}
                        strokeLinecap="round"
                        className="transition-all duration-1000 ease-out"
                    />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-gray-200">
                    {Math.round(value * 100)}%
                </div>
            </div>
            <span className="text-[9px] uppercase tracking-wider text-gray-500 mt-1 flex items-center gap-1">
                <Icon size={8} /> {label}
            </span>
        </div>
    );
};
const CyberHeart = ({ bpm, intensity }: { bpm: number, intensity: number }) => {
    const duration = 60 / bpm;
    const color = intensity < 0.3 ? '#38bdf8' : intensity < 0.7 ? '#eab308' : '#ef4444';
    return (
        <div className="relative flex items-center justify-center w-24 h-24 group cursor-help">
            <div className="absolute inset-0 border-2 border-dashed border-gray-700 rounded-full opacity-30 animate-[spin_10s_linear_infinite]" />
            <svg viewBox="0 0 24 24" className="w-10 h-10 drop-shadow-[0_0_10px_rgba(255,255,255,0.3)] transition-colors duration-500" style={{ fill: color, animation: `pulse-heart ${duration}s ease-in-out infinite` }}>
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
            </svg>
            <div className="absolute -bottom-4 text-[10px] font-mono text-gray-500 bg-gray-900 px-2 py-0.5 rounded border border-gray-800">{Math.round(bpm)} BPM</div>
            <style>{`@keyframes pulse-heart { 0% { transform: scale(1); opacity: 0.8; } 15% { transform: scale(1.3); opacity: 1; } 100% { transform: scale(1); opacity: 0.8; } }`}</style>
        </div>
    );
};

const SQL_SETUP_CODE = `-- AK-FLOW V3.1 SQL
-- Adds Visual Memory support (11/10 Upgrade)

-- 1. Ensure extension for Vectors
create extension if not exists vector;

-- 2. Create/Update Memories Table
create table if not exists memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid default auth.uid(),
  raw_text text,
  embedding vector(768),
  created_at timestamptz default now(),
  neural_strength int default 1,
  is_core_memory boolean default false,
  last_accessed_at timestamptz default now(),
  -- NEW V3.1 COLUMNS:
  image_data text,       -- Stores Compressed Base64
  is_visual_dream boolean default false
);

-- 3. Match Function (Biological Search)
create or replace function match_memories (
  query_embedding vector(768),
  match_threshold float,
  match_count int
)
returns table (
  id uuid,
  raw_text text,
  neural_strength int,
  is_core_memory boolean,
  similarity float,
  image_data text,       -- Return images
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

-- 4. Reinforce Function (Hebbian)
create or replace function reinforce_memory(row_id uuid, amount int)
returns void language plpgsql as $$
begin
  update memories
  set neural_strength = neural_strength + amount,
      last_accessed_at = now()
  where id = row_id;
end;
$$;`;

type Tab = 'SYSTEM' | 'MIND' | 'SQL' | 'NETWORK';

export const NeuroMonitor: React.FC<NeuroMonitorProps> = ({ limbicState, somaState, resonanceField }) => {
  const [packets, setPackets] = useState<CognitivePacket[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>('SYSTEM');
  const [copied, setCopied] = useState(false);
  const [agentActivity, setAgentActivity] = useState<Record<string, number>>({});
  const scrollRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef({ limbicState, somaState });

  useEffect(() => {
      stateRef.current = { limbicState, somaState };
  }, [limbicState, somaState]);

  useEffect(() => {
      if (activeTab !== 'SQL' && activeTab !== 'NETWORK' && scrollRef.current) {
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
                    next[k] = Math.max(0, next[k] - 0.05); // Decay speed
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
      history.filter(p => now - p.timestamp < 150).forEach(p => {
          setAgentActivity(prev => ({ ...prev, [p.source]: 1.0 }));
      });

    }, 150);

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
        const safePayload = packet.payload ? {...packet.payload} : {};
        if (safePayload.imageData && safePayload.imageData.length > 500) safePayload.imageData = "[IMAGE DATA HIDDEN]";
        
        return <pre className="whitespace-pre-wrap font-mono text-[9px] text-gray-400 mt-1 opacity-80 overflow-hidden">{JSON.stringify(safePayload, null, 2)}</pre>;
      } catch (e) {
        return <span className="text-red-500">[Error Rendering Payload]</span>;
      }
  };

  // FILTERING LOGIC
  const filteredPackets = packets.filter(p => {
      if (activeTab === 'SQL' || activeTab === 'NETWORK') return false;
      
      if (p.type === PacketType.FIELD_UPDATE && p.source === AgentType.GLOBAL_FIELD) return false;

      if (activeTab === 'SYSTEM') {
          return (p.type === PacketType.PREDICTION_ERROR || p.source === AgentType.SOMA || p.type === PacketType.SYSTEM_ALERT);
      }
      if (activeTab === 'MIND') return (p.type === PacketType.THOUGHT_CANDIDATE || p.type === PacketType.VISUAL_THOUGHT || p.type === PacketType.VISUAL_PERCEPTION || p.source === AgentType.LIMBIC || p.source === AgentType.MEMORY_EPISODIC || p.source === AgentType.VISUAL_CORTEX || p.source === AgentType.SENSORY_VISUAL);
      return true;
  });

  const bpm = 60 + (limbicState.fear * 80) + (somaState?.cognitiveLoad || 0 * 0.5);

  return (
    <div className="flex flex-col h-full bg-[#0f1219] border-l border-gray-800 overflow-hidden text-xs font-mono shadow-[0_0_50px_rgba(0,0,0,0.5)] relative">
      
      <div className="p-3 border-b border-gray-800 bg-[#0a0c10] flex justify-between items-center z-10">
          <div className="flex items-center gap-2">
            <Activity className="text-brain-accent" size={16} />
            <div>
                <h2 className="text-gray-100 font-bold tracking-widest text-[11px]">NEURO-MONITOR</h2>
                <div className="flex items-center gap-1 text-[9px] text-gray-500">
                    <span className="text-green-400">ONLINE</span>
                    <span>::</span>
                    <span>v3.8 (Visual)</span>
                </div>
            </div>
          </div>
          <button onClick={handleExportLogs} className="text-gray-500 hover:text-brain-accent" title="Export Logs"><Download size={14} /></button>
      </div>

      <div className="grid grid-cols-5 gap-0 border-b border-gray-800 bg-[#0f1219] h-32 relative z-10">
        <div className="col-span-2 flex flex-row items-center justify-around p-2 border-r border-gray-800/50">
            <CircularGauge value={limbicState.fear} color={limbicState.fear > 0.5 ? '#ef4444' : '#94a3b8'} label="FEAR" icon={ShieldAlert} />
            <CircularGauge value={limbicState.curiosity} color="#38bdf8" label="CURIOSITY" icon={Radio} />
        </div>
        <div className="col-span-1 flex flex-col items-center justify-center border-r border-gray-800/50">
            <CyberHeart bpm={bpm} intensity={limbicState.fear} />
            {resonanceField && (
                <div className="mt-2 text-[8px] text-gray-500 flex flex-col items-center">
                    <span className="text-cyan-400">{resonanceField.timeDilation.toFixed(1)}x</span>
                    <span>DILATION</span>
                </div>
            )}
        </div>
        {/* ADDED SAFETY CHECKS HERE TO PREVENT DISAPPEARING BARS */}
        <div className="col-span-2 flex flex-col justify-center p-4 gap-2">
            <div className="w-full">
                <div className="flex justify-between items-end mb-0.5"><span className="text-[9px] text-gray-500">ENERGY</span><span className="text-[10px] text-gray-300">{(somaState?.energy || 0).toFixed(0)}%</span></div>
                <div className="h-1.5 w-full bg-gray-800 rounded-full"><div className="h-full bg-orange-500 transition-all duration-500" style={{ width: `${somaState?.energy || 0}%` }}/></div>
            </div>
            <div className="w-full">
                <div className="flex justify-between items-end mb-0.5"><span className="text-[9px] text-gray-500">COG LOAD</span><span className="text-[10px] text-gray-300">{(somaState?.cognitiveLoad || 0).toFixed(0)}%</span></div>
                <div className="h-1.5 w-full bg-gray-800 rounded-full"><div className="h-full bg-brain-accent transition-all duration-500" style={{ width: `${somaState?.cognitiveLoad || 0}%` }}/></div>
            </div>
            <div className="w-full">
                <div className="flex justify-between items-end mb-0.5"><span className="text-[9px] text-gray-500">SATISFACTION</span><span className="text-[10px] text-gray-300">{(limbicState.satisfaction * 100).toFixed(0)}%</span></div>
                 <div className="h-1.5 w-full bg-gray-800 rounded-full"><div className="h-full bg-green-500 transition-all duration-500" style={{ width: `${limbicState.satisfaction * 100}%` }}/></div>
            </div>
        </div>
      </div>

      <div className="flex bg-[#0f1219] border-b border-gray-800">
          {[
              { id: 'SYSTEM', icon: Cpu, label: 'KERNEL' },
              { id: 'MIND', icon: BrainCircuit, label: 'CORTEX' },
              { id: 'NETWORK', icon: Share2, label: 'GRAPH' },
              { id: 'SQL', icon: Database, label: 'DB' },
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as Tab)} className={`flex-1 py-2.5 text-center text-[10px] font-bold tracking-wider flex items-center justify-center gap-1.5 ${activeTab === tab.id ? 'text-white bg-gray-800 border-b-2 border-brain-accent' : 'text-gray-600 hover:text-gray-300'}`}>
                <tab.icon size={12} /> {tab.label}
            </button>
          ))}
      </div>

      <div className="flex-1 overflow-y-auto bg-[#050608] scrollbar-thin scrollbar-thumb-gray-800 relative" ref={scrollRef}>
        {activeTab === 'SQL' && (
            <div className="p-4">
                <div className="flex justify-between items-center mb-3">
                    <div className="text-gray-400 text-[10px]">V3.1 MEMORY SCHEMA (OPTIMIZED)</div>
                    <button onClick={handleCopy} className={`flex items-center gap-1 px-3 py-1.5 rounded text-[10px] font-bold ${copied ? 'bg-green-600' : 'bg-gray-800 text-gray-300'}`}>
                        {copied ? <Check size={12}/> : <Copy size={12}/>} {copied ? 'COPIED' : 'COPY SQL'}
                    </button>
                </div>
                <div className="bg-[#0f1219] p-3 rounded border border-gray-800 overflow-x-auto">
                    <pre className="text-gray-400 font-mono text-[10px] leading-relaxed select-all whitespace-pre">{SQL_SETUP_CODE}</pre>
                </div>
            </div>
        )}

        {activeTab === 'NETWORK' && (
            <div className="h-full flex flex-col items-center justify-center relative bg-[#050608]">
                <div className="w-full h-full p-6 flex items-center justify-center">
                    <svg viewBox="0 0 100 100" className="w-full h-full max-w-[320px] max-h-[320px]">
                        <defs>
                            <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                                <feGaussianBlur stdDeviation="1.5" result="coloredBlur"/>
                                <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
                            </filter>
                        </defs>
                        
                        {/* CEMI FIELD VISUALIZATION */}
                        {resonanceField && (
                            <g>
                                <circle cx="50" cy="50" r={35 + (resonanceField.intensity * 10)} fill="none" stroke="#22d3ee" strokeWidth="0.2" opacity="0.3">
                                    <animate attributeName="r" from={35} to={45} dur={`${4 * resonanceField.timeDilation}s`} repeatCount="indefinite" />
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
                            const strokeW = activityLevel > 0.1 ? 0.2 + (activityLevel * 0.8) : 0.2;
                            
                            return (
                                <line key={`conn-${key}`} x1={center.x} y1={center.y} x2={pos.x} y2={pos.y} stroke={activityLevel > 0.1 ? pos.color : '#1e293b'} strokeWidth={strokeW} strokeDasharray={activityLevel > 0.1 ? "none" : "2 2"} opacity={Math.max(0.2, activityLevel)} />
                            );
                        })}
                        {/* NODES */}
                        {Object.entries(AGENT_LAYOUT).map(([key, pos]) => {
                            const activityLevel = agentActivity[key] || 0;
                            return (
                                <g key={key}>
                                    <circle cx={pos.x} cy={pos.y} r={key === AgentType.CORTEX_FLOW ? 8 : 5} fill="#0f1219" stroke={pos.color} strokeWidth={0.5 + (activityLevel * 0.5)} />
                                    {activityLevel > 0.1 && (
                                        <circle cx={pos.x} cy={pos.y} r={(key === AgentType.CORTEX_FLOW ? 8 : 5) + (activityLevel * 2)} fill={pos.color} opacity={activityLevel * 0.4} filter="url(#glow)" />
                                    )}
                                    <text x={pos.x} y={pos.y + 1.5} textAnchor="middle" fill={activityLevel > 0.1 ? '#fff' : '#475569'} fontSize="2.5" fontWeight="bold">{pos.label}</text>
                                </g>
                            );
                        })}
                    </svg>
                </div>
            </div>
        )}

        {activeTab !== 'SQL' && activeTab !== 'NETWORK' && (
            <div className="p-3 space-y-2">
                {filteredPackets.map((packet) => {
                    let style = { border: 'border-gray-800', bg: 'bg-[#0a0c10]', text: 'text-gray-400', icon: Activity };
                    if (packet.type === PacketType.VISUAL_THOUGHT) style = { border: 'border-pink-500/50', bg: 'bg-pink-900/10', text: 'text-pink-400', icon: ImageIcon };
                    else if (packet.type === PacketType.VISUAL_PERCEPTION) style = { border: 'border-purple-500/50', bg: 'bg-purple-900/10', text: 'text-purple-300', icon: Eye };
                    else if (packet.type === PacketType.THOUGHT_CANDIDATE) style = { border: 'border-purple-900/50', bg: 'bg-purple-900/10', text: 'text-purple-300', icon: BrainCircuit };
                    else if (packet.type === PacketType.PREDICTION_ERROR) style = { border: 'border-red-900/50', bg: 'bg-red-900/10', text: 'text-red-400', icon: ShieldAlert };
                    else if (packet.type === PacketType.SYSTEM_ALERT) style = { border: 'border-orange-500/50', bg: 'bg-orange-900/10', text: 'text-orange-400', icon: ShieldAlert };
                    
                    return (
                        <div key={packet.id} className={`border-l-2 p-2 rounded-r ${style.border} ${style.bg} transition-all hover:bg-gray-800/50`}>
                            <div className="flex justify-between items-center mb-1">
                                <span className={`text-[9px] font-bold flex items-center gap-1.5 ${style.text}`}><style.icon size={10} />{packet.type.replace(/_/g, ' ')}</span>
                                <span className="text-[8px] text-gray-600 font-mono">{new Date(packet.timestamp).toLocaleTimeString()}</span>
                            </div>
                            <div className="pl-4 border-l border-gray-800 ml-1">{renderPayload(packet)}</div>
                        </div>
                    );
                })}
            </div>
        )}
      </div>
    </div>
  );
};
