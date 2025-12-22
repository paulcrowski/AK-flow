import React from 'react';
import { Activity, Moon, BedDouble } from 'lucide-react';
import type { SomaState } from '../../types';

export function NeuroMonitorSleepPanel(props: {
  somaState: SomaState;
  sleepEvents: { timestamp: number; type: 'SLEEP_START' | 'SLEEP_END'; energy: number }[];
  dreamLessons: { timestamp: number; lessons: string[] }[];
  traitProposals: { timestamp: number; proposal: any; reasoning: string }[];
  dreamConsolidations5m: number;
}) {
  const { somaState, sleepEvents, dreamLessons, traitProposals, dreamConsolidations5m } = props;

  return (
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
                <div className="text-[8px] text-gray-500 mb-1">{new Date(lessonSet.timestamp).toLocaleTimeString()}</div>
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
                <div className="text-[8px] text-gray-500">{new Date(proposal.timestamp).toLocaleTimeString()}</div>

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
  );
}

export default NeuroMonitorSleepPanel;
