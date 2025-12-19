
import React, { useEffect } from 'react';
import { useSession } from './contexts/SessionContext';
import { LoginScreen } from './components/LoginScreen';
import { AgentSelector } from './components/AgentSelector';
import { CognitiveInterface } from './components/CognitiveInterface';
import { ComponentErrorBoundary } from './components/ComponentErrorBoundary';
import { Brain, Loader2 } from 'lucide-react';
import { setCurrentAgentId } from './services/supabase';
import { logSystemConfig, validateWiring } from './core/config';
import { eventBus } from './core/EventBus';
import { PacketType } from './types';
import { generateUUID } from './utils/uuid';

// ALARM 3: Log system config and validate wiring at startup
// This runs ONCE when the module is loaded
logSystemConfig();

if (import.meta.env.DEV) {
  const g = globalThis as any;
  if (typeof g.generateUUID !== 'function') {
    g.generateUUID = generateUUID;
  }
  if (!g.__AKFLOW_CONSOLE_PACKET_LOGGER__) {
    g.__AKFLOW_CONSOLE_PACKET_LOGGER__ = true;
    eventBus.subscribe(PacketType.SYSTEM_ALERT, (packet: any) => {
      console.log('[SYSTEM_ALERT]', packet?.payload?.event ?? packet?.payload, packet);
    });
    eventBus.subscribe(PacketType.THOUGHT_CANDIDATE, (packet: any) => {
      console.log('[THOUGHT]', packet?.payload?.event ?? packet?.payload, packet);
    });
    eventBus.subscribe(PacketType.PREDICTION_ERROR, (packet: any) => {
      console.warn('[PREDICTION_ERROR]', packet?.payload?.metric ?? packet?.payload?.event ?? packet?.payload, packet);
    });
  }
}

// Validate critical systems are wired correctly
// This catches "plumbing errors" before they cause runtime issues
validateWiring().then(result => {
  if (!result.allPassed) {
    console.error('🚨 CRITICAL: Some systems are not properly wired!');
    console.error('Failed systems:', result.criticalFailures);
  }
});

function App() {
    const { userId, agentId, isLoading } = useSession();

    // Ensure global services know about the active agent
    useEffect(() => {
        setCurrentAgentId(agentId);
    }, [agentId]);

    // 1. LOGIN SCREEN
    if (!userId) {
        return <LoginScreen />;
    }

    // 2. LOADING STATE
    if (isLoading) {
        return (
            <div className="min-h-screen bg-[#0a0c10] flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
                    <p className="text-gray-500 text-sm">Ładowanie agentów...</p>
                </div>
            </div>
        );
    }

    // 3. AGENT SELECTION
    if (!agentId) {
        return (
            <div className="min-h-screen bg-[#0a0c10] flex items-center justify-center">
                <div className="text-center">
                    <Brain className="w-16 h-16 text-cyan-400 mx-auto mb-4" />
                    <h2 className="text-xl text-white mb-4">Wybierz agenta</h2>
                    <AgentSelector />
                </div>
            </div>
        );
    }

    // 4. COGNITIVE INTERFACE (MAIN APP)
    return (
        // @ts-expect-error - Known React class component typing issue with moduleResolution: bundler
        <ComponentErrorBoundary componentName="CognitiveInterface">
            <CognitiveInterface />
        </ComponentErrorBoundary>
    );
}

export default App;
