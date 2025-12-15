// ═══════════════════════════════════════════════════════════════
// COMMAND PALETTE - Quick Actions (Ctrl+K)
// ═══════════════════════════════════════════════════════════════

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNexusStore } from '../stores/nexusStore';
import { Priority, Status, Tier } from '../types';

interface CommandItem {
  id: string;
  title: string;
  subtitle?: string;
  shortcut?: string;
  category: 'navigation' | 'action' | 'create' | 'filter' | 'file';
  icon: string;
  action: () => void;
}

export const CommandPalette: React.FC = () => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  
  const {
    isCommandPaletteOpen,
    toggleCommandPalette,
    setActiveTab,
    addTask,
    addChallenge,
    addNote,
    openFile,
    exportState,
    saveToFile,
    setFilterPriority,
    setFilterStatus
  } = useNexusStore();

  const commands: CommandItem[] = useMemo(() => [
    // Navigation
    { id: 'nav-tasks', title: 'Go to Tasks', subtitle: 'View daily tasks', shortcut: 'G T', category: 'navigation', icon: '📋', action: () => setActiveTab('TASKS') },
    { id: 'nav-roadmap', title: 'Go to Roadmap', subtitle: 'View vision matrix', shortcut: 'G R', category: 'navigation', icon: '🗺️', action: () => setActiveTab('ROADMAP') },
    { id: 'nav-challenges', title: 'Go to Challenges', subtitle: 'View anomalies', shortcut: 'G C', category: 'navigation', icon: '⚠️', action: () => setActiveTab('CHALLENGES') },
    { id: 'nav-notes', title: 'Go to Notes', subtitle: 'View research notes', shortcut: 'G N', category: 'navigation', icon: '📝', action: () => setActiveTab('NOTES') },
    
    // Create
    { id: 'create-task', title: 'New Task', subtitle: 'Add task for today', shortcut: 'N T', category: 'create', icon: '➕', action: () => { addTask({ content: 'New Task', type: 'TODAY' }); setActiveTab('TASKS'); } },
    { id: 'create-tomorrow', title: 'New Task (Tomorrow)', subtitle: 'Add task for tomorrow', category: 'create', icon: '📅', action: () => { addTask({ content: 'New Task', type: 'TOMORROW' }); setActiveTab('TASKS'); } },
    { id: 'create-challenge', title: 'New Challenge', subtitle: 'Report an anomaly', category: 'create', icon: '🚨', action: () => { addChallenge({ title: 'New Challenge' }); setActiveTab('CHALLENGES'); } },
    { id: 'create-note', title: 'New Note', subtitle: 'Quick capture', shortcut: 'N N', category: 'create', icon: '💡', action: () => { addNote({ title: 'New Note' }); setActiveTab('NOTES'); } },
    
    // File Operations
    { id: 'file-open', title: 'Open State File', subtitle: 'Load JSON from disk', shortcut: '⌘ O', category: 'file', icon: '📂', action: () => openFile() },
    { id: 'file-save', title: 'Save Now', subtitle: 'Force save to file', shortcut: '⌘ S', category: 'file', icon: '💾', action: () => saveToFile() },
    { id: 'file-export', title: 'Export State', subtitle: 'Download JSON', shortcut: '⌘ E', category: 'file', icon: '📤', action: () => exportState() },
    
    // Filters
    { id: 'filter-high', title: 'Filter: High Priority', subtitle: 'Show only high priority', category: 'filter', icon: '🔴', action: () => setFilterPriority(Priority.HIGH) },
    { id: 'filter-critical', title: 'Filter: Critical', subtitle: 'Show critical items', category: 'filter', icon: '🔥', action: () => setFilterPriority(Priority.CRITICAL) },
    { id: 'filter-clear', title: 'Clear Filters', subtitle: 'Show all items', category: 'filter', icon: '✨', action: () => { setFilterPriority('ALL'); setFilterStatus('ALL'); } },
    { id: 'filter-blocked', title: 'Filter: Blocked', subtitle: 'Show blocked items', category: 'filter', icon: '🚫', action: () => setFilterStatus(Status.BLOCKED) },
  ], [setActiveTab, addTask, addChallenge, addNote, openFile, exportState, saveToFile, setFilterPriority, setFilterStatus]);

  const filteredCommands = useMemo(() => {
    if (!query) return commands;
    const q = query.toLowerCase();
    return commands.filter(cmd => 
      cmd.title.toLowerCase().includes(q) ||
      cmd.subtitle?.toLowerCase().includes(q) ||
      cmd.category.includes(q)
    );
  }, [commands, query]);

  useEffect(() => {
    if (isCommandPaletteOpen) {
      inputRef.current?.focus();
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isCommandPaletteOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Open with Ctrl+K or Cmd+K
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        toggleCommandPalette();
        return;
      }

      if (!isCommandPaletteOpen) return;

      if (e.key === 'Escape') {
        toggleCommandPalette();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(i => Math.min(i + 1, filteredCommands.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(i => Math.max(i - 1, 0));
      } else if (e.key === 'Enter' && filteredCommands[selectedIndex]) {
        e.preventDefault();
        filteredCommands[selectedIndex].action();
        toggleCommandPalette();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCommandPaletteOpen, toggleCommandPalette, filteredCommands, selectedIndex]);

  if (!isCommandPaletteOpen) return null;

  const categoryLabels: Record<string, string> = {
    navigation: 'NAVIGATION',
    create: 'CREATE',
    file: 'FILE',
    filter: 'FILTERS',
    action: 'ACTIONS'
  };

  // Group by category
  const groupedCommands = filteredCommands.reduce((acc, cmd) => {
    if (!acc[cmd.category]) acc[cmd.category] = [];
    acc[cmd.category].push(cmd);
    return acc;
  }, {} as Record<string, CommandItem[]>);

  return (
    <div 
      className="fixed inset-0 z-[999] flex items-start justify-center pt-[15vh] bg-black/80 backdrop-blur-sm animate-fade-in"
      onClick={() => toggleCommandPalette()}
    >
      <div 
        className="w-full max-w-xl bg-[#0a0a0a] border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Search Input */}
        <div className="flex items-center gap-3 px-4 py-4 border-b border-white/10">
          <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            placeholder="Type a command or search..."
            value={query}
            onChange={e => { setQuery(e.target.value); setSelectedIndex(0); }}
            className="flex-1 bg-transparent text-white text-lg placeholder-gray-600 focus:outline-none"
          />
          <kbd className="px-2 py-1 text-xs font-mono text-gray-500 bg-white/5 rounded border border-white/10">
            ESC
          </kbd>
        </div>

        {/* Commands List */}
        <div className="max-h-[50vh] overflow-y-auto custom-scrollbar py-2">
          {Object.entries(groupedCommands).map(([category, cmds]) => (
            <div key={category}>
              <div className="px-4 py-2 text-[10px] font-bold font-mono text-gray-600 tracking-widest">
                {categoryLabels[category] || category.toUpperCase()}
              </div>
              {cmds.map((cmd, idx) => {
                const globalIdx = filteredCommands.indexOf(cmd);
                const isSelected = globalIdx === selectedIndex;
                
                return (
                  <button
                    key={cmd.id}
                    onClick={() => { cmd.action(); toggleCommandPalette(); }}
                    onMouseEnter={() => setSelectedIndex(globalIdx)}
                    className={`w-full px-4 py-3 flex items-center gap-3 transition-colors ${
                      isSelected 
                        ? 'bg-neon-purple/20 border-l-2 border-neon-purple' 
                        : 'border-l-2 border-transparent hover:bg-white/5'
                    }`}
                  >
                    <span className="text-xl">{cmd.icon}</span>
                    <div className="flex-1 text-left">
                      <div className={`font-medium ${isSelected ? 'text-white' : 'text-gray-300'}`}>
                        {cmd.title}
                      </div>
                      {cmd.subtitle && (
                        <div className="text-xs text-gray-500">{cmd.subtitle}</div>
                      )}
                    </div>
                    {cmd.shortcut && (
                      <kbd className="px-2 py-1 text-xs font-mono text-gray-500 bg-white/5 rounded">
                        {cmd.shortcut}
                      </kbd>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
          
          {filteredCommands.length === 0 && (
            <div className="px-4 py-8 text-center text-gray-500">
              No commands found for "{query}"
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-white/10 bg-black/50 flex items-center justify-between text-xs text-gray-600">
          <span>↑↓ navigate</span>
          <span>↵ select</span>
          <span className="text-neon-purple font-mono">AK-FLOW NEXUS v13</span>
        </div>
      </div>
    </div>
  );
};
