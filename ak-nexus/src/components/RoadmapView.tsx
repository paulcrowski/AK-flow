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
      className="group relative bg-panel/50 border border-white/5 rounded-xl p-4 hover:border-white/10 transition-all cursor-pointer"
      onClick={onSelect}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <h4 className="font-medium text-white text-sm leading-tight">{item.title}</h4>
        
        {/* Status Badge with Dropdown */}
        <div className="relative">
          <button
            onClick={(e) => { e.stopPropagation(); setShowStatusMenu(!showStatusMenu); }}
            className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${statusConfig.bgColor} ${statusConfig.color} hover:opacity-80 transition-opacity`}
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
      <p className="text-xs text-gray-500 leading-relaxed mb-3 line-clamp-2">
        {item.description}
      </p>

      {/* Progress Bar */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
          <div 
            className={`h-full transition-all duration-500 ${
              item.completionPercentage >= 100 ? 'bg-neon-green' :
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
}

const TierSection: React.FC<TierSectionProps> = ({ tier, items, isExpanded, onToggle }) => {
  const { setSelectedItem, updateRoadmapStatus, addRoadmapItem } = useNexusStore();
  
  const config = TIER_CONFIG[tier];
  const tierNumber = tier.match(/Tier (\d+)/)?.[1] || '?';
  const tierName = tier.replace(/Tier \d+: /, '');
  
  const completedCount = items.filter(i => i.status === Status.COMPLETED).length;
  const totalProgress = items.length > 0 
    ? Math.round(items.reduce((acc, i) => acc + i.completionPercentage, 0) / items.length)
    : 0;

  return (
    <div className="mb-4">
      {/* Tier Header */}
      <button
        onClick={onToggle}
        className={`w-full flex items-center gap-4 p-4 rounded-xl ${config.bgColor} border border-white/5 hover:border-white/10 transition-all`}
      >
        <span className="text-2xl">{config.icon}</span>
        
        <div className="flex-1 text-left">
          <div className="flex items-baseline gap-2">
            <span className={`text-xs font-mono ${config.color}`}>TIER {tierNumber}</span>
            <h3 className="font-bold text-white">{tierName}</h3>
          </div>
          <p className="text-xs text-gray-400 mt-1 max-w-lg">{config.description}</p>
          <div className="text-[10px] text-gray-500 mt-1">
            {completedCount}/{items.length} features • {totalProgress}% complete
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Mini Progress */}
          <div className="w-24 h-2 bg-gray-800 rounded-full overflow-hidden">
            <div 
              className={`h-full ${config.bgColor.replace('/10', '')}`}
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
        <div className="mt-3 pl-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {items.map(item => (
            <RoadmapCard
              key={item.id}
              item={item}
              onSelect={() => setSelectedItem(item, 'ROADMAP')}
              onStatusChange={(status) => updateRoadmapStatus(item.id, status)}
            />
          ))}
          
          {/* Add New Button */}
          <button
            onClick={() => addRoadmapItem({ tier, title: 'New Feature' })}
            className="min-h-[100px] border-2 border-dashed border-white/10 rounded-xl flex items-center justify-center gap-2 text-gray-600 hover:text-gray-400 hover:border-white/20 transition-all"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span className="text-sm">Add Feature</span>
          </button>
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
  const [expandedTiers, setExpandedTiers] = useState<Set<Tier>>(new Set([Tier.CONSCIOUSNESS, Tier.BEHAVIORS]));

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
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-bold text-white">Vision Matrix</h2>
          <div className="flex items-center gap-2 text-xs font-mono text-gray-500">
            <span className="text-neon-purple font-bold">{stats.overallProgress}%</span>
            <span>to transcendence</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={expandAll} className="px-3 py-1.5 text-xs text-gray-500 hover:text-white bg-white/5 rounded-lg transition-colors">
            Expand All
          </button>
          <button onClick={collapseAll} className="px-3 py-1.5 text-xs text-gray-500 hover:text-white bg-white/5 rounded-lg transition-colors">
            Collapse All
          </button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="mb-6 grid grid-cols-4 gap-3">
        {[
          { label: 'Implemented', value: stats.implemented, color: 'text-neon-green' },
          { label: 'In Progress', value: stats.partial, color: 'text-neon-blue' },
          { label: 'Not Started', value: stats.notImplemented, color: 'text-gray-400' },
          { label: 'Blocked', value: stats.blocked, color: 'text-red-400' },
        ].map(stat => (
          <div key={stat.label} className="bg-panel/50 border border-white/5 rounded-xl p-4 text-center">
            <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
            <div className="text-xs text-gray-500 mt-1">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Tiers List */}
      <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
        {tiersWithItems.map(tier => (
          <TierSection
            key={tier}
            tier={tier}
            items={getRoadmapByTier(tier)}
            isExpanded={expandedTiers.has(tier)}
            onToggle={() => toggleTier(tier)}
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
