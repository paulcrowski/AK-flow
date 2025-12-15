// ═══════════════════════════════════════════════════════════════
// STATUS BAR - Bottom Status & Quick Actions
// ═══════════════════════════════════════════════════════════════

import React from 'react';
import { useNexusStore } from '../stores/nexusStore';
import { fileService } from '../services/fileService';

export const StatusBar: React.FC = () => {
  const { syncStatus, stats, version, lastModified } = useNexusStore();

  const statusColors = {
    SYNCED: 'text-neon-green',
    PENDING: 'text-yellow-400',
    CONFLICT: 'text-orange-400',
    ERROR: 'text-red-400'
  };

  const statusIcons = {
    SYNCED: '●',
    PENDING: '○',
    CONFLICT: '⚠',
    ERROR: '✕'
  };

  return (
    <div className="h-8 border-t border-white/5 bg-black/50 flex items-center justify-between px-4 text-[10px] font-mono text-gray-600">
      <div className="flex items-center gap-4">
        {/* Sync Status */}
        <div className="flex items-center gap-2">
          <span className={statusColors[syncStatus.status]}>
            {statusIcons[syncStatus.status]}
          </span>
          <span>{syncStatus.status}</span>
          {syncStatus.pendingChanges > 0 && (
            <span className="text-yellow-400">({syncStatus.pendingChanges} pending)</span>
          )}
        </div>

        {/* File */}
        {fileService.hasFileAccess() && (
          <span className="text-gray-500">
            📁 {fileService.getFileName() || 'Connected'}
          </span>
        )}

        {/* Watch Mode */}
        {fileService.isWatching() && (
          <span className="text-neon-blue animate-pulse">◉ WATCHING</span>
        )}
      </div>

      <div className="flex items-center gap-4">
        {/* Phase */}
        <span className="text-neon-purple">{stats.currentPhase}</span>
        
        {/* Progress */}
        <span>{stats.overallProgress}% COMPLETE</span>
        
        {/* Version */}
        <span>v{version}</span>

        {/* Last Modified */}
        <span className="text-gray-500">
          {new Date(lastModified).toLocaleTimeString()}
        </span>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// SYNC PANEL - File Operations & AI Protocol
// ═══════════════════════════════════════════════════════════════

import { useState, useRef } from 'react';

interface SyncPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SyncPanel: React.FC<SyncPanelProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'FILES' | 'PROTOCOL'>('FILES');
  const [dragActive, setDragActive] = useState(false);
  const [importStatus, setImportStatus] = useState<'IDLE' | 'SUCCESS' | 'ERROR'>('IDLE');
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { 
    openFile, 
    exportState, 
    saveToFile, 
    loadState,
    stats,
    tasks,
    roadmap,
    challenges
  } = useNexusStore();

  if (!isOpen) return null;

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await processFile(e.dataTransfer.files[0]);
    }
  };

  const processFile = async (file: File) => {
    try {
      const state = await fileService.uploadState(file);
      if (state) {
        loadState(state);
        setImportStatus('SUCCESS');
        setTimeout(() => { setImportStatus('IDLE'); onClose(); }, 1500);
      } else {
        setImportStatus('ERROR');
      }
    } catch {
      setImportStatus('ERROR');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const protocolPrompt = `
# AK-FLOW State Management Protocol

You are the AI architect for AK-FLOW cognitive engine project.
Your job is to manage the project state file: \`ak-flow-state.json\`

## CURRENT STATUS
- Phase: ${stats.currentPhase}
- Progress: ${stats.overallProgress}%
- Tasks: ${tasks.length} (${tasks.filter(t => t.isCompleted).length} completed)
- Features: ${roadmap.length}
- Challenges: ${challenges.filter(c => c.status === 'OPEN').length} open

## JSON STRUCTURE

\`\`\`typescript
{
  "version": "13.0",
  "lastModified": "ISO_DATE",
  "modifiedBy": "AI_WINDSURF",
  "tasks": [
    {
      "id": "task-xxx",
      "content": "Task title",
      "details": "Detailed description",
      "isCompleted": false,
      "type": "TODAY" | "TOMORROW" | "BACKLOG",
      "priority": "CRITICAL" | "HIGH" | "MEDIUM" | "LOW",
      "context": "Optional context",
      "createdAt": "ISO_DATE",
      "updatedAt": "ISO_DATE"
    }
  ],
  "roadmap": [
    {
      "id": "road-xxx",
      "title": "Feature name",
      "description": "Brief description",
      "details": "Detailed implementation notes",
      "status": "COMPLETED" | "IN_PROGRESS" | "PARTIAL" | "BLOCKED" | "NOT_STARTED",
      "tier": "Tier N: Name",
      "completionPercentage": 0-100,
      "createdAt": "ISO_DATE",
      "updatedAt": "ISO_DATE"
    }
  ],
  "challenges": [
    {
      "id": "chal-xxx",
      "title": "Issue title",
      "description": "Problem description",
      "severity": "CRITICAL" | "HIGH" | "MODERATE" | "LOW",
      "status": "OPEN" | "INVESTIGATING" | "RESOLVED",
      "potentialSolution": "How to fix",
      "createdAt": "ISO_DATE",
      "updatedAt": "ISO_DATE"
    }
  ],
  "stats": {
    "currentPhase": "Phase name"
  }
}
\`\`\`

## YOUR INSTRUCTIONS

1. READ the state file I provide
2. ANALYZE codebase changes or my updates
3. UPDATE relevant arrays (tasks, roadmap, challenges)
4. SET "modifiedBy": "AI_WINDSURF"
5. UPDATE "lastModified" timestamp
6. OUTPUT complete valid JSON

## RULES

- PRESERVE existing IDs when updating
- DO NOT delete items unless explicitly requested
- UPDATE completionPercentage when status changes
- ADD new challenges for discovered issues
- MARK tasks complete when code is verified working
`.trim();

  const copyProtocol = () => {
    navigator.clipboard.writeText(protocolPrompt);
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-sm animate-fade-in p-4">
      <div className="w-full max-w-4xl bg-[#050505] border border-white/10 rounded-2xl shadow-2xl overflow-hidden max-h-[85vh] flex flex-col">
        
        {/* Header */}
        <div className="h-14 border-b border-white/10 flex items-center justify-between px-6 bg-gradient-to-r from-neon-blue/5 to-transparent shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 bg-neon-blue rounded-full animate-pulse shadow-[0_0_10px_#3b82f6]" />
            <h2 className="font-mono font-bold text-lg tracking-widest text-white">SYNC MATRIX</h2>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors p-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/10 bg-black/20 shrink-0">
          <button 
            onClick={() => setActiveTab('FILES')}
            className={`flex-1 py-3 text-xs font-mono font-bold tracking-widest transition-colors ${
              activeTab === 'FILES' 
                ? 'bg-white/5 text-neon-blue border-b-2 border-neon-blue' 
                : 'text-gray-600 hover:text-gray-300'
            }`}
          >
            FILE OPERATIONS
          </button>
          <button 
            onClick={() => setActiveTab('PROTOCOL')}
            className={`flex-1 py-3 text-xs font-mono font-bold tracking-widest transition-colors ${
              activeTab === 'PROTOCOL' 
                ? 'bg-white/5 text-neon-green border-b-2 border-neon-green' 
                : 'text-gray-600 hover:text-gray-300'
            }`}
          >
            AI PROTOCOL
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 p-6 overflow-y-auto custom-scrollbar">
          {activeTab === 'FILES' ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Open File */}
              <button
                onClick={async () => { 
                  const success = await openFile();
                  if (success) {
                    fileService.startWatching();
                    onClose();
                  }
                }}
                className="p-6 rounded-xl bg-panel/50 border border-white/5 hover:border-neon-blue/30 transition-all group text-center"
              >
                <div className="w-14 h-14 mx-auto rounded-full bg-neon-blue/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <svg className="w-7 h-7 text-neon-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h3 className="font-bold text-white mb-2">Open & Watch</h3>
                <p className="text-xs text-gray-500">Select JSON file. Auto-sync when Windsurf edits.</p>
              </button>

              {/* Save */}
              <button
                onClick={async () => { await saveToFile(); onClose(); }}
                className="p-6 rounded-xl bg-panel/50 border border-white/5 hover:border-neon-green/30 transition-all group text-center"
              >
                <div className="w-14 h-14 mx-auto rounded-full bg-neon-green/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <svg className="w-7 h-7 text-neon-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                  </svg>
                </div>
                <h3 className="font-bold text-white mb-2">Save Now</h3>
                <p className="text-xs text-gray-500">Force save current state to file.</p>
              </button>

              {/* Export */}
              <button
                onClick={() => { exportState(); }}
                className="p-6 rounded-xl bg-panel/50 border border-white/5 hover:border-neon-purple/30 transition-all group text-center"
              >
                <div className="w-14 h-14 mx-auto rounded-full bg-neon-purple/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <svg className="w-7 h-7 text-neon-purple" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                </div>
                <h3 className="font-bold text-white mb-2">Download</h3>
                <p className="text-xs text-gray-500">Export state as JSON file.</p>
              </button>

              {/* Import Drop Zone */}
              <div 
                className={`md:col-span-3 p-8 border-2 border-dashed rounded-xl transition-all ${
                  dragActive ? 'border-neon-blue bg-neon-blue/10' : 'border-white/10 hover:border-white/20'
                }`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                <input 
                  ref={fileInputRef}
                  type="file" 
                  accept=".json"
                  onChange={handleFileChange}
                  className="hidden"
                />
                
                <div className="text-center">
                  {importStatus === 'IDLE' && (
                    <>
                      <div className="text-4xl mb-4">📥</div>
                      <h3 className="font-bold text-white mb-2">Drop JSON Here</h3>
                      <p className="text-sm text-gray-500 mb-4">Or click to select file</p>
                      <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="px-6 py-2 text-xs font-mono bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors"
                      >
                        SELECT FILE
                      </button>
                    </>
                  )}
                  {importStatus === 'SUCCESS' && (
                    <div className="text-neon-green">
                      <div className="text-4xl mb-4">✓</div>
                      <h3 className="font-bold">SYNC COMPLETE</h3>
                    </div>
                  )}
                  {importStatus === 'ERROR' && (
                    <div className="text-red-400">
                      <div className="text-4xl mb-4">✕</div>
                      <h3 className="font-bold mb-2">INVALID FILE</h3>
                      <button onClick={() => setImportStatus('IDLE')} className="text-xs underline">Try Again</button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col h-full">
              <div className="bg-neon-green/5 border border-neon-green/20 rounded-lg p-4 mb-4">
                <h4 className="text-neon-green text-xs font-bold font-mono mb-2 flex items-center gap-2">
                  <span>📋</span> WINDSURF / CURSOR INTEGRATION
                </h4>
                <p className="text-[11px] text-gray-400 leading-relaxed">
                  Copy this prompt and paste it into your AI IDE. It teaches the AI how to read and update your project state file.
                </p>
              </div>
              
              <div className="flex-1 relative bg-black border border-white/10 rounded-lg overflow-hidden">
                <textarea 
                  readOnly
                  value={protocolPrompt}
                  className="w-full h-full bg-transparent p-4 text-xs font-mono text-gray-300 resize-none focus:outline-none custom-scrollbar"
                />
                <button 
                  onClick={copyProtocol}
                  className="absolute top-3 right-3 flex items-center gap-2 px-3 py-1.5 text-[10px] font-mono font-bold bg-white/10 hover:bg-white/20 text-white rounded border border-white/10 transition-colors"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                  </svg>
                  COPY
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// DETAIL MODAL - Edit Items
// ═══════════════════════════════════════════════════════════════

export const DetailModal: React.FC = () => {
  const { selectedItem, modalType, closeModal, updateTask, updateRoadmapItem, updateChallenge, updateNote, deleteTask, deleteRoadmapItem, deleteChallenge, deleteNote } = useNexusStore();
  const [editedItem, setEditedItem] = useState<any>(null);

  React.useEffect(() => {
    if (selectedItem) {
      setEditedItem({ ...selectedItem });
    }
  }, [selectedItem]);

  if (!selectedItem || !modalType || !editedItem) return null;

  const handleSave = () => {
    switch (modalType) {
      case 'TASK':
        updateTask(editedItem.id, editedItem);
        break;
      case 'ROADMAP':
        updateRoadmapItem(editedItem.id, editedItem);
        break;
      case 'CHALLENGE':
        updateChallenge(editedItem.id, editedItem);
        break;
      case 'NOTE':
        updateNote(editedItem.id, editedItem);
        break;
    }
    closeModal();
  };

  const handleDelete = () => {
    if (!confirm('Delete this item?')) return;
    switch (modalType) {
      case 'TASK': deleteTask(editedItem.id); break;
      case 'ROADMAP': deleteRoadmapItem(editedItem.id); break;
      case 'CHALLENGE': deleteChallenge(editedItem.id); break;
      case 'NOTE': deleteNote(editedItem.id); break;
    }
    closeModal();
  };

  const titleField = modalType === 'TASK' ? 'content' : 'title';

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-sm animate-fade-in p-4">
      <div className="w-full max-w-2xl bg-[#0a0a0a] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="h-14 border-b border-white/10 flex items-center justify-between px-6">
          <h2 className="font-mono font-bold text-sm tracking-widest text-white uppercase">
            Edit {modalType}
          </h2>
          <button onClick={closeModal} className="text-gray-500 hover:text-white transition-colors p-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto custom-scrollbar">
          {/* Title/Content */}
          <div>
            <label className="block text-xs font-mono text-gray-500 mb-2">{titleField.toUpperCase()}</label>
            <input
              type="text"
              value={editedItem[titleField] || ''}
              onChange={(e) => setEditedItem({ ...editedItem, [titleField]: e.target.value })}
              className="w-full px-4 py-3 bg-panel border border-white/10 rounded-lg text-white focus:outline-none focus:border-white/30"
            />
          </div>

          {/* Details */}
          <div>
            <label className="block text-xs font-mono text-gray-500 mb-2">
              {modalType === 'NOTE' ? 'CONTENT' : 'DETAILS'}
            </label>
            <textarea
              value={editedItem[modalType === 'NOTE' ? 'content' : 'details'] || ''}
              onChange={(e) => setEditedItem({ 
                ...editedItem, 
                [modalType === 'NOTE' ? 'content' : 'details']: e.target.value 
              })}
              rows={6}
              className="w-full px-4 py-3 bg-panel border border-white/10 rounded-lg text-white focus:outline-none focus:border-white/30 resize-none font-mono text-sm"
            />
          </div>

          {/* Type-specific fields */}
          {modalType === 'TASK' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-mono text-gray-500 mb-2">TYPE</label>
                <select
                  value={editedItem.type}
                  onChange={(e) => setEditedItem({ ...editedItem, type: e.target.value })}
                  className="w-full px-4 py-3 bg-panel border border-white/10 rounded-lg text-white focus:outline-none"
                >
                  <option value="TODAY">TODAY</option>
                  <option value="TOMORROW">TOMORROW</option>
                  <option value="BACKLOG">BACKLOG</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-mono text-gray-500 mb-2">PRIORITY</label>
                <select
                  value={editedItem.priority}
                  onChange={(e) => setEditedItem({ ...editedItem, priority: e.target.value })}
                  className="w-full px-4 py-3 bg-panel border border-white/10 rounded-lg text-white focus:outline-none"
                >
                  <option value="CRITICAL">CRITICAL</option>
                  <option value="HIGH">HIGH</option>
                  <option value="MEDIUM">MEDIUM</option>
                  <option value="LOW">LOW</option>
                </select>
              </div>
            </div>
          )}

          {modalType === 'ROADMAP' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-mono text-gray-500 mb-2">PROGRESS</label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={editedItem.completionPercentage}
                  onChange={(e) => setEditedItem({ ...editedItem, completionPercentage: parseInt(e.target.value) })}
                  className="w-full"
                />
                <div className="text-center text-sm text-gray-400 mt-1">{editedItem.completionPercentage}%</div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="h-16 border-t border-white/10 flex items-center justify-between px-6 bg-black/30">
          <button
            onClick={handleDelete}
            className="px-4 py-2 text-xs font-mono text-red-400 hover:text-red-300 transition-colors"
          >
            DELETE
          </button>
          <div className="flex gap-3">
            <button
              onClick={closeModal}
              className="px-6 py-2 text-xs font-mono text-gray-400 hover:text-white bg-white/5 rounded-lg transition-colors"
            >
              CANCEL
            </button>
            <button
              onClick={handleSave}
              className="px-6 py-2 text-xs font-mono font-bold text-black bg-neon-green rounded-lg hover:bg-neon-green/90 transition-colors"
            >
              SAVE
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
