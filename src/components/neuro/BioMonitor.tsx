import React from 'react';
import { Radio } from 'lucide-react';
import type { GoalState, LimbicState, NeurotransmitterState, SomaState } from '../../types';
import { VitalsPanel } from './VitalsPanel';

export function BioMonitor(props: {
  limbicState: LimbicState;
  somaState: SomaState;
  neuroState?: NeurotransmitterState;
  logFilter: 'ALL' | 'DREAMS' | 'CHEM' | 'SPEECH' | 'ERRORS' | 'FLOW' | 'CONFESS';
  onLogFilterChange: (v: 'ALL' | 'DREAMS' | 'CHEM' | 'SPEECH' | 'ERRORS' | 'FLOW' | 'CONFESS') => void;
  goalState?: GoalState;
}) {
  const {
    limbicState,
    somaState,
    neuroState,
    logFilter,
    onLogFilterChange,
    goalState
  } = props;

  return (
    <div className="bg-[#0a0c12] border-b border-gray-800 p-4">
      <VitalsPanel limbicState={limbicState} somaState={somaState} neuroState={neuroState} />

      {neuroState && (
        <div className="mt-4 pt-3 border-t border-gray-800">
          <div className="flex justify-between items-center mb-2">
            <span className="text-[9px] text-gray-500 uppercase tracking-wider flex items-center gap-1">
              <Radio size={10} className="text-purple-400" /> CHEMICAL SOUL
            </span>
            <span className="text-[9px] font-mono text-purple-300">FLOW: {neuroState.dopamine > 70 ? 'ON' : 'IDLE'}</span>
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
            {['ALL', 'DREAMS', 'CHEM', 'SPEECH', 'ERRORS', 'FLOW', 'CONFESS'].map((mode) => (
              <button
                key={mode}
                onClick={() => onLogFilterChange(mode as any)}
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
  );
}
