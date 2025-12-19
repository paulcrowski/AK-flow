import React from 'react';
import { Copy, Check } from 'lucide-react';

export function NeuroMonitorSqlPanel(props: {
  sqlCode: string;
  copied: boolean;
  onCopy: () => void;
}) {
  const { sqlCode, copied, onCopy } = props;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-4">
        <div className="text-gray-400 text-xs font-bold uppercase tracking-wider">V3.1 MEMORY SCHEMA</div>
        <button
          onClick={onCopy}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[11px] font-bold transition-all ${copied
            ? 'bg-green-600 text-white'
            : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}
        >
          {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'COPIED' : 'COPY SQL'}
        </button>
      </div>
      <div className="bg-[#0f1219] p-4 rounded-lg border border-gray-700 overflow-x-auto">
        <pre className="text-gray-400 font-mono text-[10px] leading-relaxed select-all whitespace-pre">{sqlCode}</pre>
      </div>
    </div>
  );
}

export default NeuroMonitorSqlPanel;
