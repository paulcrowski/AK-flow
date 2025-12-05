import React, { useState } from 'react';
import { Bot, Plus, Check, Loader2, LogOut, ChevronDown } from 'lucide-react';
import { useSession, Agent } from '../contexts/SessionContext';

export function AgentSelector() {
  const { userId, agents, currentAgent, selectAgent, createAgent, logout, isLoading } = useSession();
  const [isOpen, setIsOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newAgentName, setNewAgentName] = useState('');

  const handleCreateAgent = async () => {
    if (!newAgentName.trim()) return;
    
    setIsCreating(true);
    const agent = await createAgent(newAgentName);
    if (agent) {
      selectAgent(agent.id);
      setNewAgentName('');
    }
    setIsCreating(false);
    setIsOpen(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 bg-[#12141a] border border-gray-800 rounded-lg">
        <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
        <span className="text-sm text-gray-500">Ładowanie...</span>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Current Agent Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 bg-[#12141a] border border-gray-700 hover:border-gray-600 rounded-lg transition-colors"
      >
        <Bot className="w-4 h-4 text-cyan-400" />
        <span className="text-sm text-gray-200 font-medium">
          {currentAgent?.name || 'Wybierz agenta'}
        </span>
        <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)}
          />
          
          {/* Menu */}
          <div className="absolute top-full left-0 mt-2 w-64 bg-[#12141a] border border-gray-800 rounded-xl shadow-xl z-50 overflow-hidden">
            {/* User Info */}
            <div className="px-4 py-3 border-b border-gray-800 bg-[#0a0c10]">
              <p className="text-xs text-gray-500">Zalogowany jako</p>
              <p className="text-sm text-gray-300 font-mono truncate">{userId}</p>
            </div>

            {/* Agent List */}
            <div className="max-h-48 overflow-y-auto">
              {agents.length === 0 ? (
                <div className="px-4 py-3 text-sm text-gray-500 text-center">
                  Brak agentów
                </div>
              ) : (
                agents.map((agent) => (
                  <button
                    key={agent.id}
                    onClick={() => {
                      selectAgent(agent.id);
                      setIsOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-800/50 transition-colors ${
                      agent.id === currentAgent?.id ? 'bg-cyan-500/10' : ''
                    }`}
                  >
                    <Bot className={`w-4 h-4 ${agent.id === currentAgent?.id ? 'text-cyan-400' : 'text-gray-500'}`} />
                    <div className="flex-1 text-left">
                      <p className={`text-sm font-medium ${agent.id === currentAgent?.id ? 'text-cyan-400' : 'text-gray-300'}`}>
                        {agent.name}
                      </p>
                      <p className="text-xs text-gray-600">
                        curiosity: {(agent.trait_vector?.curiosity * 100).toFixed(0)}%
                      </p>
                    </div>
                    {agent.id === currentAgent?.id && (
                      <Check className="w-4 h-4 text-cyan-400" />
                    )}
                  </button>
                ))
              )}
            </div>

            {/* Create New Agent */}
            <div className="border-t border-gray-800 p-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newAgentName}
                  onChange={(e) => setNewAgentName(e.target.value)}
                  placeholder="Nazwa nowego agenta..."
                  className="flex-1 px-3 py-1.5 bg-[#0a0c10] border border-gray-700 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500"
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateAgent()}
                />
                <button
                  onClick={handleCreateAgent}
                  disabled={!newAgentName.trim() || isCreating}
                  className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg transition-colors"
                >
                  {isCreating ? (
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                  ) : (
                    <Plus className="w-4 h-4 text-white" />
                  )}
                </button>
              </div>
            </div>

            {/* Logout */}
            <div className="border-t border-gray-800">
              <button
                onClick={() => {
                  logout();
                  setIsOpen(false);
                }}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-red-400 hover:bg-red-500/10 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span className="text-sm">Wyloguj</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
