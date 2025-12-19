import React from 'react';
import { Power } from 'lucide-react';
import type { TraceHudCopyState, TraceHudState } from '../../hooks/useTraceAnalytics';

export function TraceHudControls(props: {
  sessionTokens: number;
  traceHud: TraceHudState;
  traceHudOpen: boolean;
  setTraceHudOpen: React.Dispatch<React.SetStateAction<boolean>>;
  traceHudCopyState: TraceHudCopyState;
  traceHudFrozen: boolean;
  toggleFrozen: () => void;
  copyCurrentTrace: () => void;
  copyCurrentTraceWithWindow: (windowMs: number) => void;
  autonomousMode: boolean;
  isCritical: boolean;
  onToggleAutonomy: () => void;
}) {
  const {
    sessionTokens,
    traceHud,
    traceHudOpen,
    setTraceHudOpen,
    traceHudCopyState,
    traceHudFrozen,
    toggleFrozen,
    copyCurrentTrace,
    copyCurrentTraceWithWindow,
    autonomousMode,
    isCritical,
    onToggleAutonomy
  } = props;

  return (
    <div className="flex gap-4 text-xs font-mono text-gray-400 items-center relative">
      <div className="flex items-center gap-2 opacity-50 hover:opacity-100 transition-opacity">
        <span title="Session Usage">{sessionTokens.toLocaleString()} toks</span>
      </div>

      {traceHud && (
        <button
          onClick={() => setTraceHudOpen((v) => !v)}
          className={`flex items-center gap-2 px-3 py-1 rounded border transition-all ${traceHud.skipped
            ? 'border-yellow-500/50 text-yellow-300 bg-yellow-900/10'
            : traceHud.lastCommit?.blocked
              ? 'border-orange-500/50 text-orange-300 bg-orange-900/10'
              : 'border-cyan-500/40 text-cyan-300 bg-cyan-900/10'
            }`}
          title="Trace Debug"
        >
          <span className="text-[10px] tracking-widest">TRACE</span>
          <span className="text-[10px]">#{traceHud.tickNumber ?? '—'}</span>
          <span className="text-[10px] opacity-80">
            {traceHud.skipped
              ? 'SKIP'
              : traceHud.lastCommit?.blocked
                ? 'BLOCK'
                : 'OK'}
          </span>
        </button>
      )}

      {traceHudOpen && traceHud && (
        <div className="absolute top-[52px] right-0 w-[420px] bg-[#0a0c10]/95 backdrop-blur-md border border-gray-800 rounded-xl shadow-xl p-4 z-50">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[10px] font-mono tracking-widest text-gray-400">TRACE HUD</div>
            <div className="flex items-center gap-2">
              <button
                onClick={toggleFrozen}
                className={`px-2 py-1 rounded border text-[10px] font-mono tracking-widest transition-colors ${traceHud?.traceId
                  ? traceHudFrozen
                    ? 'border-yellow-500/40 text-yellow-300 bg-yellow-900/10'
                    : 'border-gray-700 text-gray-300 hover:bg-gray-900/40'
                  : 'border-gray-800 text-gray-600 cursor-not-allowed'
                  }`}
                title="Freeze HUD on current traceId"
                disabled={!traceHud?.traceId}
              >
                {traceHudFrozen ? 'FROZEN' : 'FREEZE'}
              </button>
              <button
                onClick={copyCurrentTrace}
                className={`px-2 py-1 rounded border text-[10px] font-mono tracking-widest transition-colors ${traceHud?.traceId
                  ? traceHudCopyState === 'ok'
                    ? 'border-green-500/40 text-green-300 bg-green-900/10'
                    : traceHudCopyState === 'fail'
                      ? 'border-red-500/40 text-red-300 bg-red-900/10'
                      : 'border-gray-700 text-gray-300 hover:bg-gray-900/40'
                  : 'border-gray-800 text-gray-600 cursor-not-allowed'
                  }`}
                title="Copy trace events (JSON)"
                disabled={!traceHud?.traceId}
              >
                {traceHudCopyState === 'ok' ? 'COPIED' : traceHudCopyState === 'fail' ? 'COPY FAIL' : 'COPY FULL'}
              </button>
              <button
                onClick={() => copyCurrentTraceWithWindow(2000)}
                className={`px-2 py-1 rounded border text-[10px] font-mono tracking-widest transition-colors ${traceHud?.traceId
                  ? traceHudCopyState === 'ok'
                    ? 'border-green-500/40 text-green-300 bg-green-900/10'
                    : traceHudCopyState === 'fail'
                      ? 'border-red-500/40 text-red-300 bg-red-900/10'
                      : 'border-gray-700 text-gray-300 hover:bg-gray-900/40'
                  : 'border-gray-800 text-gray-600 cursor-not-allowed'
                  }`}
                title="Copy trace events with ±2s window (captures correlated events with different traceIds)"
                disabled={!traceHud?.traceId}
              >
                COPY +2S
              </button>
              <button
                onClick={() => setTraceHudOpen(false)}
                className="text-gray-500 hover:text-gray-300 transition-colors text-[11px]"
              >
                CLOSE
              </button>
            </div>
          </div>
          <div className="space-y-2 text-[11px] font-mono">
            <div className="flex justify-between gap-3">
              <span className="text-gray-500">traceId</span>
              <span className="text-gray-200 truncate" title={traceHud.traceId || ''}>{traceHud.traceId || '—'}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-gray-500">tickNumber</span>
              <span className="text-gray-200">{traceHud.tickNumber ?? '—'}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-gray-500">durationMs</span>
              <span className="text-gray-200">{typeof traceHud.durationMs === 'number' ? traceHud.durationMs : '—'}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-gray-500">skipped</span>
              <span className={`${traceHud.skipped ? 'text-yellow-300' : 'text-gray-200'}`}>{traceHud.skipped ? 'true' : 'false'}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-gray-500">skipReason</span>
              <span className="text-gray-200 truncate" title={traceHud.skipReason || ''}>{traceHud.skipReason || '—'}</span>
            </div>

            <div className="mt-3 pt-3 border-t border-gray-800">
              <div className="text-[10px] font-mono tracking-widest text-gray-400 mb-2">LAST COMMIT</div>
              <div className="flex justify-between gap-3">
                <span className="text-gray-500">origin</span>
                <span className="text-gray-200">{traceHud.lastCommit?.origin || '—'}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-gray-500">blocked</span>
                <span className={`${traceHud.lastCommit?.blocked ? 'text-orange-300' : 'text-gray-200'}`}>{String(!!traceHud.lastCommit?.blocked)}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-gray-500">deduped</span>
                <span className={`${traceHud.lastCommit?.deduped ? 'text-orange-300' : 'text-gray-200'}`}>{String(!!traceHud.lastCommit?.deduped)}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-gray-500">blockReason</span>
                <span className="text-gray-200 truncate" title={traceHud.lastCommit?.blockReason || ''}>{traceHud.lastCommit?.blockReason || '—'}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-gray-500">counters</span>
                <span className="text-gray-200">
                  {(traceHud.lastCommit?.counters?.totalCommits ?? 0)}/{(traceHud.lastCommit?.counters?.blockedCommits ?? 0)}/{(traceHud.lastCommit?.counters?.dedupedCommits ?? 0)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      <button
        onClick={onToggleAutonomy}
        className={`flex items-center gap-2 px-3 py-1 rounded border transition-all 
          ${autonomousMode ? 'border-green-500 text-green-400 bg-green-900/20' : 'border-gray-600 text-gray-500 hover:bg-gray-800'} 
          ${isCritical ? 'border-red-500/50 text-red-400' : ''}
        `}
      >
        <Power size={12} /> {autonomousMode ? 'AUTONOMY: ON' : 'AUTONOMY: OFF'}
      </button>
    </div>
  );
}

export default TraceHudControls;
