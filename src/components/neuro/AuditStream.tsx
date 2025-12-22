import React from 'react';
import {
  Activity,
  BrainCircuit,
  Eye,
  Globe,
  Image as ImageIcon,
  ShieldAlert
} from 'lucide-react';
import { AgentType, type CognitivePacket, PacketType } from '../../types';

export function AuditStream(props: {
  activeTab: string;
  filteredPackets: CognitivePacket[];
  flowBursts5m: number;
  recentNeuroSamples: { dopamine: number; serotonin: number }[];
  dreamConsolidations5m: number;
  recentDreamSummaries: { timestamp: number; summary: string }[];
}) {
  const { activeTab, filteredPackets, flowBursts5m, recentNeuroSamples, dreamConsolidations5m, recentDreamSummaries } = props;

  const renderPayload = (packet: CognitivePacket) => {
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

    if (packet.source === AgentType.NEUROCHEM && packet.type === PacketType.SYSTEM_ALERT) {
      const p: any = packet.payload || {};
      if (p.event === 'CHEM_FLOW_ON' || p.event === 'CHEM_FLOW_OFF') {
        return (
          <div className="text-[10px] text-purple-200 space-y-1">
            <div className="flex justify-between">
              <span className="font-mono">{p.event}</span>
              <span className="font-mono">D={p.dopamine?.toFixed(2)}</span>
            </div>
            {p.activity && <div className="text-[9px] text-purple-300">activity: {p.activity}</div>}
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
              <span className="font-mono">
                {p.base_voice_pressure?.toFixed(2)} → {p.biased_voice_pressure?.toFixed(2)}
              </span>
            </div>
          </div>
        );
      }
    }

    if (packet.type === PacketType.VISUAL_PERCEPTION) {
      return (
        <div className="mt-2 border-l-2 border-purple-400 pl-2 bg-purple-900/10 p-2 rounded-r">
          <div className="text-[10px] text-purple-300 font-bold mb-1 flex items-center gap-2">
            <Eye size={12} /> VISUAL PERCEPTION
          </div>
          <div className="text-[9px] text-gray-300 italic mb-1">Target: "{(packet as any).payload.prompt}"</div>
          <div className="text-[9px] text-purple-100 border-t border-purple-500/30 pt-1">{(packet as any).payload.perception_text}</div>
        </div>
      );
    }

    if (packet.type === PacketType.VISUAL_THOUGHT) {
      const p: any = packet.payload || {};
      return (
        <div className="mt-2 border-l-2 border-pink-500 pl-2 bg-pink-900/10 p-2 rounded-r">
          <div className="text-[10px] text-pink-300 font-bold mb-1 flex items-center gap-2">
            <ImageIcon size={12} /> VISUAL CORTEX
          </div>
          {p.prompt && <div className="text-[9px] text-gray-300 italic mb-2">"{p.prompt}"</div>}
          {p.perception_text && (
            <div className="text-[9px] text-pink-200 border-t border-pink-500/30 pt-1 mt-1">
              <span className="font-bold">PERCEPTION:</span> {p.perception_text}
            </div>
          )}
          {p.imageData && (
            <div className="mt-1 w-full max-w-[150px] aspect-square rounded overflow-hidden border border-pink-500/30">
              <img src={p.imageData} className="w-full h-full object-cover" alt="dream_thumb" />
            </div>
          )}
          {p.status && <div className="text-[8px] text-pink-500 mt-1">{p.status}</div>}
        </div>
      );
    }

    if ((packet as any).payload?.action === 'DEEP_RESEARCH_COMPLETE') {
      const p: any = packet.payload || {};
      return (
        <div className="mt-2 space-y-2">
          <div className="text-[10px] text-cyan-300 font-bold border-b border-cyan-800 pb-1 mb-1">RESEARCH: "{p.topic}"</div>
          {p.found_sources && (
            <div className="flex flex-wrap gap-1">
              {p.found_sources.map((src: any, i: number) => (
                <a
                  key={i}
                  href={src.uri}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 bg-cyan-900/30 border border-cyan-800 rounded px-2 py-1 text-[8px] text-cyan-200"
                >
                  <Globe size={8} /> <span className="max-w-[100px] truncate">{src.title}</span>
                </a>
              ))}
            </div>
          )}
        </div>
      );
    }

    try {
      const safePayload: any = packet.payload ? { ...(packet as any).payload } : {};
      if (safePayload.imageData && safePayload.imageData.length > 500) safePayload.imageData = '[IMAGE DATA HIDDEN]';
      return (
        <pre className="whitespace-pre-wrap font-mono text-[9px] text-gray-400 mt-1 opacity-80 overflow-hidden">
          {JSON.stringify(safePayload, null, 2)}
        </pre>
      );
    } catch {
      return <span className="text-red-500">[Error Rendering Payload]</span>;
    }
  };

  return (
    <>
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

      <div className="p-3 space-y-2">
        {filteredPackets.map((packet) => {
          let style = { border: 'border-gray-800', bg: 'bg-[#0a0c10]', text: 'text-gray-400', icon: Activity };
          if (packet.type === PacketType.VISUAL_THOUGHT)
            style = { border: 'border-pink-500/50', bg: 'bg-pink-900/10', text: 'text-pink-400', icon: ImageIcon };
          else if (packet.type === PacketType.VISUAL_PERCEPTION)
            style = { border: 'border-purple-500/50', bg: 'bg-purple-900/10', text: 'text-purple-300', icon: Eye };
          else if (packet.type === PacketType.THOUGHT_CANDIDATE)
            style = { border: 'border-purple-900/50', bg: 'bg-purple-900/10', text: 'text-purple-300', icon: BrainCircuit };
          else if (packet.type === PacketType.PREDICTION_ERROR)
            style = { border: 'border-red-900/50', bg: 'bg-red-900/10', text: 'text-red-400', icon: ShieldAlert };
          else if (packet.type === PacketType.SYSTEM_ALERT)
            style = { border: 'border-orange-500/50', bg: 'bg-orange-900/10', text: 'text-orange-400', icon: ShieldAlert };

          return (
            <div
              key={packet.id}
              className={`border-l-4 p-4 rounded-r-xl ${style.border} ${style.bg} transition-all hover:bg-gray-800/80 shadow-lg group`}
            >
              <div className="flex justify-between items-center mb-2">
                <span
                  className={`text-[11px] font-black flex items-center gap-2 tracking-widest ${style.text} uppercase`}
                >
                  <style.icon size={12} className="group-hover:animate-pulse" />
                  {packet.type.replace(/_/g, ' ')}
                </span>
                <span className="text-[9px] text-gray-500 font-mono font-bold">
                  {new Date(packet.timestamp).toLocaleTimeString()}
                </span>
              </div>
              <div className="pl-4 border-l border-gray-800/50 ml-1.5 py-1">{renderPayload(packet)}</div>
            </div>
          );
        })}
      </div>
    </>
  );
}
