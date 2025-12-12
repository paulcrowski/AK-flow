
import React, { useEffect } from 'react';
import { useSession } from './contexts/SessionContext';
import { LoginScreen } from './components/LoginScreen';
import { AgentSelector } from './components/AgentSelector';
import { CognitiveInterface } from './components/CognitiveInterface';
import { Brain, Loader2 } from 'lucide-react';
import { setCurrentAgentId } from './services/supabase';
import { logSystemConfig } from './core/config';

// ALARM 3: Log system config at startup - always know what's enabled
// This runs ONCE when the module is loaded
logSystemConfig();

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
    return <CognitiveInterface />;
}

export default App;
