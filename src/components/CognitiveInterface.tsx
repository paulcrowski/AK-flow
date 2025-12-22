import React, { useState, useEffect, useRef } from 'react';
import { eventBus } from '../core/EventBus';
import { AgentType, PacketType } from '../types';
import { NeuroMonitor } from './NeuroMonitor';
import { useCognitiveKernelLite, AgentIdentity } from '../hooks/useCognitiveKernelLite';
import { useSession } from '../contexts/SessionContext';
import { AgentSelector } from './AgentSelector';
import { initLimbicConfessionListener } from '../core/listeners/LimbicConfessionListener';
import { useTraceAnalytics } from '../hooks/useTraceAnalytics';
import { Loader2, Zap, Power, Moon, EyeOff } from 'lucide-react';
import { LeftSidebar } from './layout/LeftSidebar';
import { ChatContainer } from './chat/ChatContainer';
import { ChatInput } from './chat/ChatInput';
import { TraceHudControls } from './trace/TraceHudControls';
import { useLoadedAgentIdentity } from '../hooks/useLoadedAgentIdentity';

export function CognitiveInterface() {
    // --- SESSION (Multi-Agent) ---
    const { userId, agentId, currentAgent, getAgentIdentity, logout } = useSession();

    const {
        traceHud,
        traceHudOpen,
        setTraceHudOpen,
        traceHudCopyState,
        traceHudFrozen,
        toggleFrozen,
        copyCurrentTrace,
        copyCurrentTraceWithWindow
    } = useTraceAnalytics();

    const { loadedIdentity, identityLoading, pinnedSessions, togglePin } = useLoadedAgentIdentity({
        agentId,
        currentAgent,
        getAgentIdentity
    });

    // --- COGNITIVE KERNEL (The Brain) ---
    const {
        limbicState,
        somaState,
        resonanceField,
        neuroState,
        autonomousMode,
        conversationSessions,
        activeConversationSessionId,
        conversation,
        isProcessing,
        currentThought,
        systemError,
        handleInput,
        selectConversationSession,
        retryLastAction,
        toggleAutonomy,
        toggleSleep,
        chemistryEnabled,
        toggleChemistry,
        injectStateOverride,
        goalState,
        resetKernel
    } = useCognitiveKernelLite(loadedIdentity);

    const [input, setInput] = useState('');
    const [sessionTokens, setSessionTokens] = useState(0);
    const chatEndRef = useRef<HTMLDivElement>(null);
    const chatScrollRef = useRef<HTMLDivElement>(null);
    const shouldAutoScrollRef = useRef(true);
    const lastResetSessionRef = useRef<string | null>(null); // Guard against StrictMode double-reset

    // --- KERNEL RESET ON SESSION CHANGE ---
    useEffect(() => {
        const sessionKey = `${userId}-${agentId}`;
        // Guard: Skip if already reset for this session (StrictMode protection)
        if (lastResetSessionRef.current === sessionKey) return;
        lastResetSessionRef.current = sessionKey;

        // When user or agent changes, fully reset cognitive kernel state
        resetKernel();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userId, agentId]);

    // --- SUBSCRIPTIONS (UI Only) ---
    useEffect(() => {
        const unsubscribe = eventBus.subscribe(PacketType.PREDICTION_ERROR, (packet) => {
            if (packet.source === AgentType.SOMA && packet.payload?.metric === "TOKEN_USAGE") {
                setSessionTokens(prev => prev + (packet.payload.total || 0));
            }
        });
        return () => unsubscribe();
    }, []);

    // --- CONFESSION V2 LISTENER INIT ---
    const limbicRef = useRef(limbicState);
    limbicRef.current = limbicState;

    useEffect(() => {
        // Initialize limbic confession listener with getter/setter
        // Returns cleanup function, singleton guard prevents duplicates
        const cleanup = initLimbicConfessionListener(
            () => limbicRef.current,
            (newState) => {
                // Use injectStateOverride to update individual keys
                injectStateOverride('limbic', 'frustration', newState.frustration);
            }
        );
        console.log('[CognitiveInterface] ✅ Confession v2 listeners initialized');

        return cleanup;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Empty deps - singleton, only init once


    useEffect(() => {
        const el = chatScrollRef.current;
        if (!el) return;

        const onScroll = () => {
            const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 160;
            shouldAutoScrollRef.current = atBottom;
        };

        el.addEventListener('scroll', onScroll, { passive: true });
        onScroll();
        return () => el.removeEventListener('scroll', onScroll);
    }, []);

    useEffect(() => {
        if (!shouldAutoScrollRef.current) return;
        if (chatEndRef.current) {
            chatEndRef.current.scrollIntoView({ behavior: 'auto' });
        }
    }, [conversation]);

    // FAZA 5: Show loading screen while identity is being fetched
    // All hooks are above this point, so React rules are satisfied
    if (identityLoading) {
        return (
            <div className="flex h-[100dvh] items-center justify-center bg-brain-dark text-gray-100">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="w-8 h-8 animate-spin text-brain-accent" />
                    <span className="text-sm text-gray-400">Loading agent identity...</span>
                </div>
            </div>
        );
    }

    const onSend = () => {
        if (!input.trim()) return;
        shouldAutoScrollRef.current = true;
        handleInput(input);
        setInput('');
    };

    // Biological States
    const isFatigued = somaState.energy < 20;
    const isCritical = somaState.energy < 5;
    const isSleeping = somaState.isSleeping;

    return (
        <div className={`flex h-[100dvh] text-gray-100 font-sans transition-all duration-100 overflow-hidden 
        ${isSleeping ? 'brightness-50 grayscale-[0.5]' : ''} 
        ${isFatigued && !isSleeping ? 'brightness-75' : ''}
    `}>

            {/* EXHAUSTION VIGNETTE */}
            <div className={`absolute inset-0 pointer-events-none z-50 transition-opacity duration-[3000ms]
          ${isFatigued ? 'opacity-100' : 'opacity-0'}
          bg-[radial-gradient(circle_at_center,transparent_50%,rgba(0,0,0,0.8)_100%)]
      `}></div>

            {/* SLEEP BLUR OVERLAY */}
            {isSleeping && (
                <div className="absolute inset-0 z-40 backdrop-blur-sm pointer-events-none animate-pulse bg-[#0a0c10]/40"></div>
            )}

            {/* LEFT SIDEBAR */}
            <LeftSidebar
                userId={userId}
                currentAgentName={currentAgent?.name || null}
                autonomousMode={autonomousMode}
                isSleeping={isSleeping}
                chemistryEnabled={chemistryEnabled}
                conversation={conversation}
                conversationSessions={conversationSessions}
                activeConversationSessionId={activeConversationSessionId}
                pinnedSessions={pinnedSessions}
                onLogout={logout}
                onToggleAutonomy={toggleAutonomy}
                onToggleSleep={toggleSleep}
                onToggleChemistry={toggleChemistry}
                onResetKernel={resetKernel}
                onSelectSession={selectConversationSession}
                onTogglePin={togglePin}
            />

            <div className="flex-1 flex flex-col relative z-10 min-w-0">
                {/* Header */}
                <header className={`h-16 border-b flex items-center justify-between px-6 transition-colors duration-1000 ${isFatigued ? 'bg-[#151010] border-red-900/20' : 'bg-brain-dark border-gray-700'}`}>
                    <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full transition-all duration-1000 
                    ${isProcessing ? 'bg-brain-accent shadow-[0_0_10px_#38bdf8]' : ''}
                    ${isSleeping ? 'bg-indigo-500 animate-[pulse_4s_infinite]' : ''}
                    ${!isProcessing && !isSleeping && isFatigued ? 'bg-yellow-600 animate-[pulse_2s_infinite]' : 'bg-green-500'}
                `}></div>
                        <h1 className="font-extrabold text-2xl tracking-tighter flex items-center gap-2 bg-gradient-to-r from-brain-accent to-cyan-200 bg-clip-text text-transparent">
                            AK-FLOW
                            <span className="text-gray-600 text-[10px] font-mono tracking-widest border border-gray-800 px-1.5 py-0.5 rounded ml-1">V4.0</span>
                        </h1>
                        <AgentSelector />
                    </div>
                    <TraceHudControls
                        sessionTokens={sessionTokens}
                        traceHud={traceHud}
                        traceHudOpen={traceHudOpen}
                        setTraceHudOpen={setTraceHudOpen}
                        traceHudCopyState={traceHudCopyState}
                        traceHudFrozen={traceHudFrozen}
                        toggleFrozen={toggleFrozen}
                        copyCurrentTrace={copyCurrentTrace}
                        copyCurrentTraceWithWindow={copyCurrentTraceWithWindow}
                        autonomousMode={autonomousMode}
                        isCritical={isCritical}
                        onToggleAutonomy={toggleAutonomy}
                    />
                </header>

                <div className={`min-h-14 py-3 border-b border-gray-700 flex items-start px-6 text-sm font-mono transition-colors duration-1000 ${systemError ? 'bg-red-900/20 text-red-400' :
                    isSleeping ? 'bg-indigo-950/20 text-indigo-300' :
                        isFatigued ? 'bg-[#1a1010] text-orange-300' :
                            'bg-brain-panel text-brain-accent'
                    }`}>
                    <span className="mr-2 font-bold flex items-center gap-2 opacity-70 shrink-0">
                        {isProcessing ? <Loader2 size={12} className="animate-spin" /> :
                            isSleeping ? <Moon size={12} /> :
                                isFatigued ? <EyeOff size={12} /> : <Zap size={12} />}

                        {systemError ? 'CRITICAL:' :
                            isSleeping ? 'REM STATE:' :
                                isFatigued ? 'DROWSY:' : 'CORTEX:'}
                    </span>
                    <span className={`${isProcessing ? 'animate-pulse' : ''} italic opacity-90 break-words overflow-wrap-anywhere`}>
                        {currentThought}
                    </span>
                </div>

                {/* Chat Area */}
                <ChatContainer
                    conversation={conversation}
                    systemError={systemError}
                    onRetry={retryLastAction}
                />

                {/* Input Area */}
                <ChatInput
                    value={input}
                    onChange={setInput}
                    onSend={onSend}
                    onToggleSleep={toggleSleep}
                    disabled={isSleeping || !!systemError}
                    isSleeping={isSleeping}
                    isFatigued={isFatigued}
                    isCritical={isCritical}
                />
            </div>

            {/* RIGHT: NEURO-MONITOR */}
            <div className="w-[450px] shrink-0 h-full border-l border-gray-800 hidden lg:block overflow-hidden bg-[#0a0c12]">
                <NeuroMonitor
                    limbicState={limbicState}
                    somaState={somaState}
                    resonanceField={resonanceField}
                    injectStateOverride={injectStateOverride}
                    neuroState={neuroState}
                    chemistryEnabled={chemistryEnabled}
                    onToggleChemistry={toggleChemistry}
                    goalState={goalState}
                />
            </div>
        </div>
    );
}

export default CognitiveInterface;
