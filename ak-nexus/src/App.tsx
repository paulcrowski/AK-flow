// ═══════════════════════════════════════════════════════════════
// AK-FLOW NEXUS - Main Application
// Version 13.0 | Production Ready
// ═══════════════════════════════════════════════════════════════

import React, { useEffect, useState } from 'react';
import { useNexusStore } from './stores/nexusStore';
import { fileService } from './services/fileService';
import { TaskBoard } from './components/TaskBoard';
import { RoadmapView } from './components/RoadmapView';
import { ChallengesView, NotesView } from './components/ChallengesAndNotes';
import { CommandPalette } from './components/CommandPalette';
import { StatusBar, SyncPanel, DetailModal } from './components/StatusBarAndModals';

// ─────────────────────────────────────────────────────────────────
// HEADER COMPONENT
// ─────────────────────────────────────────────────────────────────

const Header: React.FC<{ onOpenSync: () => void }> = ({ onOpenSync }) => {
  const { stats, syncStatus, toggleCommandPalette } = useNexusStore();

  return (
    <header className="h-14 border-b border-white/5 bg-panel/80 backdrop-blur-md flex items-center justify-between px-6 z-50">
      <div className="flex items-center gap-4">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-neon-purple shadow-[0_0_10px_#a855f7] animate-pulse" />
          <h1 className="font-mono font-bold text-sm tracking-[0.2em] text-white">
            AK-FLOW <span className="text-gray-600">/</span> NEXUS
          </h1>
        </div>

        {/* Quick Command */}
        <button 
          onClick={toggleCommandPalette}
          className="hidden md:flex items-center gap-2 px-3 py-1.5 text-xs text-gray-500 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <span>Quick Actions</span>
          <kbd className="px-1.5 py-0.5 text-[10px] bg-white/10 rounded">⌘K</kbd>
        </button>
      </div>

      <div className="flex items-center gap-6">
        {/* Sync Status Indicator */}
        <div className="flex items-center gap-2 text-xs font-mono">
          <div className={`w-2 h-2 rounded-full ${
            syncStatus.status === 'SYNCED' ? 'bg-neon-green' :
            syncStatus.status === 'PENDING' ? 'bg-yellow-400 animate-pulse' :
            'bg-red-400'
          }`} />
          <span className="text-gray-500">{syncStatus.status}</span>
        </div>

        {/* Progress Bar */}
        <div className="hidden md:flex flex-col items-end">
          <span className="text-[9px] text-gray-500 font-mono tracking-widest">TRANSCENDENCE</span>
          <div className="w-32 h-1.5 bg-gray-800 rounded-full mt-1 overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-neon-purple to-neon-blue shadow-[0_0_10px_#a855f7] transition-all duration-1000"
              style={{ width: `${stats.overallProgress}%` }} 
            />
          </div>
        </div>

        {/* Sync Button */}
        <button 
          onClick={onOpenSync}
          className="flex items-center gap-2 bg-gradient-to-r from-neon-blue/10 to-neon-purple/10 hover:from-neon-blue/20 hover:to-neon-purple/20 border border-white/10 hover:border-white/30 px-4 py-2 rounded-lg text-[10px] font-mono font-bold text-white transition-all shadow-[0_0_10px_rgba(59,130,246,0.1)] hover:shadow-[0_0_15px_rgba(59,130,246,0.3)]"
        >
          <svg className="w-3.5 h-3.5 text-neon-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          SYNC
        </button>
      </div>
    </header>
  );
};

// ─────────────────────────────────────────────────────────────────
// TAB NAVIGATION
// ─────────────────────────────────────────────────────────────────

const TabNav: React.FC = () => {
  const { activeTab, setActiveTab, tasks, challenges } = useNexusStore();

  const tabs = [
    { id: 'TASKS' as const, label: 'daily_protocol.exe', icon: '📋', color: 'neon-green', count: tasks.filter(t => !t.isCompleted && t.type === 'TODAY').length },
    { id: 'ROADMAP' as const, label: 'vision_matrix.db', icon: '🗺️', color: 'neon-blue', count: null },
    { id: 'CHALLENGES' as const, label: 'anomalies.log', icon: '⚠️', color: 'neon-red', count: challenges.filter(c => c.status === 'OPEN').length },
    { id: 'NOTES' as const, label: 'research.md', icon: '📝', color: 'neon-purple', count: null },
  ];

  return (
    <div className="flex border-b border-white/5 bg-black/20">
      {tabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => setActiveTab(tab.id)}
          className={`relative px-6 py-3.5 text-xs font-bold font-mono tracking-wider transition-all border-b-2 flex items-center gap-2 ${
            activeTab === tab.id 
              ? `border-${tab.color} text-white bg-white/5` 
              : 'border-transparent text-gray-600 hover:text-gray-300'
          }`}
        >
          <span>{tab.icon}</span>
          <span>{tab.label}</span>
          {tab.count !== null && tab.count > 0 && (
            <span className={`px-1.5 py-0.5 text-[9px] rounded ${
              activeTab === tab.id ? `bg-${tab.color}/20 text-${tab.color}` : 'bg-white/10 text-gray-500'
            }`}>
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────
// MAIN APP
// ─────────────────────────────────────────────────────────────────

function App() {
  const [isSyncOpen, setIsSyncOpen] = useState(false);
  const [autoLoadAttempted, setAutoLoadAttempted] = useState(false);
  const { activeTab, loadState } = useNexusStore();

  // AUTO-LOAD: Try to load from local file on startup
  useEffect(() => {
    if (autoLoadAttempted) return;
    setAutoLoadAttempted(true);
    
    const autoLoad = async () => {
      try {
        // Try to fetch from local data folder
        const response = await fetch('/data/ak-flow-state.json');
        if (response.ok) {
          const state = await response.json();
          console.log('[App] Auto-loaded state from /data/ak-flow-state.json');
          loadState(state);
        }
      } catch (error) {
        console.log('[App] No auto-load file found, waiting for manual sync');
      }
    };
    
    autoLoad();
  }, [autoLoadAttempted, loadState]);

  // Setup file watcher callback
  useEffect(() => {
    fileService.configure({
      onExternalChange: (state) => {
        console.log('[App] External change detected, reloading state');
        loadState(state);
      },
      onError: (error) => {
        console.error('[App] File service error:', error);
      }
    });

    // Keyboard shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + S = Save
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        useNexusStore.getState().saveToFile();
      }
      // Ctrl/Cmd + O = Open
      if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
        e.preventDefault();
        setIsSyncOpen(true);
      }
      // Ctrl/Cmd + Z = Undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        useNexusStore.getState().undo();
      }
      // Ctrl/Cmd + Shift + Z = Redo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) {
        e.preventDefault();
        useNexusStore.getState().redo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [loadState]);

  return (
    <div className="h-screen bg-[#050505] text-gray-300 font-sans selection:bg-neon-purple selection:text-white flex flex-col overflow-hidden">
      
      {/* Header */}
      <Header onOpenSync={() => setIsSyncOpen(true)} />

      {/* Main Workspace */}
      <div className="flex-1 flex flex-col min-h-0">
        
        {/* Tab Navigation */}
        <TabNav />

        {/* Content Area */}
        <div className="flex-1 p-6 overflow-hidden bg-[#09090b]">
          <div className="h-full max-w-7xl mx-auto">
            {activeTab === 'TASKS' && <TaskBoard />}
            {activeTab === 'ROADMAP' && <RoadmapView />}
            {activeTab === 'CHALLENGES' && <ChallengesView />}
            {activeTab === 'NOTES' && <NotesView />}
          </div>
        </div>
      </div>

      {/* Status Bar */}
      <StatusBar />

      {/* Modals & Overlays */}
      <CommandPalette />
      <DetailModal />
      <SyncPanel isOpen={isSyncOpen} onClose={() => setIsSyncOpen(false)} />
    </div>
  );
}

export default App;
