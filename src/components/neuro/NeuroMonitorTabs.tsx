import React from 'react';
import { Cpu, BrainCircuit, BedDouble, Share2, Database, Zap } from 'lucide-react';

export type Tab = 'SYSTEM' | 'MIND' | 'SLEEP' | 'NETWORK' | 'SQL' | 'DEBUG';

export function NeuroMonitorTabs(props: {
  activeTab: Tab;
  setActiveTab: (t: Tab) => void;
}) {
  const { activeTab, setActiveTab } = props;

  return (
    <div className="flex bg-[#0f1219] border-b border-gray-800">
      {[
        { id: 'SYSTEM', icon: Cpu, label: 'KERNEL' },
        { id: 'MIND', icon: BrainCircuit, label: 'CORTEX' },
        { id: 'SLEEP', icon: BedDouble, label: 'DREAMS' },
        { id: 'NETWORK', icon: Share2, label: 'GRAPH' },
        { id: 'SQL', icon: Database, label: 'DB' },
        { id: 'DEBUG', icon: Zap, label: 'DEBUG' }
      ].map((tab) => (
        <button
          key={tab.id}
          onClick={() => setActiveTab(tab.id as Tab)}
          className={`flex-1 py-4 text-center text-[11px] font-black tracking-widest flex items-center justify-center gap-2 transition-all border-r border-gray-800 last:border-r-0 ${activeTab === tab.id
            ? 'text-white bg-gray-800/50 border-b-2 border-brain-accent shadow-[inset_0_-10px_20px_rgba(56,189,248,0.05)]'
            : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/30'}`}
        >
          <tab.icon size={14} /> {tab.label}
        </button>
      ))}
    </div>
  );
}

export default NeuroMonitorTabs;
