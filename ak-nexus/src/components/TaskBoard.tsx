// ═══════════════════════════════════════════════════════════════
// TASK BOARD - Daily Protocol Interface
// Features: Drag & Drop, Quick Add, Focus Mode
// ═══════════════════════════════════════════════════════════════

import React, { useState, useRef } from 'react';
import { useNexusStore } from '../stores/nexusStore';
import { DailyTask, Priority } from '../types';

// ─────────────────────────────────────────────────────────────────
// TASK CARD COMPONENT
// ─────────────────────────────────────────────────────────────────

interface TaskCardProps {
  task: DailyTask;
  onToggle: () => void;
  onDelete: () => void;
  onEdit: () => void;
  isDragging?: boolean;
}

const TaskCard: React.FC<TaskCardProps> = ({ task, onToggle, onDelete, onEdit, isDragging }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showCopied, setShowCopied] = useState(false);

  const priorityConfig = {
    [Priority.CRITICAL]: { text: 'CRIT', class: 'text-red-500 bg-red-500/10 border-red-500/50' },
    [Priority.HIGH]: { text: 'HIGH', class: 'text-orange-500 bg-orange-500/10 border-orange-500/50' },
    [Priority.MEDIUM]: { text: 'MED', class: 'text-yellow-500 bg-yellow-500/10 border-yellow-500/50' },
    [Priority.LOW]: { text: 'LOW', class: 'text-gray-400 bg-gray-500/10 border-gray-500/50' }
  };

  const pConfig = priorityConfig[task.priority];

  // Copy task for AI
  const copyForAI = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    const subtaskText = task.subtasks?.length
      ? `\n\nSubtasks:\n${task.subtasks.map(s => `- [${s.isCompleted ? 'x' : ' '}] ${s.content}`).join('\n')}`
      : '';
    const detailsText = task.details ? `\n\nDetails: ${task.details}` : '';
    const text = `## Task: ${task.content}\n\n**Priority:** ${task.priority}\n**Type:** ${task.type}${task.context ? `\n**Context:** ${task.context}` : ''}${detailsText}${subtaskText}\n\n---\nPaste this to AI for context.`;

    try {
      await navigator.clipboard.writeText(text);
      setShowCopied(true);
      setTimeout(() => setShowCopied(false), 2000);
    } catch (err) {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setShowCopied(true);
      setTimeout(() => setShowCopied(false), 2000);
    }
  };

  return (
    <div
      className={`group relative p-5 rounded-xl border border-white/5 transition-all duration-200 bg-[#111] hover:bg-[#161616] cursor-pointer ${task.isCompleted ? 'opacity-40 grayscale' : ''
        } ${isDragging ? 'scale-105 shadow-2xl z-10' : 'hover:border-white/10'
        } ${isExpanded ? 'ring-1 ring-neon-purple/50' : ''
        }`}
      onClick={() => setIsExpanded(!isExpanded)}
    >
      <div className="flex items-start gap-4">
        {/* Checkbox */}
        <button
          onClick={onToggle}
          className={`mt-1.5 w-6 h-6 rounded border transition-all flex items-center justify-center ${task.isCompleted
            ? 'bg-neon-green/80 border-neon-green'
            : 'border-white/20 hover:border-white/40 bg-transparent'
            }`}
        >
          {task.isCompleted && (
            <svg className="w-4 h-4 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          )}
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0 py-1">
          <div className="flex items-center gap-2 mb-2">
            <h4 className={`font-semibold text-lg leading-snug ${task.isCompleted ? 'text-gray-500 line-through' : 'text-gray-100'}`}>
              {task.content}
            </h4>
          </div>

          <div className="flex items-center gap-3">
            {/* Priority Badge */}
            <span className={`text-xs font-bold px-2 py-1 rounded border ${pConfig.class}`}>
              {pConfig.text}
            </span>

            {/* Context/Tag */}
            {task.context && (
              <span className="text-xs font-mono text-gray-500">
                [{task.context}]
              </span>
            )}
          </div>

          {task.subtasks && task.subtasks.length > 0 && (
            <div className={`mt-3 pt-2 border-t border-white/5 text-sm font-mono flex items-center gap-2 ${task.isCompleted ? 'text-gray-600' : 'text-gray-500'}`}>
              <span className={task.isCompleted ? 'text-gray-600' : 'text-neon-blue'}>
                {task.subtasks.filter(s => s.isCompleted).length}/{task.subtasks.length}
              </span>
              <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                <div
                  className="h-full bg-neon-blue transition-all"
                  style={{ width: `${(task.subtasks.filter(s => s.isCompleted).length / task.subtasks.length) * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Actions (visible on hover) */}
        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex flex-col gap-1">
          <button onClick={(e) => copyForAI(e)} className="p-1.5 hover:text-neon-green text-gray-500 relative" title="Copy for AI">
            {showCopied ? (
              <svg className="w-5 h-5 text-neon-green" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>
            )}
          </button>
          <button onClick={(e) => { e.stopPropagation(); onEdit(); }} className="p-1.5 hover:text-neon-blue text-gray-500" title="Edit"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg></button>
          <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="p-1.5 hover:text-red-500 text-gray-500" title="Delete"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
        </div>
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="mt-4 pt-4 border-t border-white/10 animate-slide-up">
          {/* Details */}
          {task.details && (
            <p className="text-base text-gray-300 mb-4 leading-relaxed">{task.details}</p>
          )}

          {/* Subtasks with checkboxes */}
          {task.subtasks && task.subtasks.length > 0 && (
            <div className="space-y-3">
              <div className="text-xs font-mono text-gray-500 uppercase tracking-widest">Subtasks</div>
              {task.subtasks.map((subtask, idx) => (
                <div key={subtask.id || idx} className="flex items-center gap-3 text-base">
                  <div className={`w-4 h-4 rounded-sm border ${subtask.isCompleted ? 'bg-neon-green/50 border-neon-green' : 'border-white/20'}`} />
                  <span className={subtask.isCompleted ? 'text-gray-500 line-through' : 'text-gray-300'}>
                    {subtask.content}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Copy Button */}
          <button
            onClick={(e) => copyForAI(e)}
            className="mt-4 w-full py-3 text-sm font-mono font-bold text-neon-green bg-neon-green/10 border border-neon-green/30 rounded-lg hover:bg-neon-green/20 transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>
            {showCopied ? '✓ COPIED TO CLIPBOARD!' : 'COPY FOR AI'}
          </button>
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────
// TASK COLUMN COMPONENT
// ─────────────────────────────────────────────────────────────────

interface TaskColumnProps {
  title: string;
  type: DailyTask['type'];
  tasks: DailyTask[];
  accentColor: string;
  theme: 'red' | 'blue' | 'gray';
  completedCount?: number;
  totalCount?: number;
}

const TaskColumn: React.FC<TaskColumnProps> = ({ title, type, tasks, accentColor, theme, completedCount, totalCount }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [newTaskContent, setNewTaskContent] = useState('');
  const [newTaskDetails, setNewTaskDetails] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<Priority>(Priority.MEDIUM);
  const [newSubtasks, setNewSubtasks] = useState<string[]>([]);
  const [newSubtaskInput, setNewSubtaskInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const { addTask, toggleTask, deleteTask, setSelectedItem } = useNexusStore();

  const cCount = completedCount ?? tasks.filter(t => t.isCompleted).length;
  const tCount = totalCount ?? tasks.length;

  const themeColors = {
    red: 'border-neon-red/20 shadow-[0_0_15px_-5px_var(--neon-red)]',
    blue: 'border-neon-blue/20 shadow-[0_0_15px_-5px_var(--neon-blue)]',
    gray: 'border-white/10'
  };

  const handleAdd = () => {
    if (newTaskContent.trim()) {
      addTask({
        content: newTaskContent.trim(),
        details: newTaskDetails.trim() || undefined,
        type,
        priority: newTaskPriority,
        subtasks: newSubtasks.length > 0
          ? newSubtasks.map((s, i) => ({ id: `sub-${Date.now()}-${i}`, content: s, isCompleted: false }))
          : undefined
      });
      setNewTaskContent('');
      setNewTaskDetails('');
      setNewTaskPriority(Priority.MEDIUM);
      setNewSubtasks([]);
    }
    setIsAdding(false);
  };

  const addSubtask = () => {
    if (newSubtaskInput.trim()) {
      setNewSubtasks([...newSubtasks, newSubtaskInput.trim()]);
      setNewSubtaskInput('');
    }
  };

  const removeSubtask = (index: number) => {
    setNewSubtasks(newSubtasks.filter((_, i) => i !== index));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleAdd();
    if (e.key === 'Escape') { setIsAdding(false); setNewTaskContent(''); }
  };

  return (
    <div className={`flex-1 flex flex-col min-w-[450px] min-h-0 border rounded-2xl bg-black/40 backdrop-blur-sm ${themeColors[theme]}`}>
      {/* Header */}
      <div className="p-5 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-2.5 h-2.5 rounded-full ${theme === 'red' ? 'bg-red-500' : theme === 'blue' ? 'bg-blue-500' : 'bg-gray-500'}`} />
          <h3 className="font-mono font-bold tracking-widest text-base text-gray-200 uppercase">
            {title}
          </h3>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-gray-500 px-2.5 py-1 rounded-full bg-white/5 border border-white/5">
            {cCount}/{tCount}
          </span>
          <button
            onClick={() => { setIsAdding(true); setTimeout(() => inputRef.current?.focus(), 50); }}
            className={`p-2 rounded-md hover:bg-white/10 ${accentColor} transition-colors`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>
      </div>

      {/* Add Task Form */}
      {isAdding && (
        <div className="p-4 pb-0 animate-slide-up">
          <div className="p-4 rounded-lg bg-white/5 border border-white/10 space-y-3">
            {/* Task Title */}
            <input
              ref={inputRef}
              type="text"
              placeholder="Task title..."
              value={newTaskContent}
              onChange={e => setNewTaskContent(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full bg-transparent text-white placeholder-gray-600 text-sm focus:outline-none font-mono font-bold"
            />

            {/* Details */}
            <textarea
              placeholder="Detailed description (optional)..."
              value={newTaskDetails}
              onChange={e => setNewTaskDetails(e.target.value)}
              rows={2}
              className="w-full bg-black/30 text-gray-300 placeholder-gray-600 text-xs focus:outline-none font-mono rounded p-2 border border-white/5 resize-none"
            />

            {/* Priority Select */}
            <div className="flex gap-2">
              {Object.values(Priority).map(p => (
                <button
                  key={p}
                  onClick={() => setNewTaskPriority(p)}
                  className={`px-2 py-1 text-[10px] font-mono font-bold rounded border transition-all ${newTaskPriority === p
                    ? p === Priority.CRITICAL ? 'bg-red-500/30 border-red-500 text-red-400'
                      : p === Priority.HIGH ? 'bg-orange-500/30 border-orange-500 text-orange-400'
                        : p === Priority.MEDIUM ? 'bg-yellow-500/30 border-yellow-500 text-yellow-400'
                          : 'bg-gray-500/30 border-gray-500 text-gray-400'
                    : 'bg-transparent border-white/10 text-gray-500 hover:border-white/30'
                    }`}
                >
                  {p}
                </button>
              ))}
            </div>

            {/* Subtasks */}
            <div className="space-y-2">
              <div className="text-[10px] font-mono text-gray-500 uppercase">Subtasks</div>
              {newSubtasks.map((sub, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-gray-400">
                  <span className="w-2 h-2 rounded-full bg-white/20" />
                  <span className="flex-1">{sub}</span>
                  <button onClick={() => removeSubtask(i)} className="text-red-400 hover:text-red-300">×</button>
                </div>
              ))}
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Add subtask..."
                  value={newSubtaskInput}
                  onChange={e => setNewSubtaskInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addSubtask())}
                  className="flex-1 bg-black/30 text-gray-300 placeholder-gray-600 text-xs focus:outline-none font-mono rounded px-2 py-1 border border-white/5"
                />
                <button onClick={addSubtask} className="px-2 py-1 text-xs font-mono text-neon-blue hover:bg-neon-blue/10 rounded">+</button>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-between items-center pt-2 border-t border-white/5">
              <button onClick={() => setIsAdding(false)} className="text-xs text-gray-500 hover:text-white">Cancel</button>
              <button
                onClick={handleAdd}
                disabled={!newTaskContent.trim()}
                className="px-4 py-1.5 text-xs font-mono font-bold bg-neon-green/20 text-neon-green rounded hover:bg-neon-green/30 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                ADD TASK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tasks List */}
      <div className="flex-1 p-4 space-y-3 overflow-y-auto custom-scrollbar">
        {tasks.map(task => (
          <TaskCard
            key={task.id}
            task={task}
            onToggle={() => toggleTask(task.id)}
            onDelete={() => deleteTask(task.id)}
            onEdit={() => setSelectedItem(task, 'TASK')}
          />
        ))}

        {tasks.length === 0 && !isAdding && (
          <div className="h-full flex flex-col items-center justify-center opacity-20 hover:opacity-40 transition-opacity">
            <div className="text-4xl mb-4 filter grayscale contrast-200">{theme === 'red' ? '🛡️' : '🔭'}</div>
            <div className="text-xs font-mono uppercase tracking-widest">
              {theme === 'red' ? 'No Active Operations' : 'Queue Empty'}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
// ─────────────────────────────────────────────────────────────────
// MAIN TASK BOARD
// ─────────────────────────────────────────────────────────────────

export const TaskBoard: React.FC = () => {
  const { getTasksByType } = useNexusStore();
  const [filter, setFilter] = useState<'ALL' | 'ACTIVE' | 'DONE'>('ALL');

  const rawTodayTasks = getTasksByType('TODAY');
  const rawTomorrowTasks = getTasksByType('TOMORROW');

  // 1. Filter Logic
  const filterTasks = (tasks: DailyTask[]) => {
    if (filter === 'ACTIVE') return tasks.filter(t => !t.isCompleted);
    if (filter === 'DONE') return tasks.filter(t => t.isCompleted);
    return tasks;
  };

  // 2. Sort Logic (Critical > High > Medium > Low, then by timestamp)
  const priorityScore = (p: Priority) => {
    switch (p) {
      case Priority.CRITICAL: return 4;
      case Priority.HIGH: return 3;
      case Priority.MEDIUM: return 2;
      case Priority.LOW: return 1;
      default: return 0;
    }
  };

  const sortTasks = (tasks: DailyTask[]) => {
    return [...tasks].sort((a, b) => {
      // Completed last
      if (a.isCompleted !== b.isCompleted) return a.isCompleted ? 1 : -1;
      // Priority desc
      const scoreA = priorityScore(a.priority);
      const scoreB = priorityScore(b.priority);
      if (scoreA !== scoreB) return scoreB - scoreA;
      // Date asc (older first)
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
  };

  const todayTasks = sortTasks(filterTasks(rawTodayTasks));
  const tomorrowTasks = sortTasks(filterTasks(rawTomorrowTasks));

  // ... (previous code)

  // 3. Smart Suggestion Logic (Focus on Today)
  const getRecommendedTask = () => {
    // Look for Critical/High in Today first
    const critical = rawTodayTasks.find(t => !t.isCompleted && t.priority === Priority.CRITICAL);
    if (critical) return { task: critical, reason: 'CRITICAL OPERATION PENDING' };

    const high = rawTodayTasks.find(t => !t.isCompleted && t.priority === Priority.HIGH);
    if (high) return { task: high, reason: 'HIGH PRIORITY OBJECTIVE' };

    // Then first available
    const first = rawTodayTasks.find(t => !t.isCompleted);
    if (first) return { task: first, reason: 'NEXT IN QUEUE' };

    return null;
  };

  const suggestion = getRecommendedTask();

  // 4. Backlog Logic
  const rawBacklogTasks = getTasksByType('BACKLOG');
  const backlogTasks = sortTasks(filterTasks(rawBacklogTasks));

  return (
    <div className="h-full flex flex-col p-6 w-full max-w-[95%] mx-auto">

      {/* Smart Suggestion Header */}
      {suggestion && (
        <div className="mb-8 w-full bg-gradient-to-r from-neon-green/10 to-emerald-600/10 border border-neon-green/30 rounded-2xl p-6 flex items-center justify-between shadow-[0_0_30px_-5px_rgba(34,197,94,0.15)] animate-pulse-glow">
          <div className="flex items-center gap-6">
            <div className="text-4xl">⚡</div>
            <div>
              <div className="flex items-center gap-3 mb-1">
                <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded bg-neon-green text-black animate-pulse">
                  {'--->>'} TACTICAL PRIORITY
                </span>
                <span className="text-xs text-neon-green font-mono opacity-80">{suggestion.reason}</span>
              </div>
              <h2 className="text-2xl font-bold text-white tracking-tight">{suggestion.task.content}</h2>
              {suggestion.task.details && (
                <p className="text-sm text-gray-400 mt-1 max-w-2xl line-clamp-1">{suggestion.task.details}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Search / Filter Bar */}
      <div className="mb-6 flex items-center justify-between">
        <div className="relative w-full max-w-2xl group">
          {/* Search placeholder */}
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className="h-4 w-4 text-gray-500 group-focus-within:text-neon-purple transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            className="block w-full pl-10 pr-3 py-2.5 border border-white/10 rounded-lg leading-5 bg-[#0a0a0a] text-gray-300 placeholder-gray-600 focus:outline-none focus:border-neon-purple/50 focus:ring-1 focus:ring-neon-purple/50 sm:text-sm font-mono transition-all"
            placeholder="SEARCH PROTOCOLS..."
          />
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setFilter('ALL')}
            className={`px-3 py-1.5 text-xs font-bold rounded border transition-all ${filter === 'ALL'
              ? 'bg-neon-purple text-black border-neon-purple shadow-[0_0_10px_rgba(168,85,247,0.4)]'
              : 'bg-[#111] text-gray-500 border-white/5 hover:text-gray-300'
              }`}
          >
            ALL
          </button>
          <button
            onClick={() => setFilter('ACTIVE')}
            className={`px-3 py-1.5 text-xs font-bold rounded border transition-all ${filter === 'ACTIVE'
              ? 'bg-blue-500/20 text-blue-400 border-blue-500/50'
              : 'bg-[#111] text-gray-500 border-white/5 hover:text-gray-300'
              }`}
          >
            ACTIVE
          </button>
          <button
            onClick={() => setFilter('DONE')}
            className={`px-3 py-1.5 text-xs font-bold rounded border transition-all ${filter === 'DONE'
              ? 'bg-green-500/20 text-green-400 border-green-500/50'
              : 'bg-[#111] text-gray-500 border-white/5 hover:text-gray-300'
              }`}
          >
            DONE
          </button>
        </div>
      </div>

      {/* Main Grid - 3 Columns with specific priorities */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-0 overflow-x-auto">
        <TaskColumn
          title="TACTICAL OPS // TODAY"
          type="TODAY"
          tasks={todayTasks}
          accentColor="text-neon-red"
          theme="red"
          completedCount={rawTodayTasks.filter(t => t.isCompleted).length}
          totalCount={rawTodayTasks.length}
        />
        <TaskColumn
          title="STRATEGIC QUEUE // TOMORROW"
          type="TOMORROW"
          tasks={tomorrowTasks}
          accentColor="text-neon-blue"
          theme="blue"
          completedCount={rawTomorrowTasks.filter(t => t.isCompleted).length}
          totalCount={rawTomorrowTasks.length}
        />
        <TaskColumn
          title="DEPTH ARCHIVE // BACKLOG"
          type="BACKLOG"
          tasks={backlogTasks}
          accentColor="text-gray-400"
          theme="gray"
          completedCount={rawBacklogTasks.filter(t => t.isCompleted).length}
          totalCount={rawBacklogTasks.length}
        />
      </div>
    </div>
  );
};
