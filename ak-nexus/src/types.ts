// ═══════════════════════════════════════════════════════════════
// AK-FLOW NEXUS - COMPLETE TYPE DEFINITIONS
// Version: 13.0 | Production Ready
// ═══════════════════════════════════════════════════════════════

export enum Status {
  NOT_STARTED = "NOT_STARTED",
  IN_PROGRESS = "IN_PROGRESS",
  BLOCKED = "BLOCKED",
  COMPLETED = "COMPLETED",
  PARTIAL = "PARTIAL",
  FOUNDATION = "FOUNDATION"
}

export enum Tier {
  CONSCIOUSNESS = "Tier 1: Autonomous Consciousness",
  BEHAVIORS = "Tier 2: Proactive Behaviors",
  COGNITION = "Tier 3: Advanced Cognition",
  IDENTITY = "Tier 4: Personality & Identity",
  META = "Tier 5: Meta-Cognition",
  CREATIVITY = "Tier 6: Creativity & Expression",
  SOCIAL = "Tier 7: Social Intelligence",
  SUPERPOWERS = "Tier 8: Superpowers",
  EVOLUTION = "Tier 9: Evolution",
  TRANSCENDENCE = "Tier 10: Transcendence",
  META_LEARNING = "Tier 11: Meta-Learning",
  TRANSFER = "Tier 12: Transfer & Generalization"
}

export enum Priority {
  CRITICAL = "CRITICAL",
  HIGH = "HIGH",
  MEDIUM = "MEDIUM",
  LOW = "LOW"
}

// ─────────────────────────────────────────────────────────────────
// CORE DATA MODELS
// ─────────────────────────────────────────────────────────────────

export interface RoadmapItem {
  id: string;
  title: string;
  description: string;
  details?: string;
  status: Status;
  tier: Tier;
  completionPercentage: number;
  dependencies?: string[];
  tags?: string[];
  createdAt: string;
  updatedAt: string;
  estimatedHours?: number;
  actualHours?: number;
}

export interface DailyTask {
  id: string;
  content: string;
  details?: string;
  isCompleted: boolean;
  type: 'TODAY' | 'TOMORROW' | 'BACKLOG';
  priority: Priority;
  context?: string;
  roadmapLink?: string;  // Link to roadmap item
  subtasks?: Subtask[];
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  dueDate?: string;
  timeEstimate?: number; // minutes
  timeSpent?: number;    // minutes
}

export interface Subtask {
  id: string;
  content: string;
  isCompleted: boolean;
}

export interface Challenge {
  id: string;
  title: string;
  description: string;
  severity: 'CRITICAL' | 'HIGH' | 'MODERATE' | 'LOW';
  status: 'OPEN' | 'INVESTIGATING' | 'RESOLVED' | 'WONT_FIX';
  potentialSolution?: string;
  relatedFiles?: string[];
  roadmapLink?: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  category: 'IDEA' | 'INSIGHT' | 'DECISION' | 'RESEARCH' | 'QUESTION';
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ProjectStats {
  totalFeatures: number;
  implemented: number;
  partial: number;
  notImplemented: number;
  blocked: number;
  overallProgress: number;
  currentPhase: string;
  lastSync: string;
  todayCompleted: number;
  streak: number;
}

// ─────────────────────────────────────────────────────────────────
// STATE & HISTORY
// ─────────────────────────────────────────────────────────────────

export interface ProjectState {
  version: string;
  lastModified: string;
  modifiedBy: 'USER' | 'AI_WINDSURF' | 'AI_CURSOR' | 'AI_CLAUDE';
  dailyGoal?: string;
  tasks: DailyTask[];
  roadmap: RoadmapItem[];
  challenges: Challenge[];
  notes: Note[];
  stats: ProjectStats;
  settings: ProjectSettings;
}

export interface ProjectSettings {
  theme: 'dark' | 'light' | 'cyberpunk';
  autoSaveInterval: number; // ms
  fileWatchEnabled: boolean;
  showCompletedTasks: boolean;
  compactMode: boolean;
  soundEnabled: boolean;
}

export interface HistoryEntry {
  id: string;
  timestamp: string;
  action: string;
  entityType: 'TASK' | 'ROADMAP' | 'CHALLENGE' | 'NOTE' | 'SETTINGS';
  entityId: string;
  previousValue: any;
  newValue: any;
  source: 'USER' | 'AI';
}

// ─────────────────────────────────────────────────────────────────
// AI ACTION PROTOCOL (for Windsurf/Cursor integration)
// ─────────────────────────────────────────────────────────────────

export type AIActionType =
  | 'ADD_TASK'
  | 'UPDATE_TASK'
  | 'DELETE_TASK'
  | 'COMPLETE_TASK'
  | 'ADD_ROADMAP_ITEM'
  | 'UPDATE_ROADMAP_STATUS'
  | 'UPDATE_ROADMAP_PROGRESS'
  | 'ADD_CHALLENGE'
  | 'RESOLVE_CHALLENGE'
  | 'ADD_NOTE'
  | 'UPDATE_PHASE'
  | 'BULK_UPDATE';

export interface AIAction {
  type: AIActionType;
  payload: Record<string, any>;
  reason?: string;
}

export interface AIChangeLog {
  timestamp: string;
  agent: string;
  summary: string;
  actions: AIAction[];
}

// ─────────────────────────────────────────────────────────────────
// COMMAND PALETTE
// ─────────────────────────────────────────────────────────────────

export interface Command {
  id: string;
  title: string;
  shortcut?: string;
  category: 'navigation' | 'action' | 'filter' | 'settings';
  action: () => void;
  icon?: string;
}

// ─────────────────────────────────────────────────────────────────
// FILE SYNC
// ─────────────────────────────────────────────────────────────────

export interface SyncStatus {
  status: 'SYNCED' | 'PENDING' | 'CONFLICT' | 'ERROR';
  lastSync: string;
  pendingChanges: number;
  fileHandle?: FileSystemFileHandle;
}
