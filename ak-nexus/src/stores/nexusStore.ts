// ═══════════════════════════════════════════════════════════════
// ZUSTAND STORE - Central State Management
// Supports: Undo/Redo, File Sync, AI Actions
// ═══════════════════════════════════════════════════════════════

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { 
  ProjectState, DailyTask, RoadmapItem, Challenge, Note,
  Status, Priority, Tier, ProjectStats, SyncStatus, AIAction
} from '../types';
import { fileService, historyService } from '../services/fileService';

// ─────────────────────────────────────────────────────────────────
// STORE TYPES
// ─────────────────────────────────────────────────────────────────

interface NexusStore extends ProjectState {
  // UI State
  activeTab: 'TASKS' | 'ROADMAP' | 'CHALLENGES' | 'NOTES';
  isLoading: boolean;
  syncStatus: SyncStatus;
  selectedItem: any | null;
  modalType: 'TASK' | 'ROADMAP' | 'CHALLENGE' | 'NOTE' | null;
  isCommandPaletteOpen: boolean;
  searchQuery: string;
  filterPriority: Priority | 'ALL';
  filterStatus: Status | 'ALL';
  focusedTaskId: string | null;

  // Actions - Tasks
  addTask: (task: Partial<DailyTask>) => void;
  updateTask: (id: string, updates: Partial<DailyTask>) => void;
  deleteTask: (id: string) => void;
  toggleTask: (id: string) => void;
  moveTask: (id: string, type: DailyTask['type']) => void;
  reorderTasks: (taskIds: string[]) => void;

  // Actions - Roadmap
  addRoadmapItem: (item: Partial<RoadmapItem>) => void;
  updateRoadmapItem: (id: string, updates: Partial<RoadmapItem>) => void;
  deleteRoadmapItem: (id: string) => void;
  updateRoadmapStatus: (id: string, status: Status, percentage?: number) => void;

  // Actions - Challenges
  addChallenge: (challenge: Partial<Challenge>) => void;
  updateChallenge: (id: string, updates: Partial<Challenge>) => void;
  deleteChallenge: (id: string) => void;
  resolveChallenge: (id: string, solution?: string) => void;

  // Actions - Notes
  addNote: (note: Partial<Note>) => void;
  updateNote: (id: string, updates: Partial<Note>) => void;
  deleteNote: (id: string) => void;

  // Actions - State
  setActiveTab: (tab: NexusStore['activeTab']) => void;
  setSelectedItem: (item: any, type: NexusStore['modalType']) => void;
  closeModal: () => void;
  toggleCommandPalette: () => void;
  setSearchQuery: (query: string) => void;
  setFilterPriority: (priority: Priority | 'ALL') => void;
  setFilterStatus: (status: Status | 'ALL') => void;
  setFocusedTask: (id: string | null) => void;
  updatePhase: (phase: string) => void;

  // Actions - File Operations
  loadState: (state: ProjectState) => void;
  saveToFile: () => Promise<boolean>;
  openFile: () => Promise<boolean>;
  exportState: () => void;
  
  // Actions - AI Integration
  executeAIActions: (actions: AIAction[]) => void;
  
  // Actions - History
  undo: () => void;
  redo: () => void;

  // Computed
  getFilteredTasks: () => DailyTask[];
  getTasksByType: (type: DailyTask['type']) => DailyTask[];
  getRoadmapByTier: (tier: Tier) => RoadmapItem[];
  recalculateStats: () => void;
}

// ─────────────────────────────────────────────────────────────────
// HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────────

const generateId = (prefix: string) => 
  `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

const now = () => new Date().toISOString();

// ─────────────────────────────────────────────────────────────────
// STORE IMPLEMENTATION
// ─────────────────────────────────────────────────────────────────

export const useNexusStore = create<NexusStore>()(
  subscribeWithSelector((set, get) => ({
    // ═══════════════════════════════════════════════════════════
    // INITIAL STATE
    // ═══════════════════════════════════════════════════════════
    
    version: '13.0',
    lastModified: now(),
    modifiedBy: 'USER',
    tasks: [],
    roadmap: [],
    challenges: [],
    notes: [],
    stats: {
      totalFeatures: 0,
      implemented: 0,
      partial: 0,
      notImplemented: 0,
      blocked: 0,
      overallProgress: 0,
      currentPhase: 'INITIALIZATION',
      lastSync: now(),
      todayCompleted: 0,
      streak: 0
    },
    settings: {
      theme: 'cyberpunk',
      autoSaveInterval: 2000,
      fileWatchEnabled: true,
      showCompletedTasks: true,
      compactMode: false,
      soundEnabled: true
    },
    
    // UI State
    activeTab: 'TASKS',
    isLoading: false,
    syncStatus: { status: 'SYNCED', lastSync: now(), pendingChanges: 0 },
    selectedItem: null,
    modalType: null,
    isCommandPaletteOpen: false,
    searchQuery: '',
    filterPriority: 'ALL',
    filterStatus: 'ALL',
    focusedTaskId: null,

    // ═══════════════════════════════════════════════════════════
    // TASK ACTIONS
    // ═══════════════════════════════════════════════════════════

    addTask: (taskData) => {
      const task: DailyTask = {
        id: generateId('task'),
        content: taskData.content || 'New Task',
        details: taskData.details || '',
        isCompleted: false,
        type: taskData.type || 'TODAY',
        priority: taskData.priority || Priority.MEDIUM,
        context: taskData.context || '',
        subtasks: taskData.subtasks || [],
        createdAt: now(),
        updatedAt: now(),
        ...taskData
      };

      historyService.addEntry({
        action: 'ADD_TASK',
        entityType: 'TASK',
        entityId: task.id,
        previousValue: null,
        newValue: task,
        source: 'USER'
      });

      set(state => ({
        tasks: [task, ...state.tasks],
        lastModified: now(),
        syncStatus: { ...state.syncStatus, status: 'PENDING', pendingChanges: state.syncStatus.pendingChanges + 1 }
      }));
      
      get().recalculateStats();
    },

    updateTask: (id, updates) => {
      const oldTask = get().tasks.find(t => t.id === id);
      if (!oldTask) return;

      historyService.addEntry({
        action: 'UPDATE_TASK',
        entityType: 'TASK',
        entityId: id,
        previousValue: oldTask,
        newValue: { ...oldTask, ...updates },
        source: 'USER'
      });

      set(state => ({
        tasks: state.tasks.map(t => 
          t.id === id ? { ...t, ...updates, updatedAt: now() } : t
        ),
        lastModified: now(),
        syncStatus: { ...state.syncStatus, status: 'PENDING', pendingChanges: state.syncStatus.pendingChanges + 1 }
      }));
    },

    deleteTask: (id) => {
      const oldTask = get().tasks.find(t => t.id === id);
      if (!oldTask) return;

      historyService.addEntry({
        action: 'DELETE_TASK',
        entityType: 'TASK',
        entityId: id,
        previousValue: oldTask,
        newValue: null,
        source: 'USER'
      });

      set(state => ({
        tasks: state.tasks.filter(t => t.id !== id),
        lastModified: now(),
        syncStatus: { ...state.syncStatus, status: 'PENDING', pendingChanges: state.syncStatus.pendingChanges + 1 }
      }));
      
      get().recalculateStats();
    },

    toggleTask: (id) => {
      const task = get().tasks.find(t => t.id === id);
      if (!task) return;

      const isCompleted = !task.isCompleted;
      
      set(state => ({
        tasks: state.tasks.map(t => 
          t.id === id ? { 
            ...t, 
            isCompleted,
            completedAt: isCompleted ? now() : undefined,
            updatedAt: now() 
          } : t
        ),
        lastModified: now()
      }));
      
      get().recalculateStats();
    },

    moveTask: (id, type) => {
      set(state => ({
        tasks: state.tasks.map(t => 
          t.id === id ? { ...t, type, updatedAt: now() } : t
        ),
        lastModified: now()
      }));
    },

    reorderTasks: (taskIds) => {
      set(state => {
        const orderedTasks = taskIds
          .map(id => state.tasks.find(t => t.id === id))
          .filter(Boolean) as DailyTask[];
        const otherTasks = state.tasks.filter(t => !taskIds.includes(t.id));
        return { tasks: [...orderedTasks, ...otherTasks] };
      });
    },

    // ═══════════════════════════════════════════════════════════
    // ROADMAP ACTIONS
    // ═══════════════════════════════════════════════════════════

    addRoadmapItem: (itemData) => {
      const item: RoadmapItem = {
        id: generateId('road'),
        title: itemData.title || 'New Feature',
        description: itemData.description || '',
        details: itemData.details || '',
        status: itemData.status || Status.NOT_STARTED,
        tier: itemData.tier || Tier.CONSCIOUSNESS,
        completionPercentage: itemData.completionPercentage || 0,
        tags: itemData.tags || [],
        createdAt: now(),
        updatedAt: now(),
        ...itemData
      };

      historyService.addEntry({
        action: 'ADD_ROADMAP',
        entityType: 'ROADMAP',
        entityId: item.id,
        previousValue: null,
        newValue: item,
        source: 'USER'
      });

      set(state => ({
        roadmap: [...state.roadmap, item],
        lastModified: now()
      }));
      
      get().recalculateStats();
    },

    updateRoadmapItem: (id, updates) => {
      const oldItem = get().roadmap.find(r => r.id === id);
      if (!oldItem) return;

      historyService.addEntry({
        action: 'UPDATE_ROADMAP',
        entityType: 'ROADMAP',
        entityId: id,
        previousValue: oldItem,
        newValue: { ...oldItem, ...updates },
        source: 'USER'
      });

      set(state => ({
        roadmap: state.roadmap.map(r => 
          r.id === id ? { ...r, ...updates, updatedAt: now() } : r
        ),
        lastModified: now()
      }));
      
      get().recalculateStats();
    },

    deleteRoadmapItem: (id) => {
      const oldItem = get().roadmap.find(r => r.id === id);
      if (!oldItem) return;

      historyService.addEntry({
        action: 'DELETE_ROADMAP',
        entityType: 'ROADMAP',
        entityId: id,
        previousValue: oldItem,
        newValue: null,
        source: 'USER'
      });

      set(state => ({
        roadmap: state.roadmap.filter(r => r.id !== id),
        lastModified: now()
      }));
      
      get().recalculateStats();
    },

    updateRoadmapStatus: (id, status, percentage) => {
      let pct = percentage;
      if (pct === undefined) {
        if (status === Status.COMPLETED) pct = 100;
        else if (status === Status.NOT_STARTED) pct = 0;
        else if (status === Status.IN_PROGRESS) pct = 25;
        else if (status === Status.PARTIAL) pct = 50;
      }

      get().updateRoadmapItem(id, { status, completionPercentage: pct });
    },

    // ═══════════════════════════════════════════════════════════
    // CHALLENGE ACTIONS
    // ═══════════════════════════════════════════════════════════

    addChallenge: (challengeData) => {
      const challenge: Challenge = {
        id: generateId('chal'),
        title: challengeData.title || 'New Challenge',
        description: challengeData.description || '',
        severity: challengeData.severity || 'MODERATE',
        status: 'OPEN',
        createdAt: now(),
        updatedAt: now(),
        ...challengeData
      };

      historyService.addEntry({
        action: 'ADD_CHALLENGE',
        entityType: 'CHALLENGE',
        entityId: challenge.id,
        previousValue: null,
        newValue: challenge,
        source: 'USER'
      });

      set(state => ({
        challenges: [challenge, ...state.challenges],
        lastModified: now()
      }));
    },

    updateChallenge: (id, updates) => {
      set(state => ({
        challenges: state.challenges.map(c => 
          c.id === id ? { ...c, ...updates, updatedAt: now() } : c
        ),
        lastModified: now()
      }));
    },

    deleteChallenge: (id) => {
      set(state => ({
        challenges: state.challenges.filter(c => c.id !== id),
        lastModified: now()
      }));
    },

    resolveChallenge: (id, solution) => {
      set(state => ({
        challenges: state.challenges.map(c => 
          c.id === id ? { 
            ...c, 
            status: 'RESOLVED',
            potentialSolution: solution || c.potentialSolution,
            resolvedAt: now(),
            updatedAt: now() 
          } : c
        ),
        lastModified: now()
      }));
    },

    // ═══════════════════════════════════════════════════════════
    // NOTE ACTIONS
    // ═══════════════════════════════════════════════════════════

    addNote: (noteData) => {
      const note: Note = {
        id: generateId('note'),
        title: noteData.title || 'New Note',
        content: noteData.content || '',
        category: noteData.category || 'IDEA',
        tags: noteData.tags || [],
        createdAt: now(),
        updatedAt: now(),
        ...noteData
      };

      set(state => ({
        notes: [note, ...state.notes],
        lastModified: now()
      }));
    },

    updateNote: (id, updates) => {
      set(state => ({
        notes: state.notes.map(n => 
          n.id === id ? { ...n, ...updates, updatedAt: now() } : n
        ),
        lastModified: now()
      }));
    },

    deleteNote: (id) => {
      set(state => ({
        notes: state.notes.filter(n => n.id !== id),
        lastModified: now()
      }));
    },

    // ═══════════════════════════════════════════════════════════
    // UI STATE ACTIONS
    // ═══════════════════════════════════════════════════════════

    setActiveTab: (tab) => set({ activeTab: tab }),
    
    setSelectedItem: (item, type) => set({ selectedItem: item, modalType: type }),
    
    closeModal: () => set({ selectedItem: null, modalType: null }),
    
    toggleCommandPalette: () => set(state => ({ 
      isCommandPaletteOpen: !state.isCommandPaletteOpen 
    })),
    
    setSearchQuery: (query) => set({ searchQuery: query }),
    
    setFilterPriority: (priority) => set({ filterPriority: priority }),
    
    setFilterStatus: (status) => set({ filterStatus: status }),
    
    setFocusedTask: (id) => set({ focusedTaskId: id }),

    updatePhase: (phase) => set(state => ({
      stats: { ...state.stats, currentPhase: phase },
      lastModified: now()
    })),

    // ═══════════════════════════════════════════════════════════
    // FILE OPERATIONS
    // ═══════════════════════════════════════════════════════════

    loadState: (state) => {
      set({
        ...state,
        activeTab: get().activeTab,
        isLoading: false,
        syncStatus: { status: 'SYNCED', lastSync: now(), pendingChanges: 0 }
      });
      get().recalculateStats();
    },

    saveToFile: async () => {
      const state = get();
      const projectState: ProjectState = {
        version: state.version,
        lastModified: now(),
        modifiedBy: 'USER',
        tasks: state.tasks,
        roadmap: state.roadmap,
        challenges: state.challenges,
        notes: state.notes,
        stats: state.stats,
        settings: state.settings
      };

      const success = await fileService.saveFile(projectState);
      
      if (success) {
        set({ 
          syncStatus: { status: 'SYNCED', lastSync: now(), pendingChanges: 0 }
        });
      }
      
      return success;
    },

    openFile: async () => {
      set({ isLoading: true });
      const state = await fileService.openFile();
      
      if (state) {
        get().loadState(state);
        return true;
      }
      
      set({ isLoading: false });
      return false;
    },

    exportState: () => {
      const state = get();
      const projectState: ProjectState = {
        version: state.version,
        lastModified: now(),
        modifiedBy: 'USER',
        tasks: state.tasks,
        roadmap: state.roadmap,
        challenges: state.challenges,
        notes: state.notes,
        stats: state.stats,
        settings: state.settings
      };
      fileService.downloadState(projectState);
    },

    // ═══════════════════════════════════════════════════════════
    // AI INTEGRATION
    // ═══════════════════════════════════════════════════════════

    executeAIActions: (actions) => {
      actions.forEach(action => {
        console.log('[AI Action]', action.type, action.payload);
        
        switch (action.type) {
          case 'ADD_TASK':
            get().addTask(action.payload as Partial<DailyTask>);
            break;
          case 'UPDATE_TASK':
            if (action.payload.id) {
              get().updateTask(action.payload.id, action.payload);
            }
            break;
          case 'DELETE_TASK':
            if (action.payload.id) {
              get().deleteTask(action.payload.id);
            }
            break;
          case 'COMPLETE_TASK':
            if (action.payload.id) {
              get().toggleTask(action.payload.id);
            }
            break;
          case 'ADD_ROADMAP_ITEM':
            get().addRoadmapItem(action.payload as Partial<RoadmapItem>);
            break;
          case 'UPDATE_ROADMAP_STATUS':
            if (action.payload.id && action.payload.status) {
              get().updateRoadmapStatus(
                action.payload.id, 
                action.payload.status,
                action.payload.completionPercentage
              );
            }
            break;
          case 'ADD_CHALLENGE':
            get().addChallenge(action.payload as Partial<Challenge>);
            break;
          case 'RESOLVE_CHALLENGE':
            if (action.payload.id) {
              get().resolveChallenge(action.payload.id, action.payload.solution);
            }
            break;
          case 'UPDATE_PHASE':
            if (action.payload.phase) {
              get().updatePhase(action.payload.phase);
            }
            break;
        }
      });
      
      // Mark as modified by AI
      set({ modifiedBy: 'AI_WINDSURF' as any });
    },

    // ═══════════════════════════════════════════════════════════
    // UNDO/REDO
    // ═══════════════════════════════════════════════════════════

    undo: () => {
      const entry = historyService.popForUndo();
      if (!entry) return;

      // Restore previous value based on entity type
      switch (entry.entityType) {
        case 'TASK':
          if (entry.action === 'ADD_TASK') {
            set(state => ({
              tasks: state.tasks.filter(t => t.id !== entry.entityId)
            }));
          } else if (entry.action === 'DELETE_TASK' && entry.previousValue) {
            set(state => ({
              tasks: [...state.tasks, entry.previousValue]
            }));
          } else if (entry.previousValue) {
            set(state => ({
              tasks: state.tasks.map(t => 
                t.id === entry.entityId ? entry.previousValue : t
              )
            }));
          }
          break;
        // Similar for ROADMAP, CHALLENGE, NOTE...
      }
      
      get().recalculateStats();
    },

    redo: () => {
      const entry = historyService.popForRedo();
      if (!entry) return;

      // Reapply the action
      switch (entry.entityType) {
        case 'TASK':
          if (entry.action === 'ADD_TASK' && entry.newValue) {
            set(state => ({
              tasks: [...state.tasks, entry.newValue]
            }));
          } else if (entry.action === 'DELETE_TASK') {
            set(state => ({
              tasks: state.tasks.filter(t => t.id !== entry.entityId)
            }));
          } else if (entry.newValue) {
            set(state => ({
              tasks: state.tasks.map(t => 
                t.id === entry.entityId ? entry.newValue : t
              )
            }));
          }
          break;
      }
      
      get().recalculateStats();
    },

    // ═══════════════════════════════════════════════════════════
    // COMPUTED / FILTERS
    // ═══════════════════════════════════════════════════════════

    getFilteredTasks: () => {
      const { tasks, searchQuery, filterPriority, settings } = get();
      
      return tasks.filter(task => {
        if (!settings.showCompletedTasks && task.isCompleted) return false;
        if (filterPriority !== 'ALL' && task.priority !== filterPriority) return false;
        if (searchQuery && !task.content.toLowerCase().includes(searchQuery.toLowerCase())) return false;
        return true;
      });
    },

    getTasksByType: (type) => {
      return get().getFilteredTasks().filter(t => t.type === type);
    },

    getRoadmapByTier: (tier) => {
      const { roadmap, filterStatus } = get();
      return roadmap.filter(r => {
        if (r.tier !== tier) return false;
        if (filterStatus !== 'ALL' && r.status !== filterStatus) return false;
        return true;
      });
    },

    recalculateStats: () => {
      const { roadmap, tasks } = get();
      
      const totalFeatures = roadmap.length;
      const implemented = roadmap.filter(r => r.status === Status.COMPLETED).length;
      const partial = roadmap.filter(r => 
        r.status === Status.PARTIAL || r.status === Status.IN_PROGRESS
      ).length;
      const blocked = roadmap.filter(r => r.status === Status.BLOCKED).length;
      const notImplemented = totalFeatures - implemented - partial - blocked;
      
      const overallProgress = totalFeatures > 0 
        ? Math.round(roadmap.reduce((acc, r) => acc + r.completionPercentage, 0) / totalFeatures)
        : 0;

      const today = new Date().toDateString();
      const todayCompleted = tasks.filter(t => 
        t.isCompleted && 
        t.completedAt && 
        new Date(t.completedAt).toDateString() === today
      ).length;

      set(state => ({
        stats: {
          ...state.stats,
          totalFeatures,
          implemented,
          partial,
          blocked,
          notImplemented,
          overallProgress,
          todayCompleted
        }
      }));
    }
  }))
);

// ─────────────────────────────────────────────────────────────────
// AUTO-SAVE SUBSCRIPTION
// ─────────────────────────────────────────────────────────────────

let saveTimeout: number | null = null;

useNexusStore.subscribe(
  (state) => state.lastModified,
  () => {
    const { settings } = useNexusStore.getState();
    
    if (saveTimeout) clearTimeout(saveTimeout);
    
    saveTimeout = window.setTimeout(() => {
      if (fileService.hasFileAccess()) {
        useNexusStore.getState().saveToFile();
      }
    }, settings.autoSaveInterval);
  }
);
