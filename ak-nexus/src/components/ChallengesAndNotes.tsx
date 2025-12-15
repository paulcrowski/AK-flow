// ═══════════════════════════════════════════════════════════════
// CHALLENGES VIEW - Anomaly Tracking System
// ═══════════════════════════════════════════════════════════════

import React, { useState } from 'react';
import { useNexusStore } from '../stores/nexusStore';
import { Challenge } from '../types';

const SEVERITY_CONFIG = {
  CRITICAL: { icon: '🔴', color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30' },
  HIGH: { icon: '🟠', color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/30' },
  MODERATE: { icon: '🟡', color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30' },
  LOW: { icon: '🟢', color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/30' },
};

const STATUS_CONFIG = {
  OPEN: { label: 'OPEN', color: 'text-red-400', bg: 'bg-red-500/20' },
  INVESTIGATING: { label: 'INVESTIGATING', color: 'text-yellow-400', bg: 'bg-yellow-500/20' },
  RESOLVED: { label: 'RESOLVED', color: 'text-green-400', bg: 'bg-green-500/20' },
  WONT_FIX: { label: "WON'T FIX", color: 'text-gray-400', bg: 'bg-gray-500/20' },
};

interface ChallengeCardProps {
  challenge: Challenge;
  onSelect: () => void;
  onStatusChange: (status: Challenge['status']) => void;
  onDelete: () => void;
}

const ChallengeCard: React.FC<ChallengeCardProps> = ({ challenge, onSelect, onStatusChange, onDelete }) => {
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const severity = SEVERITY_CONFIG[challenge.severity];
  const status = STATUS_CONFIG[challenge.status];

  return (
    <div 
      className={`group relative p-5 rounded-xl ${severity.bg} border ${severity.border} hover:border-opacity-60 transition-all cursor-pointer`}
      onClick={onSelect}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">{severity.icon}</span>
          <span className={`text-[10px] font-mono font-bold ${severity.color}`}>
            {challenge.severity}
          </span>
        </div>
        {/* Status Badge with Dropdown */}
        <div className="relative">
          <button
            onClick={(e) => { e.stopPropagation(); setShowStatusMenu(!showStatusMenu); }}
            className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${status.bg} ${status.color} hover:opacity-80 transition-opacity`}
          >
            {status.label} ▼
          </button>
          
          {showStatusMenu && (
            <div 
              className="absolute right-0 top-full mt-1 py-1 bg-black border border-white/10 rounded-lg shadow-xl z-50 min-w-[140px]"
              onClick={e => e.stopPropagation()}
            >
              {Object.entries(STATUS_CONFIG).map(([statusKey, config]) => (
                <button
                  key={statusKey}
                  onClick={() => { onStatusChange(statusKey as Challenge['status']); setShowStatusMenu(false); }}
                  className={`w-full px-3 py-1.5 text-left text-xs ${config.color} hover:bg-white/5 transition-colors ${challenge.status === statusKey ? 'bg-white/10' : ''}`}
                >
                  {config.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Title */}
      <h3 className="font-bold text-white mb-2">{challenge.title}</h3>
      
      {/* Description */}
      <p className="text-sm text-gray-400 line-clamp-2 mb-3">{challenge.description}</p>

      {/* Solution Preview */}
      {challenge.potentialSolution && (
        <div className="p-3 rounded-lg bg-black/30 border border-white/5">
          <div className="text-[10px] font-mono text-neon-green mb-1">POTENTIAL SOLUTION</div>
          <p className="text-xs text-gray-500 line-clamp-2">{challenge.potentialSolution}</p>
        </div>
      )}

      {/* Actions */}
      <div className="mt-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="flex-1 py-2 text-xs font-mono text-red-400 bg-red-500/10 rounded-lg hover:bg-red-500/20 transition-colors"
        >
          DELETE
        </button>
      </div>
    </div>
  );
};

export const ChallengesView: React.FC = () => {
  const { challenges, setSelectedItem, updateChallenge, deleteChallenge, addChallenge } = useNexusStore();
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  const filteredChallenges = challenges.filter(c => 
    filterStatus === 'ALL' || c.status === filterStatus
  );

  const openCount = challenges.filter(c => c.status === 'OPEN').length;
  const criticalCount = challenges.filter(c => c.severity === 'CRITICAL' && c.status === 'OPEN').length;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            Anomaly Log
            {criticalCount > 0 && (
              <span className="px-2 py-0.5 text-xs font-mono bg-red-500/20 text-red-400 rounded animate-pulse">
                {criticalCount} CRITICAL
              </span>
            )}
          </h2>
          <div className="text-sm text-gray-500 mt-1">
            {openCount} open issues • {challenges.length} total
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Filter */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 text-xs font-mono bg-panel border border-white/10 rounded-lg text-gray-300 focus:outline-none focus:border-white/30"
          >
            <option value="ALL">ALL STATUS</option>
            <option value="OPEN">OPEN</option>
            <option value="INVESTIGATING">INVESTIGATING</option>
            <option value="RESOLVED">RESOLVED</option>
          </select>

          {/* Add Button */}
          <button
            onClick={() => addChallenge({ title: 'New Challenge', severity: 'MODERATE' })}
            className="flex items-center gap-2 px-4 py-2 text-xs font-mono font-bold text-neon-red bg-neon-red/10 border border-neon-red/30 rounded-lg hover:bg-neon-red/20 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            REPORT ANOMALY
          </button>
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredChallenges.map(challenge => (
            <ChallengeCard
              key={challenge.id}
              challenge={challenge}
              onSelect={() => setSelectedItem(challenge, 'CHALLENGE')}
              onStatusChange={(status) => updateChallenge(challenge.id, { status })}
              onDelete={() => deleteChallenge(challenge.id)}
            />
          ))}
        </div>

        {filteredChallenges.length === 0 && (
          <div className="py-20 text-center">
            <div className="text-6xl mb-4 opacity-30">✅</div>
            <div className="text-lg text-gray-500 mb-2">No anomalies detected</div>
            <div className="text-sm text-gray-600">System operating within parameters</div>
          </div>
        )}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// NOTES VIEW - Research & Ideas Capture
// ═══════════════════════════════════════════════════════════════


const CATEGORY_CONFIG = {
  IDEA: { icon: '💡', color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
  INSIGHT: { icon: '🔮', color: 'text-purple-400', bg: 'bg-purple-500/10' },
  DECISION: { icon: '⚖️', color: 'text-blue-400', bg: 'bg-blue-500/10' },
  RESEARCH: { icon: '📚', color: 'text-green-400', bg: 'bg-green-500/10' },
  QUESTION: { icon: '❓', color: 'text-orange-400', bg: 'bg-orange-500/10' },
};

export const NotesView: React.FC = () => {
  const { notes, setSelectedItem, addNote } = useNexusStore();
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredNotes = notes.filter(n => {
    if (filterCategory !== 'ALL' && n.category !== filterCategory) return false;
    if (searchQuery && !n.title.toLowerCase().includes(searchQuery.toLowerCase()) && 
        !n.content.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Research Notes</h2>
          <div className="text-sm text-gray-500 mt-1">{notes.length} captured thoughts</div>
        </div>

        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative">
            <input
              type="text"
              placeholder="Search notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-48 px-3 py-2 pl-9 text-xs font-mono bg-panel border border-white/10 rounded-lg text-gray-300 placeholder-gray-600 focus:outline-none focus:border-white/30"
            />
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          {/* Filter */}
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-3 py-2 text-xs font-mono bg-panel border border-white/10 rounded-lg text-gray-300 focus:outline-none focus:border-white/30"
          >
            <option value="ALL">ALL TYPES</option>
            {Object.entries(CATEGORY_CONFIG).map(([key, config]) => (
              <option key={key} value={key}>{config.icon} {key}</option>
            ))}
          </select>

          {/* Add Button */}
          <button
            onClick={() => addNote({ title: 'New Note', category: 'IDEA', content: '' })}
            className="flex items-center gap-2 px-4 py-2 text-xs font-mono font-bold text-neon-purple bg-neon-purple/10 border border-neon-purple/30 rounded-lg hover:bg-neon-purple/20 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            CAPTURE THOUGHT
          </button>
        </div>
      </div>

      {/* Notes Grid */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredNotes.map(note => {
            const category = CATEGORY_CONFIG[note.category];
            return (
              <div 
                key={note.id}
                onClick={() => setSelectedItem(note, 'NOTE')}
                className={`group p-4 rounded-xl ${category.bg} border border-white/5 hover:border-white/10 transition-all cursor-pointer`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span>{category.icon}</span>
                  <span className={`text-[10px] font-mono ${category.color}`}>{note.category}</span>
                </div>
                <h3 className="font-bold text-white mb-2">{note.title}</h3>
                <p className="text-sm text-gray-400 line-clamp-3">{note.content}</p>
                {note.tags && note.tags.length > 0 && (
                  <div className="mt-3 flex gap-1 flex-wrap">
                    {note.tags.map(tag => (
                      <span key={tag} className="px-2 py-0.5 text-[9px] font-mono text-gray-500 bg-white/5 rounded">
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
                <div className="mt-3 text-[10px] text-gray-600 font-mono">
                  {new Date(note.updatedAt).toLocaleDateString()}
                </div>
              </div>
            );
          })}
        </div>

        {filteredNotes.length === 0 && (
          <div className="py-20 text-center">
            <div className="text-6xl mb-4 opacity-30">📝</div>
            <div className="text-lg text-gray-500 mb-2">No notes yet</div>
            <div className="text-sm text-gray-600">Capture your first thought</div>
          </div>
        )}
      </div>
    </div>
  );
};
