import React from 'react';
import type { LimbicState, SomaState } from '../../types';

export function NeuroMonitorDebugPanel(props: {
  injectStateOverride: (type: 'limbic' | 'soma', key: string, value: number) => void;
  limbicState: LimbicState;
  somaState: SomaState;
}) {
  const { injectStateOverride, limbicState, somaState } = props;

  return (
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
  );
}

export default NeuroMonitorDebugPanel;
