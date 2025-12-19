/**
 * LeftSidebar - Session management and settings panel
 * 
 * Extracted from CognitiveInterface.tsx for modularity.
 * 
 * @module components/layout/LeftSidebar
 */

import React from 'react';
import { LogOut, Power, Moon, Sun, Zap, RefreshCw, Pin, Copy, Trash2, FileText, ChevronDown, ChevronUp } from 'lucide-react';
import { AgentSelector } from '../AgentSelector';
import { LibraryPanel } from '../LibraryPanel';
import type { ConversationSessionSummary } from '../../services/ConversationArchive';
import type { UiMessage } from '../../stores/cognitiveStore';
import { useArtifactStore } from '../../stores/artifactStore';

interface LeftSidebarProps {
  userId: string | null;
  currentAgentName: string | null;
  autonomousMode: boolean;
  isSleeping: boolean;
  chemistryEnabled: boolean;
  conversation: UiMessage[];
  conversationSessions: ConversationSessionSummary[];
  activeConversationSessionId: string | null;
  pinnedSessions: string[];
  onLogout: () => void;
  onToggleAutonomy: () => void;
  onToggleSleep: () => void;
  onToggleChemistry: () => void;
  onResetKernel: () => void;
  onSelectSession: (sessionId: string | null) => void;
  onTogglePin: (e: React.MouseEvent, sessionId: string) => void;
}

export const LeftSidebar: React.FC<LeftSidebarProps> = ({
  userId,
  currentAgentName,
  autonomousMode,
  isSleeping,
  chemistryEnabled,
  conversation,
  conversationSessions,
  activeConversationSessionId,
  pinnedSessions,
  onLogout,
  onToggleAutonomy,
  onToggleSleep,
  onToggleChemistry,
  onResetKernel,
  onSelectSession,
  onTogglePin
}) => {
  const sessions = conversationSessions || [];
  const pinned = sessions.filter(s => pinnedSessions.includes(s.sessionId));
  const unpinned = sessions.filter(s => !pinnedSessions.includes(s.sessionId));
  const sortedSessions = [...pinned, ...unpinned];

  const [artifactsOpen, setArtifactsOpen] = React.useState(false);
  const artifacts = useArtifactStore((s) => s.list());
  const evidenceCount = useArtifactStore((s) => s.evidence.length);
  const clearEvidence = useArtifactStore((s) => s.clearEvidence);

  const copyText = async (text: string) => {
    try {
      if (typeof navigator === 'undefined' || !navigator.clipboard) return;
      await navigator.clipboard.writeText(String(text || ''));
    } catch {
      // ignore
    }
  };

  return (
    <div className="hidden xl:flex w-[280px] shrink-0 h-full border-r border-gray-800 bg-[#07090d] flex-col relative z-10 overflow-hidden">
      {/* Session Info */}
      <div className="p-4 border-b border-gray-800 bg-[#0a0c10] shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_10px_#38bdf8]" />
            <div className="text-[10px] font-mono tracking-widest text-gray-300">SESSION</div>
          </div>
          <button
            onClick={onLogout}
            className="text-gray-500 hover:text-red-400 transition-colors"
            title="Logout"
          >
            <LogOut size={14} />
          </button>
        </div>
        <div className="mt-3 space-y-1">
          <div className="text-[10px] text-gray-500 font-mono truncate">{userId || '—'}</div>
          <div className="text-sm text-gray-200 font-semibold truncate">{currentAgentName || 'No agent selected'}</div>
        </div>
        <div className="mt-3">
          <AgentSelector />
        </div>
      </div>

      {/* Quick Settings */}
      <div className="p-4 border-b border-gray-800 shrink-0">
        <div className="text-[10px] font-mono tracking-widest text-gray-500 mb-3">QUICK SETTINGS</div>
        <div className="grid grid-cols-1 gap-2">
          <button
            onClick={onToggleAutonomy}
            className={`flex items-center justify-between px-3 py-2 rounded-lg border text-[11px] font-mono transition-colors ${autonomousMode ? 'border-green-500/50 bg-green-900/20 text-green-300' : 'border-gray-700 bg-gray-900/30 text-gray-400 hover:bg-gray-900/60'}`}
          >
            <span className="flex items-center gap-2"><Power size={12} /> AUTONOMY</span>
            <span>{autonomousMode ? 'ON' : 'OFF'}</span>
          </button>

          <button
            onClick={onToggleSleep}
            className={`flex items-center justify-between px-3 py-2 rounded-lg border text-[11px] font-mono transition-colors ${isSleeping ? 'border-indigo-500/50 bg-indigo-900/20 text-indigo-300' : 'border-gray-700 bg-gray-900/30 text-gray-400 hover:bg-gray-900/60'}`}
          >
            <span className="flex items-center gap-2">{isSleeping ? <Sun size={12} /> : <Moon size={12} />} SLEEP</span>
            <span>{isSleeping ? 'ON' : 'OFF'}</span>
          </button>

          {typeof chemistryEnabled === 'boolean' && (
            <button
              onClick={onToggleChemistry}
              className={`flex items-center justify-between px-3 py-2 rounded-lg border text-[11px] font-mono transition-colors ${chemistryEnabled ? 'border-purple-500/50 bg-purple-900/20 text-purple-300' : 'border-gray-700 bg-gray-900/30 text-gray-400 hover:bg-gray-900/60'}`}
            >
              <span className="flex items-center gap-2"><Zap size={12} /> CHEM</span>
              <span>{chemistryEnabled ? 'ON' : 'OFF'}</span>
            </button>
          )}

          <button
            onClick={onResetKernel}
            className="flex items-center justify-between px-3 py-2 rounded-lg border border-gray-700 bg-gray-900/30 text-[11px] font-mono text-gray-400 hover:bg-gray-900/60 transition-colors"
          >
            <span className="flex items-center gap-2"><RefreshCw size={12} /> RESET</span>
            <span>NOW</span>
          </button>
        </div>
      </div>

      <div className="shrink-0">
        <LibraryPanel />
      </div>

      <div className="shrink-0 border-b border-gray-800">
        <button
          onClick={() => setArtifactsOpen((v) => !v)}
          className="w-full p-4 flex items-center justify-between text-left"
          title="Artifacts"
        >
          <div className="flex items-center gap-2">
            <FileText size={14} className="text-gray-500" />
            <div className="text-[10px] font-mono tracking-widest text-gray-500">ARTIFACTS</div>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-[10px] font-mono text-gray-600 bg-gray-900/50 px-1.5 py-0.5 rounded">{artifacts.length}</div>
            {artifactsOpen ? <ChevronUp size={14} className="text-gray-500" /> : <ChevronDown size={14} className="text-gray-500" />}
          </div>
        </button>

        {artifactsOpen && (
          <div className="px-4 pb-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text-[10px] font-mono text-gray-600">evidence: {evidenceCount}</div>
              <button
                onClick={() => clearEvidence()}
                className="flex items-center gap-1.5 text-[10px] font-mono text-gray-500 hover:text-red-400 transition-colors"
                title="Clear evidence"
                disabled={evidenceCount === 0}
              >
                <Trash2 size={12} /> CLEAR
              </button>
            </div>

            <div className="space-y-1.5">
              {artifacts.slice(0, 10).map((a) => (
                <div key={a.id} className="rounded-lg border border-gray-800/60 bg-gray-900/10 px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-[11px] text-gray-200 font-semibold truncate">{a.name}</div>
                      <div className="text-[9px] font-mono text-gray-600 truncate">{a.id}</div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => void copyText(a.id)}
                        className="p-1 rounded border border-gray-800/60 text-gray-500 hover:text-gray-200 hover:bg-gray-800/30 transition-colors"
                        title="Copy id"
                      >
                        <Copy size={12} />
                      </button>
                      <button
                        onClick={() => void copyText(a.content)}
                        className="p-1 rounded border border-gray-800/60 text-gray-500 hover:text-gray-200 hover:bg-gray-800/30 transition-colors"
                        title="Copy content"
                      >
                        <Copy size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {artifacts.length === 0 && (
                <div className="text-[10px] text-gray-600 italic text-center py-2">No artifacts yet.</div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Sessions List */}
      <div className="flex-1 overflow-hidden flex flex-col min-h-0">
        <div className="p-4 border-b border-gray-800 bg-[#0a0c10]/40 shrink-0">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[10px] font-black tracking-[0.2em] text-cyan-500/80 uppercase">Tematy</div>
            <div className="text-[10px] font-mono text-gray-600 bg-gray-900/50 px-1.5 py-0.5 rounded">{sessions.length}</div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => onSelectSession(activeConversationSessionId)}
              className="px-3 py-2 rounded-lg border border-gray-700 bg-gray-900/30 text-[11px] font-mono text-gray-300 hover:bg-gray-900/60 transition-colors"
              title="Continue active session"
              disabled={!activeConversationSessionId}
            >
              CONTINUE
            </button>
            <button
              onClick={() => onSelectSession(null)}
              className="px-3 py-2 rounded-lg border border-gray-700 bg-gray-900/30 text-[11px] font-mono text-gray-300 hover:bg-gray-900/60 transition-colors"
              title="Start new session thread"
            >
              NEW
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-2 space-y-1.5 custom-scrollbar min-h-0 bg-[#050608]/20">
          {sortedSessions.slice(0, 50).map((s) => {
            const isActive = activeConversationSessionId === s.sessionId;
            const isPinned = pinnedSessions.includes(s.sessionId);
            const label = s.preview || s.sessionId;
            const ts = Number.isFinite(s.lastTimestamp) ? new Date(s.lastTimestamp).toLocaleDateString() : '';
            return (
              <div key={s.sessionId} className="group relative">
                <button
                  onClick={() => onSelectSession(s.sessionId)}
                  className={`w-full text-left rounded-lg border px-3 py-2.5 text-[11px] transition-all duration-300 ${isActive
                    ? 'border-cyan-500/40 bg-cyan-950/20 text-cyan-100 shadow-[0_4px_12px_rgba(34,211,238,0.05)] scale-[1.02] z-10'
                    : 'border-gray-800/60 bg-gray-900/10 text-gray-400 hover:border-gray-700 hover:bg-gray-800/30'
                  }`}
                  title={s.sessionId}
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5 pointer-events-none">
                    <span className="text-[9px] font-mono uppercase tracking-widest opacity-40">{ts || '—'}</span>
                    <div className="flex items-center gap-1.5">
                      {isPinned && <Pin size={8} className="text-cyan-400 fill-cyan-400" />}
                      <span className="text-[9px] font-mono text-gray-600 border border-gray-800/50 px-1 rounded">{s.messageCount}</span>
                    </div>
                  </div>
                  <div className="line-clamp-2 leading-snug font-medium opacity-90 group-hover:opacity-100 transition-opacity whitespace-pre-wrap break-all overflow-hidden truncate">
                    {String(label)}
                  </div>
                </button>
                <button
                  onClick={(e) => onTogglePin(e, s.sessionId)}
                  className={`absolute top-2 right-2 p-1 rounded transition-opacity duration-300 ${isPinned ? 'opacity-100 text-cyan-400' : 'opacity-0 group-hover:opacity-100 text-gray-500 hover:text-cyan-400'}`}
                  title={isPinned ? "Odepnij" : "Przypnij"}
                >
                  <Pin size={10} className={isPinned ? "fill-cyan-400/20" : ""} />
                </button>
              </div>
            );
          })}
          {sessions.length === 0 && (
            <div className="text-[10px] text-gray-600 italic text-center py-4 uppercase tracking-[0.2em] opacity-50">BRAK ARCHIWUM</div>
          )}
        </div>

        {/* Last Conversation Preview */}
        <div className="h-[30%] shrink-0 border-t border-gray-800 flex flex-col min-h-0 bg-[#050608]/40">
          <div className="p-3 border-b border-gray-800/40 shrink-0">
            <div className="flex items-center justify-between">
              <div className="text-[10px] font-black tracking-[0.2em] text-gray-500 uppercase">Ostatnie wpisy</div>
              <div className="text-[9px] font-mono text-gray-600">{conversation.length}</div>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
            {conversation.slice(-20).reverse().map((msg, idx) => (
              <div
                key={`sidebar-${msg.role}-${idx}`}
                className={`rounded-lg border px-3 py-2 text-[11px] leading-snug ${msg.role === 'user'
                  ? 'border-blue-900/30 bg-blue-900/10 text-blue-100'
                  : msg.type === 'thought'
                    ? 'border-gray-800 bg-gray-900/30 text-gray-400 italic'
                    : 'border-gray-800 bg-gray-900/20 text-gray-200'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[9px] font-mono uppercase tracking-wider text-gray-500">{msg.role}</span>
                  <span className="text-[9px] font-mono text-gray-600">{msg.type || 'speech'}</span>
                </div>
                <div className="break-words opacity-90">
                  {String(msg.text || '').slice(0, 140)}{String(msg.text || '').length > 140 ? '…' : ''}
                </div>
              </div>
            ))}
            {conversation.length === 0 && (
              <div className="text-[11px] text-gray-600 italic text-center">No messages yet.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LeftSidebar;
