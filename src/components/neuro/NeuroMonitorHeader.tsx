import React from 'react';
import { Activity, Download } from 'lucide-react';

export function NeuroMonitorHeader(props: {
  chemistryEnabled?: boolean;
  onToggleChemistry?: () => void;
  onExportLogs: () => void;
}) {
  const { chemistryEnabled, onToggleChemistry, onExportLogs } = props;

  return (
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
        <button onClick={onExportLogs} className="text-gray-500 hover:text-brain-accent" title="Export Logs">
          <Download size={14} />
        </button>
      </div>
    </div>
  );
}

export default NeuroMonitorHeader;
