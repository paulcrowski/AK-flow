import React, { useMemo } from 'react';
import { useNexusStore } from '../stores/nexusStore';

type TimelineKind = 'TASK' | 'ROADMAP' | 'CHALLENGE' | 'NOTE';

type TimelineEntry = {
  id: string;
  kind: TimelineKind;
  title: string;
  timestamp: string;
  secondary?: string;
  modalType: 'TASK' | 'ROADMAP' | 'CHALLENGE' | 'NOTE';
  item: any;
};

const kindConfig: Record<TimelineKind, { label: string; color: string; bg: string }> = {
  TASK: { label: 'TASK', color: 'text-neon-green', bg: 'bg-neon-green/10' },
  ROADMAP: { label: 'ROADMAP', color: 'text-neon-blue', bg: 'bg-neon-blue/10' },
  CHALLENGE: { label: 'CHALLENGE', color: 'text-neon-red', bg: 'bg-neon-red/10' },
  NOTE: { label: 'NOTE', color: 'text-neon-purple', bg: 'bg-neon-purple/10' }
};

const safeTs = (t: any): string => {
  const v = typeof t === 'string' ? t : '';
  const d = new Date(v);
  if (!Number.isFinite(d.getTime())) return new Date().toISOString();
  return v;
};

export const TimelineView: React.FC = () => {
  const { tasks, roadmap, challenges, notes, setSelectedItem } = useNexusStore();

  const entries = useMemo<TimelineEntry[]>(() => {
    const list: TimelineEntry[] = [];

    for (const t of tasks) {
      const ts = safeTs(t.updatedAt || t.createdAt);
      list.push({
        id: `TASK:${t.id}:${ts}`,
        kind: 'TASK',
        title: t.content,
        timestamp: ts,
        secondary: t.isCompleted ? 'DONE' : t.type,
        modalType: 'TASK',
        item: t
      });
    }

    for (const r of roadmap) {
      const ts = safeTs(r.updatedAt || r.createdAt);
      list.push({
        id: `ROADMAP:${r.id}:${ts}`,
        kind: 'ROADMAP',
        title: r.title,
        timestamp: ts,
        secondary: r.status,
        modalType: 'ROADMAP',
        item: r
      });
    }

    for (const c of challenges) {
      const ts = safeTs(c.updatedAt || c.createdAt);
      list.push({
        id: `CHALLENGE:${c.id}:${ts}`,
        kind: 'CHALLENGE',
        title: c.title,
        timestamp: ts,
        secondary: `${c.severity} / ${c.status}`,
        modalType: 'CHALLENGE',
        item: c
      });
    }

    for (const n of notes) {
      const ts = safeTs(n.updatedAt || n.createdAt);
      list.push({
        id: `NOTE:${n.id}:${ts}`,
        kind: 'NOTE',
        title: n.title,
        timestamp: ts,
        secondary: n.category,
        modalType: 'NOTE',
        item: n
      });
    }

    return list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [tasks, roadmap, challenges, notes]);

  return (
    <div className="h-full flex flex-col">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Timeline</h2>
          <div className="text-sm text-gray-500 mt-1">Chronologia zmian i zdarzeń (read-only)</div>
        </div>
        <div className="text-xs font-mono text-gray-500">{entries.length} entries</div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="space-y-2">
          {entries.map((e) => {
            const cfg = kindConfig[e.kind];
            return (
              <button
                key={e.id}
                onClick={() => setSelectedItem(e.item, e.modalType)}
                className="w-full text-left group p-4 rounded-xl bg-panel/40 border border-white/5 hover:border-white/10 hover:bg-panel/60 transition-all"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-0.5 text-[10px] font-mono font-bold rounded ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>
                      {e.secondary && (
                        <span className="text-[10px] font-mono text-gray-500">{e.secondary}</span>
                      )}
                    </div>
                    <div className="text-sm font-semibold text-white truncate">{e.title}</div>
                  </div>
                  <div className="text-[10px] font-mono text-gray-500 shrink-0">
                    {new Date(e.timestamp).toLocaleString()}
                  </div>
                </div>
              </button>
            );
          })}

          {entries.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center opacity-30 py-16">
              <div className="text-xs font-mono uppercase tracking-widest">No timeline data</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
