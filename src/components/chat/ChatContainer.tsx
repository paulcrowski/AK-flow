/**
 * ChatContainer - Main chat display area
 * 
 * Extracted from CognitiveInterface.tsx for modularity.
 * 
 * @module components/chat/ChatContainer
 */

import React, { useRef, useEffect, useState } from 'react';
import { Brain, Sparkles, Globe, FileText, ImageIcon, AlertTriangle, RefreshCw } from 'lucide-react';
import type { UiMessage } from '../../stores/cognitiveStore';
import type { CognitiveError } from '../../types';
import { MemoryService } from '../../services/supabase';
import { eventBus } from '../../core/EventBus';
import { AgentType, PacketType } from '../../types';
import { generateUUID } from '../../utils/uuid';

interface ChatContainerProps {
  conversation: UiMessage[];
  systemError: CognitiveError | null;
  onRetry: () => void;
}

const renderEvidenceSourceBadge = (source?: string, detail?: string) => {
  if (!source) return null;
  const colors: Record<string, string> = {
    memory: 'bg-purple-900/30 text-purple-300 border-purple-700/50',
    tool: 'bg-cyan-900/30 text-cyan-300 border-cyan-700/50',
    system: 'bg-gray-800/50 text-gray-400 border-gray-700/50'
  };
  return (
    <span className={`ml-2 px-1.5 py-0.5 text-[8px] rounded border ${colors[source] || colors.system}`} title={detail || source}>
      {source.toUpperCase()}
    </span>
  );
};

const renderGeneratorBadge = (generator?: string) => {
  if (!generator) return null;
  const colors: Record<string, string> = {
    llm: 'bg-green-900/30 text-green-300 border-green-700/50',
    system: 'bg-gray-800/50 text-gray-400 border-gray-700/50'
  };
  return (
    <span className={`ml-1 px-1.5 py-0.5 text-[8px] rounded border ${colors[generator] || colors.system}`}>
      {generator.toUpperCase()}
    </span>
  );
};

export const ChatContainer: React.FC<ChatContainerProps> = ({
  conversation,
  systemError,
  onRetry
}) => {
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const [feedbackState, setFeedbackState] = useState<Record<string, { status: 'idle' | 'saving' | 'saved' | 'error'; message?: string }>>({});

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation]);

  const handleFeedback = async (
    messageId: string | undefined,
    memoryId: string,
    delta: number,
    setCore: boolean,
    eventName: 'USER_FEEDBACK_UPVOTE' | 'USER_FEEDBACK_DOWNVOTE' | 'USER_FEEDBACK_STAR'
  ) => {
    if (!memoryId) return;
    setFeedbackState((prev) => ({
      ...prev,
      [memoryId]: { status: 'saving' }
    }));

    const result = await MemoryService.boostMemoryStrength(memoryId, delta, setCore);
    if (!result.ok) {
      const msg = String(result.error || 'save_failed').toLowerCase();
      const isAuthError =
        result.status === 401 ||
        result.status === 403 ||
        msg.includes('jwt') ||
        msg.includes('auth');
      const isAccessError =
        msg.includes('not found') ||
        msg.includes('not allowed') ||
        msg.includes('permission');

      setFeedbackState((prev) => ({
        ...prev,
        [memoryId]: {
          status: 'error',
          message: isAuthError ? 'zaloguj sie' : isAccessError ? 'brak dostepu' : 'blad zapisu'
        }
      }));
      return;
    }

    eventBus.publish({
      id: generateUUID(),
      timestamp: Date.now(),
      source: AgentType.CORTEX_FLOW,
      type: PacketType.SYSTEM_ALERT,
      payload: {
        event: eventName,
        messageId: messageId || null,
        memoryId,
        delta
      },
      priority: 0.6
    });

    setFeedbackState((prev) => ({
      ...prev,
      [memoryId]: { status: 'saved', message: 'zapisano' }
    }));
    setTimeout(() => {
      setFeedbackState((prev) => {
        const next = { ...prev };
        delete next[memoryId];
        return next;
      });
    }, 1500);
  };

  return (
    <div 
      ref={chatScrollRef} 
      className="flex-1 min-h-0 overflow-y-auto p-6 space-y-6 bg-gradient-to-b from-brain-dark to-gray-900 scrollbar-thin relative"
    >
      {conversation.length === 0 && (
        <div className="h-full flex flex-col items-center justify-center text-gray-600 opacity-50">
          <Brain size={64} className="mb-4" />
          <p>Cognitive Kernel Active.</p>
        </div>
      )}

      {conversation.map((msg, idx) => (
        <div 
          key={idx} 
          className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} relative z-10 animate-in slide-in-from-bottom-2 fade-in duration-500`}
        >
          {/* VISUAL DREAM CARD */}
          {msg.type === 'visual' ? (
            <div className="max-w-[75%] bg-black/60 border border-pink-500/50 rounded-xl overflow-hidden shadow-[0_0_30px_rgba(236,72,153,0.15)] group hover:shadow-[0_0_50px_rgba(236,72,153,0.3)] transition-shadow duration-500">
              <div className="h-64 w-full bg-gray-900 relative overflow-hidden">
                {msg.imageData ? (
                  <img src={msg.imageData} alt="Dream" className="w-full h-full object-cover animate-in fade-in duration-1000 group-hover:scale-105 transition-transform duration-1000" />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-pink-700/50 font-mono text-xs gap-2">
                    <ImageIcon size={32} />
                    <span>[VISUAL MEMORY CORRUPTED]</span>
                  </div>
                )}
                <div className="absolute top-0 inset-x-0 p-3 bg-gradient-to-b from-black/80 to-transparent flex justify-between items-start">
                  <div className="px-2 py-1 text-[9px] text-pink-300 font-bold tracking-widest border border-pink-500/30 rounded bg-black/40 backdrop-blur-sm flex items-center gap-2 shadow-lg">
                    <Sparkles size={10} /> VISUAL CORTEX OUTPUT
                  </div>
                </div>
              </div>
              <div className="p-4 bg-gray-900/90 backdrop-blur-md border-t border-gray-800">
                <p className="text-sm text-pink-100 font-serif leading-relaxed italic">"{msg.text}"</p>
              </div>
            </div>

          ) : msg.type === 'intel' ? (
            /* INTELLIGENCE BRIEFING CARD (SEARCH) */
            <div className="max-w-[85%] bg-[#0a1018] border-l-4 border-cyan-500 rounded-r-lg shadow-lg overflow-hidden">
              <div className="bg-cyan-950/20 p-2 px-4 border-b border-cyan-900/30 flex justify-between items-center">
                <span className="text-[10px] font-bold text-cyan-400 flex items-center gap-2 tracking-widest uppercase">
                  <Globe size={12} /> Intelligence Briefing
                </span>
                <span className="text-[9px] text-cyan-600 font-mono">{new Date().toLocaleTimeString()}</span>
              </div>
              <div className="p-4 text-sm text-gray-300 font-mono leading-relaxed whitespace-pre-wrap">
                {msg.text}
              </div>
              {msg.sources && msg.sources.length > 0 && (
                <div className="bg-[#05080c] p-2 px-4 border-t border-gray-800 flex flex-wrap gap-2">
                  {msg.sources.map((src: any, i: number) => (
                    <a 
                      key={i} 
                      href={src.uri} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="text-[10px] text-cyan-600 hover:text-cyan-400 flex items-center gap-1 bg-cyan-900/10 px-2 py-1 rounded border border-cyan-900/30 transition-colors"
                    >
                      <FileText size={8} /> {src.title?.substring(0, 20)}...
                    </a>
                  ))}
                </div>
              )}
            </div>

          ) : (
            /* STANDARD MESSAGE OR THOUGHT */
            <div className={`max-w-[85%] rounded-lg shadow-2xl overflow-hidden ${
              msg.role === 'user'
                ? 'bg-gradient-to-br from-blue-900/90 to-blue-800/80 text-white rounded-br-none border border-blue-600/50 backdrop-blur-sm'
                : msg.type === 'thought'
                  ? 'bg-gradient-to-br from-gray-900/80 to-gray-800/60 text-gray-400 italic border border-dashed border-gray-700/50 backdrop-blur-sm'
                  : 'bg-gradient-to-br from-gray-800/90 to-gray-700/80 text-gray-100 rounded-bl-none border border-gray-600/50 backdrop-blur-sm shadow-[0_0_20px_rgba(56,189,248,0.15)]'
            }`}>
              {msg.type === 'thought' && (
                <div className="bg-black/30 px-3 py-1.5 border-b border-gray-700/50">
                  <span className="text-[10px] text-gray-500 uppercase tracking-widest flex items-center gap-1.5 font-bold">
                    <Brain size={10} /> INTERNAL MONOLOGUE
                  </span>
                </div>
              )}
              {msg.role !== 'user' && msg.type !== 'thought' && (
                <div className="bg-gradient-to-r from-cyan-900/30 to-transparent px-3 py-1.5 border-b border-cyan-800/30">
                  <span className="text-[10px] text-cyan-400 uppercase tracking-widest flex items-center gap-1.5 font-bold">
                    <Sparkles size={10} /> COGNITIVE OUTPUT
                    {renderEvidenceSourceBadge(msg.evidenceSource ?? msg.knowledgeSource, msg.evidenceDetail)}
                    {renderGeneratorBadge(msg.generator)}
                  </span>
                </div>
              )}
              <div className="p-4 px-5">
                <p className={`leading-relaxed ${msg.type === 'thought' ? 'text-sm font-mono opacity-80' : 'text-base font-medium'}`}>
                  {msg.text}
                </p>
                {msg.role !== 'user' && msg.type !== 'thought' && msg.agentMemoryId && (
                  <div className="mt-3 flex items-center gap-2 text-xs text-gray-400">
                    <button
                      type="button"
                      className="px-2 py-1 rounded bg-gray-900/40 border border-gray-700/50 hover:border-cyan-500/50 hover:text-cyan-200 transition-colors disabled:opacity-40"
                      onClick={() => void handleFeedback(msg.id, msg.agentMemoryId as string, 20, false, 'USER_FEEDBACK_UPVOTE')}
                      disabled={feedbackState[msg.agentMemoryId]?.status === 'saving' || feedbackState[msg.agentMemoryId]?.status === 'saved'}
                      title="wzmocnij pamiec"
                    >
                      👍
                    </button>
                    <button
                      type="button"
                      className="px-2 py-1 rounded bg-gray-900/40 border border-gray-700/50 hover:border-rose-500/50 hover:text-rose-200 transition-colors disabled:opacity-40"
                      onClick={() => void handleFeedback(msg.id, msg.agentMemoryId as string, -10, false, 'USER_FEEDBACK_DOWNVOTE')}
                      disabled={feedbackState[msg.agentMemoryId]?.status === 'saving' || feedbackState[msg.agentMemoryId]?.status === 'saved'}
                      title="oslab pamiec"
                    >
                      👎
                    </button>
                    <button
                      type="button"
                      className="px-2 py-1 rounded bg-gray-900/40 border border-gray-700/50 hover:border-amber-400/70 hover:text-amber-200 transition-colors disabled:opacity-40"
                      onClick={() => void handleFeedback(msg.id, msg.agentMemoryId as string, 30, true, 'USER_FEEDBACK_STAR')}
                      disabled={feedbackState[msg.agentMemoryId]?.status === 'saving' || feedbackState[msg.agentMemoryId]?.status === 'saved'}
                      title="oznacz jako core"
                    >
                      ⭐
                    </button>
                    {feedbackState[msg.agentMemoryId]?.message && (
                      <span className={`ml-2 text-[10px] ${
                        feedbackState[msg.agentMemoryId]?.status === 'error' ? 'text-rose-300' : 'text-emerald-300'
                      }`}>
                        {feedbackState[msg.agentMemoryId]?.message}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      ))}

      {/* SYSTEM ERROR ALERT */}
      {systemError && (
        <div className="flex justify-center animate-pulse z-20 relative">
          <div className="bg-red-900/20 border border-red-600/50 rounded p-4 max-w-md w-full flex flex-col gap-2">
            <div className="flex items-center gap-2 text-red-400 font-bold text-sm uppercase tracking-widest">
              <AlertTriangle size={16} />
              {systemError.code}
            </div>
            <div className="text-xs text-red-300 font-mono">
              {systemError.message}
            </div>
            {systemError.retryable && (
              <button
                onClick={onRetry}
                className="mt-2 bg-red-900/50 hover:bg-red-800 text-red-200 text-xs py-2 px-4 rounded flex items-center justify-center gap-2 transition-colors border border-red-700"
              >
                <RefreshCw size={12} /> RETRY CONNECTION
              </button>
            )}
          </div>
        </div>
      )}
      <div ref={chatEndRef} />
    </div>
  );
};

export default ChatContainer;
