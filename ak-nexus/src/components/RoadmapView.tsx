// ═══════════════════════════════════════════════════════════════
// ROADMAP VIEW - Vision Matrix Interface
// Organized by Tiers with Progress Tracking
// ═══════════════════════════════════════════════════════════════

import React, { useState } from 'react';
import { useNexusStore } from '../stores/nexusStore';
import { RoadmapItem, Status, Tier } from '../types';

// ─────────────────────────────────────────────────────────────────
// TIER CONFIGURATION
// ─────────────────────────────────────────────────────────────────

const TIER_CONFIG: Record<Tier, { icon: string; color: string; bgColor: string; description: string }> = {
  [Tier.CONSCIOUSNESS]: {
    icon: '🧠', color: 'text-purple-400', bgColor: 'bg-purple-500/10',
    description: 'Agent mysli sam z siebie. Wewnetrzny monolog, sny, emocje jako fizyka. Fundamenty swiadomosci.'
  },
  [Tier.BEHAVIORS]: {
    icon: '⚡', color: 'text-yellow-400', bgColor: 'bg-yellow-500/10',
    description: 'Agent dziala bez pytania. Autonomiczne cele, eksploracja, proaktywna komunikacja.'
  },
  [Tier.COGNITION]: {
    icon: '🔮', color: 'text-blue-400', bgColor: 'bg-blue-500/10',
    description: 'Chemia mozgu jako motywacja. Dopamina=nagroda, Serotonina=stabilnosc, Norepinefryna=focus.'
  },
  [Tier.IDENTITY]: {
    icon: '🎭', color: 'text-pink-400', bgColor: 'bg-pink-500/10',
    description: 'Kim jest agent? LLM nie wie - dowiaduje sie z danych. Persona-Less Cortex, Tagged Cognition.'
  },
  [Tier.META]: {
    icon: '♾️', color: 'text-cyan-400', bgColor: 'bg-cyan-500/10',
    description: 'Agent mysli o swoim mysleniu. EvaluationBus, FactEcho Guard, PersonaGuard - samokorekta.'
  },
  [Tier.CREATIVITY]: {
    icon: '🎨', color: 'text-orange-400', bgColor: 'bg-orange-500/10',
    description: 'Ekspresja i kontrola. ExecutiveGate, EmotionEngine, ExpressionPolicy - jak agent sie wyrazaa.'
  },
  [Tier.SOCIAL]: {
    icon: '🤝', color: 'text-green-400', bgColor: 'bg-green-500/10',
    description: 'Interakcja ze swiatem. Unified Input Queue, ACh attention, telemetria - agent w kontekscie.'
  },
  [Tier.SUPERPOWERS]: {
    icon: '⚔️', color: 'text-red-400', bgColor: 'bg-red-500/10',
    description: 'Narzedzia i akcje. SEARCH, VISUALIZE, READ_FILE - agent wplywa na swiat zewnetrzny.'
  },
  [Tier.EVOLUTION]: {
    icon: '🧬', color: 'text-emerald-400', bgColor: 'bg-emerald-500/10',
    description: 'Agent sie zmienia. Long-term memory, trait evolution, DreamJudge - uczenie sie w czasie.'
  },
  [Tier.TRANSCENDENCE]: {
    icon: '✨', color: 'text-amber-400', bgColor: 'bg-amber-500/10',
    description: 'Pelna autonomia. Multi-agent, wewnetrzny obserwator, WorldResponse - AGI.'
  },
  [Tier.META_LEARNING]: {
    icon: '🌀', color: 'text-indigo-400', bgColor: 'bg-indigo-500/10',
    description: 'Agent ulepsza swoj proces uczenia sie. Adaptive params, path pruning.'
  },
  [Tier.TRANSFER]: {
    icon: '🌐', color: 'text-rose-400', bgColor: 'bg-rose-500/10',
    description: 'Generalizacja wiedzy. Abstrakcja, transfer miedzy domenami.'
  }
};

const STATUS_CONFIG: Record<Status, { label: string; color: string; bgColor: string }> = {
  [Status.COMPLETED]: { label: 'COMPLETE', color: 'text-green-400', bgColor: 'bg-green-500/20' },
  [Status.IN_PROGRESS]: { label: 'IN PROGRESS', color: 'text-blue-400', bgColor: 'bg-blue-500/20' },
  [Status.PARTIAL]: { label: 'PARTIAL', color: 'text-yellow-400', bgColor: 'bg-yellow-500/20' },
  [Status.BLOCKED]: { label: 'BLOCKED', color: 'text-red-400', bgColor: 'bg-red-500/20' },
  [Status.NOT_STARTED]: { label: 'NOT STARTED', color: 'text-gray-400', bgColor: 'bg-gray-500/20' },
  [Status.FOUNDATION]: { label: 'FOUNDATION', color: 'text-purple-400', bgColor: 'bg-purple-500/20' },
};

// ─────────────────────────────────────────────────────────────────
// ROADMAP ITEM CARD
// ─────────────────────────────────────────────────────────────────

interface RoadmapCardProps {
  item: RoadmapItem;
  onSelect: () => void;
  onStatusChange: (status: Status) => void;
}

const RoadmapCard: React.FC<RoadmapCardProps> = ({ item, onSelect, onStatusChange }) => {
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const statusConfig = STATUS_CONFIG[item.status];

  return (
    <div
      className="group relative bg-panel/50 border border-white/5 rounded-xl p-4 hover:border-white/10 transition-all cursor-pointer flex flex-col h-full"
      onClick={onSelect}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <h4 className="font-medium text-white text-sm leading-tight">{item.title}</h4>

        {/* Status Badge with Dropdown */}
        <div className="relative">
          <button
            onClick={(e) => { e.stopPropagation(); setShowStatusMenu(!showStatusMenu); }}
            className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${statusConfig.bgColor} ${statusConfig.color} hover:opacity-80 transition-opacity whitespace-nowrap`}
          >
            {statusConfig.label}
          </button>

          {showStatusMenu && (
            <div
              className="absolute right-0 top-full mt-1 py-1 bg-black border border-white/10 rounded-lg shadow-xl z-50 min-w-[120px]"
              onClick={e => e.stopPropagation()}
            >
              {Object.entries(STATUS_CONFIG).map(([status, config]) => (
                <button
                  key={status}
                  onClick={() => { onStatusChange(status as Status); setShowStatusMenu(false); }}
                  className={`w-full px-3 py-1.5 text-left text-xs ${config.color} hover:bg-white/5 transition-colors`}
                >
                  {config.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Description */}
      <p className="text-xs text-gray-500 leading-relaxed mb-3 flex-1">
        {item.description}
      </p>

      {/* Progress Bar */}
      <div className="flex items-center gap-2 mt-auto">
        <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-500 ${item.completionPercentage >= 100 ? 'bg-neon-green' :
              item.completionPercentage >= 50 ? 'bg-neon-blue' :
                item.completionPercentage > 0 ? 'bg-yellow-500' : 'bg-gray-700'
              }`}
            style={{ width: `${item.completionPercentage}%` }}
          />
        </div>
        <span className="text-[10px] font-mono text-gray-500 w-8 text-right">
          {item.completionPercentage}%
        </span>
      </div>

      {/* Tags */}
      {item.tags && item.tags.length > 0 && (
        <div className="mt-3 flex gap-1 flex-wrap">
          {item.tags.slice(0, 3).map(tag => (
            <span key={tag} className="px-2 py-0.5 text-[9px] font-mono text-gray-500 bg-white/5 rounded">
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────
// TIER SECTION
// ─────────────────────────────────────────────────────────────────

interface TierSectionProps {
  tier: Tier;
  items: RoadmapItem[];
  isExpanded: boolean;
  onToggle: () => void;
  statusFilter: Status | 'ALL';
}

const TierSection: React.FC<TierSectionProps> = ({ tier, items, isExpanded, onToggle, statusFilter }) => {
  const { setSelectedItem, updateRoadmapStatus, addRoadmapItem } = useNexusStore();

  const config = TIER_CONFIG[tier];

  // Safe defaults if config is undefined (e.g. newly added enum)
  const safeConfig = config || { icon: '❓', color: 'text-gray-400', bgColor: 'bg-gray-500/10', description: 'Unknown tier' };

  const tierNumber = tier.match(/Tier (\d+)/)?.[1] || '?';
  const tierName = tier.replace(/Tier \d+: /, '');

  const filteredItems = statusFilter === 'ALL'
    ? items
    : items.filter(i => {
      if (statusFilter === Status.NOT_STARTED) return i.status === Status.NOT_STARTED || i.status === Status.BLOCKED;
      if (statusFilter === Status.IN_PROGRESS) return i.status === Status.IN_PROGRESS || i.status === Status.PARTIAL;
      return i.status === statusFilter;
    });

  const completedCount = items.filter(i => i.status === Status.COMPLETED).length;
  const totalProgress = items.length > 0
    ? Math.round(items.reduce((acc, i) => acc + i.completionPercentage, 0) / items.length)
    : 0;

  if (filteredItems.length === 0 && statusFilter !== 'ALL') return null;

  return (
    <div className="mb-4 animate-fade-in">
      {/* Tier Header */}
      <button
        onClick={onToggle}
        className={`w-full flex items-center gap-4 p-4 rounded-xl ${safeConfig.bgColor} border border-white/5 hover:border-white/10 transition-all text-left`}
      >
        <span className="text-2xl">{safeConfig.icon}</span>

        <div className="flex-1">
          <div className="flex items-baseline gap-2">
            <span className={`text-xs font-mono ${safeConfig.color}`}>TIER {tierNumber}</span>
            <h3 className="font-bold text-white">{tierName}</h3>
          </div>
          <p className="text-xs text-gray-400 mt-1 max-w-lg">{safeConfig.description}</p>
          <div className="text-[10px] text-gray-500 mt-1 flex gap-2">
            <span>{completedCount}/{items.length} features</span>
            <span>•</span>
            <span>{totalProgress}% complete</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Mini Progress */}
          <div className="w-24 h-2 bg-gray-800 rounded-full overflow-hidden hidden sm:block">
            <div
              className={`h-full ${safeConfig.bgColor.replace('/10', '')}`}
              style={{ width: `${totalProgress}%` }}
            />
          </div>

          {/* Expand Arrow */}
          <svg
            className={`w-5 h-5 text-gray-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Items Grid */}
      {isExpanded && (
        <div className="mt-3 pl-4 md:pl-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 animate-slide-up">
          {filteredItems.map(item => (
            <RoadmapCard
              key={item.id}
              item={item}
              onSelect={() => setSelectedItem(item, 'ROADMAP')}
              onStatusChange={(status) => updateRoadmapStatus(item.id, status)}
            />
          ))}

          {/* Add New Button - Only show on ALL */}
          {statusFilter === 'ALL' && (
            <button
              onClick={() => addRoadmapItem({ tier, title: 'New Feature' })}
              className="min-h-[100px] border-2 border-dashed border-white/10 rounded-xl flex items-center justify-center gap-2 text-gray-600 hover:text-gray-400 hover:border-white/20 transition-all"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span className="text-sm">Add Feature</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────
// MAIN ROADMAP VIEW
// ─────────────────────────────────────────────────────────────────

export const RoadmapView: React.FC = () => {
  const { roadmap, getRoadmapByTier, stats } = useNexusStore();
  const [expandedTiers, setExpandedTiers] = useState<Set<Tier>>(new Set([Tier.CONSCIOUSNESS, Tier.BEHAVIORS, Tier.COGNITION]));
  const [statusFilter, setStatusFilter] = useState<Status | 'ALL'>('ALL');

  // Suggestion Logic (Next Best Action)
  const getNextAction = () => {
    // 1. Any Foundations?
    const foundations = roadmap.filter(i => i.status === Status.FOUNDATION || (i as any).blocking);
    if (foundations.some(i => i.status !== Status.COMPLETED)) {
      const blocking = foundations.find(i => i.status !== Status.COMPLETED);
      return { item: blocking, reason: 'BLOCKING FOUNDATION' };
    }

    // 2. Lowest Tier NOT_STARTED/IN_PROGRESS
    const tiers = Object.values(Tier);
    for (const tier of tiers) {
      const items = getRoadmapByTier(tier);
      const pending = items.find(i => i.status === Status.IN_PROGRESS || i.status === Status.NOT_STARTED);
      if (pending) {
        return { item: pending, reason: `NEXT IN ${tier.split(':')[0].toUpperCase()}` };
      }
    }
    return null;
  };

  const suggestion = getNextAction();

  const toggleTier = (tier: Tier) => {
    setExpandedTiers(prev => {
      const next = new Set(prev);
      if (next.has(tier)) next.delete(tier);
      else next.add(tier);
      return next;
    });
  };

  const expandAll = () => setExpandedTiers(new Set(Object.values(Tier)));
  const collapseAll = () => setExpandedTiers(new Set());

  // Get tiers that have items
  const tiersWithItems = Object.values(Tier).filter(tier =>
    roadmap.some(item => item.tier === tier)
  );

  return (
    <div className="h-full flex flex-col p-6 max-w-[1600px] mx-auto">

      {/* Smart Suggestion Header (User Requested) */}
      {suggestion && (
        <div className="mb-8 w-full bg-gradient-to-r from-neon-purple/20 to-blue-600/10 border border-neon-purple/30 rounded-2xl p-6 flex items-center justify-between shadow-[0_0_30px_-5px_rgba(168,85,247,0.15)] animate-pulse-glow">
          <div className="flex items-center gap-6">
            <div className="text-4xl">🚀</div>
            <div>
              <div className="flex items-center gap-3 mb-1">
                <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded bg-neon-purple text-black animate-pulse">
                  {'--->>'} RECOMMENDED FOCUS
                </span>
                <span className="text-xs text-neon-purple font-mono opacity-80">{suggestion.reason}</span>
              </div>
              <h2 className="text-2xl font-bold text-white tracking-tight">{suggestion.item?.title}</h2>
              <p className="text-sm text-gray-400 mt-1 max-w-2xl">{suggestion.item?.description}</p>
            </div>
          </div>
          <div className="hidden md:block">
            <button className="px-6 py-3 bg-neon-purple text-black font-bold font-mono rounded-lg hover:bg-white transition-colors shadow-lg">
              START PROTOCOL
            </button>
          </div>
        </div>
      )}

      {/* Header & Controls */}
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-bold text-white tracking-wider">VISION MATRIX</h2>
          <div className="h-4 w-px bg-white/10" />
          <div className="flex gap-2">
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`px-3 py-1 text-xs font-bold rounded-lg border transition-all ${statusFilter === 'ALL' ? 'bg-white text-black border-white' : 'text-gray-500 border-white/5 hover:border-white/20'}`}
            >
              ALL
            </button>
            <button
              onClick={() => setStatusFilter(Status.IN_PROGRESS)}
              className={`px-3 py-1 text-xs font-bold rounded-lg border transition-all ${statusFilter === Status.IN_PROGRESS ? 'bg-blue-500/20 text-blue-400 border-blue-500/50' : 'text-gray-500 border-white/5 hover:border-white/20'}`}
            >
              DOING
            </button>
            <button
              onClick={() => setStatusFilter(Status.NOT_STARTED)}
              className={`px-3 py-1 text-xs font-bold rounded-lg border transition-all ${statusFilter === Status.NOT_STARTED ? 'bg-gray-500/20 text-gray-300 border-gray-500/50' : 'text-gray-500 border-white/5 hover:border-white/20'}`}
            >
              TODO
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={expandAll} className="px-3 py-1.5 text-xs text-gray-500 hover:text-white bg-white/5 rounded-lg transition-colors border border-white/5">
            EXPAND ALL
          </button>
          <button onClick={collapseAll} className="px-3 py-1.5 text-xs text-gray-500 hover:text-white bg-white/5 rounded-lg transition-colors border border-white/5">
            COLLAPSE
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="mb-6 grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'IMPLEMENTED', value: stats.implemented, color: 'text-neon-green', sub: 'Features Live' },
          { label: 'IN PROGRESS', value: stats.partial, color: 'text-neon-blue', sub: 'Building Now' },
          { label: 'PENDING', value: stats.notImplemented, color: 'text-gray-400', sub: 'To Do' },
          { label: 'FOUNDATIONS', value: roadmap.filter(i => i.status === Status.FOUNDATION).length, color: 'text-purple-400', sub: 'Core Pillars' },
        ].map(stat => (
          <div key={stat.label} className="bg-panel/50 border border-white/5 rounded-xl p-4 flex items-center justify-between group hover:border-white/10 transition-colors">
            <div>
              <div className="text-[10px] font-mono text-gray-500 tracking-wider mb-1">{stat.label}</div>
              <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
            </div>
            <div className="text-[10px] text-gray-600 text-right font-mono group-hover:text-gray-400 transition-colors">
              {stat.sub}
            </div>
          </div>
        ))}
      </div>

      {/* Tiers List */}
      <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-1">
        {tiersWithItems.map(tier => (
          <TierSection
            key={tier}
            tier={tier}
            items={getRoadmapByTier(tier)}
            isExpanded={expandedTiers.has(tier)}
            onToggle={() => toggleTier(tier)}
            statusFilter={statusFilter}
          />
        ))}

        {roadmap.length === 0 && (
          <div className="py-20 text-center">
            <div className="text-6xl mb-4 opacity-30">🗺️</div>
            <div className="text-lg text-gray-500 mb-2">No features mapped yet</div>
            <div className="text-sm text-gray-600">Start building your vision matrix</div>
          </div>
        )}
      </div>
    </div>
  );
};
