/**
 * ═══════════════════════════════════════════════════════════════
 * WINDSURF NEXUS INTEGRATION
 * AI-assisted project management for AK-FLOW
 * ═══════════════════════════════════════════════════════════════
 * 
 * This module enables AI editors (Windsurf, Antigrafity, Cursor, Claude)
 * to programmatically manage tasks, roadmap, challenges, and notes.
 * 
 * Usage:
 *   import { nexusAPI } from './windsurf-integration';
 *   await nexusAPI.addTask({ content: 'Fix bug', priority: 'HIGH', type: 'TODAY' });
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// ─────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────

type Priority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
type TaskType = 'TODAY' | 'TOMORROW' | 'BACKLOG';
type Severity = 'CRITICAL' | 'HIGH' | 'MODERATE' | 'LOW';
type ChallengeStatus = 'OPEN' | 'INVESTIGATING' | 'RESOLVED';
type RoadmapStatus = 'PLANNED' | 'IN_PROGRESS' | 'IMPLEMENTED' | 'TESTED' | 'DOCUMENTED';
type NoteCategory = 'IDEA' | 'INSIGHT' | 'DECISION' | 'RESEARCH' | 'QUESTION';
type EditorName = 'AI_WINDSURF' | 'AI_ANTIGRAFITY' | 'AI_CURSOR' | 'AI_CLAUDE' | 'USER';

interface Subtask {
  id: string;
  content: string;
  completed: boolean;
}

interface Task {
  id: string;
  content: string;
  priority: Priority;
  type: TaskType;
  completed: boolean;
  subtasks: Subtask[];
  createdAt: string;
  modifiedAt: string;
}

interface RoadmapItem {
  id: string;
  title: string;
  description: string;
  tier: number;
  status: RoadmapStatus;
  completionPercentage: number;
  createdAt: string;
  modifiedAt: string;
}

interface Challenge {
  id: string;
  title: string;
  description: string;
  severity: Severity;
  status: ChallengeStatus;
  potentialSolution?: string;
  createdAt: string;
  modifiedAt: string;
}

interface Note {
  id: string;
  title: string;
  content: string;
  category: NoteCategory;
  tags: string[];
  createdAt: string;
  modifiedAt: string;
}

interface NexusState {
  version: string;
  lastModified: string;
  modifiedBy: EditorName;
  tasks: Task[];
  roadmap: RoadmapItem[];
  challenges: Challenge[];
  notes: Note[];
  stats: {
    totalFeatures: number;
    implemented: number;
    partial?: number;
    overallProgress: number;
    currentPhase: string;
    todayCompleted: number;
    streak: number;
  };
  settings: {
    theme: string;
    autoSaveInterval: number;
    fileWatchEnabled: boolean;
    showCompletedTasks: boolean;
  };
}

interface Config {
  nexusConfig: {
    stateFilePath: string;
    nexusDataPath: string;
    backup: {
      enabled: boolean;
      maxBackups: number;
      backupFolder: string;
    };
  };
  aiProtocol: {
    editors: Record<string, { name: EditorName; prefix: string }>;
    idGeneration: {
      taskPrefix: string;
      challengePrefix: string;
      notePrefix: string;
      roadmapPrefix: string;
      useTimestamp: boolean;
    };
  };
}

// ─────────────────────────────────────────────────────────────────
// NEXUS API CLASS
// ─────────────────────────────────────────────────────────────────

class NexusIntegration {
  private config: Config;
  private state: NexusState;
  private editorName: EditorName;
  private stateFilePath: string;
  private baseDir: string;

  constructor(editor: 'windsurf' | 'antigrafity' | 'cursor' | 'claude' = 'windsurf') {
    this.baseDir = dirname(fileURLToPath(import.meta.url));
    this.config = this.loadConfig();
    this.editorName = this.config.aiProtocol.editors[editor]?.name || 'AI_WINDSURF';
    this.stateFilePath = join(this.baseDir, this.config.nexusConfig.stateFilePath);
    this.state = this.loadState();
  }

  private loadConfig(): Config {
    const configPath = join(this.baseDir, 'windsurf-akflow-config.json');
    if (!existsSync(configPath)) {
      throw new Error(`[NEXUS] Config not found: ${configPath}`);
    }
    return JSON.parse(readFileSync(configPath, 'utf-8'));
  }

  private loadState(): NexusState {
    if (!existsSync(this.stateFilePath)) {
      console.log('[NEXUS] State file not found, creating default');
      return this.createDefaultState();
    }
    try {
      return JSON.parse(readFileSync(this.stateFilePath, 'utf-8'));
    } catch (error) {
      console.error('[NEXUS] Failed to parse state file:', error);
      return this.createDefaultState();
    }
  }

  private createDefaultState(): NexusState {
    return {
      version: '13.0',
      lastModified: new Date().toISOString(),
      modifiedBy: this.editorName,
      tasks: [],
      roadmap: [],
      challenges: [],
      notes: [],
      stats: {
        totalFeatures: 0,
        implemented: 0,
        overallProgress: 0,
        currentPhase: 'INITIALIZATION',
        todayCompleted: 0,
        streak: 0
      },
      settings: {
        theme: 'cyberpunk',
        autoSaveInterval: 2000,
        fileWatchEnabled: true,
        showCompletedTasks: true
      }
    };
  }

  private generateId(prefix: string): string {
    const editorPrefix = this.editorName.replace('AI_', '').toLowerCase().slice(0, 2);
    return `${prefix}${editorPrefix}-${Date.now()}`;
  }

  private now(): string {
    return new Date().toISOString();
  }

  private save(): void {
    this.state.lastModified = this.now();
    this.state.modifiedBy = this.editorName;

    // Create backup if enabled
    if (this.config.nexusConfig.backup.enabled) {
      this.createBackup();
    }

    writeFileSync(this.stateFilePath, JSON.stringify(this.state, null, 2), 'utf-8');
    console.log(`[NEXUS] State saved by ${this.editorName}`);

    // Also sync to nexus data folder
    const nexusDataPath = join(this.baseDir, this.config.nexusConfig.nexusDataPath);
    if (existsSync(dirname(nexusDataPath))) {
      writeFileSync(nexusDataPath, JSON.stringify(this.state, null, 2), 'utf-8');
      console.log(`[NEXUS] Synced to NEXUS UI data folder`);
    }
  }

  private createBackup(): void {
    const backupDir = join(this.baseDir, this.config.nexusConfig.backup.backupFolder);
    if (!existsSync(backupDir)) {
      mkdirSync(backupDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = join(backupDir, `ak-flow-state-${timestamp}.json`);
    writeFileSync(backupPath, JSON.stringify(this.state, null, 2), 'utf-8');
  }

  // ═══════════════════════════════════════════════════════════════
  // TASK OPERATIONS
  // ═══════════════════════════════════════════════════════════════

  addTask(data: {
    content: string;
    priority?: Priority;
    type?: TaskType;
    subtasks?: Array<{ content: string }>;
  }): Task {
    const task: Task = {
      id: this.generateId(this.config.aiProtocol.idGeneration.taskPrefix),
      content: data.content,
      priority: data.priority || 'MEDIUM',
      type: data.type || 'TODAY',
      completed: false,
      subtasks: (data.subtasks || []).map((st, i) => ({
        id: `sub-${Date.now()}-${i}`,
        content: st.content,
        completed: false
      })),
      createdAt: this.now(),
      modifiedAt: this.now()
    };

    this.state.tasks.unshift(task);
    this.save();
    console.log(`[NEXUS] Task added: ${task.id} - ${task.content}`);
    return task;
  }

  completeTask(taskId: string): boolean {
    const task = this.state.tasks.find(t => t.id === taskId);
    if (!task) {
      console.error(`[NEXUS] Task not found: ${taskId}`);
      return false;
    }

    task.completed = true;
    task.modifiedAt = this.now();
    this.state.stats.todayCompleted++;
    this.save();
    console.log(`[NEXUS] Task completed: ${taskId}`);
    return true;
  }

  updateTask(taskId: string, updates: Partial<Omit<Task, 'id' | 'createdAt'>>): boolean {
    const task = this.state.tasks.find(t => t.id === taskId);
    if (!task) {
      console.error(`[NEXUS] Task not found: ${taskId}`);
      return false;
    }

    Object.assign(task, updates, { modifiedAt: this.now() });
    this.save();
    console.log(`[NEXUS] Task updated: ${taskId}`);
    return true;
  }

  moveTask(taskId: string, type: TaskType): boolean {
    return this.updateTask(taskId, { type });
  }

  // ═══════════════════════════════════════════════════════════════
  // ROADMAP OPERATIONS
  // ═══════════════════════════════════════════════════════════════

  addRoadmapItem(data: {
    title: string;
    description: string;
    tier: number;
    status?: RoadmapStatus;
    completionPercentage?: number;
  }): RoadmapItem {
    const item: RoadmapItem = {
      id: this.generateId(this.config.aiProtocol.idGeneration.roadmapPrefix),
      title: data.title,
      description: data.description,
      tier: data.tier,
      status: data.status || 'PLANNED',
      completionPercentage: data.completionPercentage || 0,
      createdAt: this.now(),
      modifiedAt: this.now()
    };

    this.state.roadmap.push(item);
    this.recalculateStats();
    this.save();
    console.log(`[NEXUS] Roadmap item added: ${item.id} - ${item.title}`);
    return item;
  }

  updateRoadmapStatus(itemId: string, status: RoadmapStatus, percentage?: number): boolean {
    const item = this.state.roadmap.find(r => r.id === itemId);
    if (!item) {
      console.error(`[NEXUS] Roadmap item not found: ${itemId}`);
      return false;
    }

    item.status = status;
    if (percentage !== undefined) {
      item.completionPercentage = percentage;
    } else if (status === 'IMPLEMENTED' || status === 'DOCUMENTED') {
      item.completionPercentage = 100;
    }
    item.modifiedAt = this.now();

    this.recalculateStats();
    this.save();
    console.log(`[NEXUS] Roadmap updated: ${itemId} -> ${status} (${item.completionPercentage}%)`);
    return true;
  }

  // ═══════════════════════════════════════════════════════════════
  // CHALLENGE OPERATIONS
  // ═══════════════════════════════════════════════════════════════

  addChallenge(data: {
    title: string;
    description: string;
    severity?: Severity;
    potentialSolution?: string;
  }): Challenge {
    const challenge: Challenge = {
      id: this.generateId(this.config.aiProtocol.idGeneration.challengePrefix),
      title: data.title,
      description: data.description,
      severity: data.severity || 'MODERATE',
      status: 'OPEN',
      potentialSolution: data.potentialSolution,
      createdAt: this.now(),
      modifiedAt: this.now()
    };

    this.state.challenges.unshift(challenge);
    this.save();
    console.log(`[NEXUS] Challenge added: ${challenge.id} - ${challenge.title}`);
    return challenge;
  }

  resolveChallenge(challengeId: string, solution?: string): boolean {
    const challenge = this.state.challenges.find(c => c.id === challengeId);
    if (!challenge) {
      console.error(`[NEXUS] Challenge not found: ${challengeId}`);
      return false;
    }

    challenge.status = 'RESOLVED';
    if (solution) {
      challenge.potentialSolution = solution;
    }
    challenge.modifiedAt = this.now();
    this.save();
    console.log(`[NEXUS] Challenge resolved: ${challengeId}`);
    return true;
  }

  // ═══════════════════════════════════════════════════════════════
  // NOTE OPERATIONS
  // ═══════════════════════════════════════════════════════════════

  addNote(data: {
    title: string;
    content: string;
    category?: NoteCategory;
    tags?: string[];
  }): Note {
    const note: Note = {
      id: this.generateId(this.config.aiProtocol.idGeneration.notePrefix),
      title: data.title,
      content: data.content,
      category: data.category || 'IDEA',
      tags: data.tags || [],
      createdAt: this.now(),
      modifiedAt: this.now()
    };

    this.state.notes.unshift(note);
    this.save();
    console.log(`[NEXUS] Note added: ${note.id} - ${note.title}`);
    return note;
  }

  // ═══════════════════════════════════════════════════════════════
  // PHASE & STATS
  // ═══════════════════════════════════════════════════════════════

  updatePhase(phase: string): void {
    this.state.stats.currentPhase = phase;
    this.save();
    console.log(`[NEXUS] Phase updated: ${phase}`);
  }

  private recalculateStats(): void {
    const { roadmap } = this.state;
    const totalFeatures = roadmap.length;
    const implemented = roadmap.filter(r => 
      r.status === 'IMPLEMENTED' || r.status === 'TESTED' || r.status === 'DOCUMENTED'
    ).length;
    
    const overallProgress = totalFeatures > 0
      ? Math.round(roadmap.reduce((acc, r) => acc + r.completionPercentage, 0) / totalFeatures)
      : 0;

    this.state.stats.totalFeatures = totalFeatures;
    this.state.stats.implemented = implemented;
    this.state.stats.overallProgress = overallProgress;
  }

  // ═══════════════════════════════════════════════════════════════
  // TEST RESULTS INTEGRATION
  // ═══════════════════════════════════════════════════════════════

  reportTestFailure(testName: string, errorMessage: string): Challenge {
    return this.addChallenge({
      title: `Test Failure: ${testName}`,
      description: errorMessage,
      severity: 'HIGH',
      potentialSolution: 'Investigate and fix the failing test'
    });
  }

  reportTestSuccess(testName: string, relatedTaskId?: string): void {
    if (relatedTaskId) {
      this.completeTask(relatedTaskId);
    }
    console.log(`[NEXUS] Test passed: ${testName}`);
  }

  // ═══════════════════════════════════════════════════════════════
  // GETTERS
  // ═══════════════════════════════════════════════════════════════

  getState(): NexusState {
    return this.state;
  }

  getTodayTasks(): Task[] {
    return this.state.tasks.filter(t => t.type === 'TODAY' && !t.completed);
  }

  getOpenChallenges(): Challenge[] {
    return this.state.challenges.filter(c => c.status !== 'RESOLVED');
  }

  getCurrentPhase(): string {
    return this.state.stats.currentPhase;
  }
}

// ─────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────

export const nexusAPI = new NexusIntegration('windsurf');
export { NexusIntegration };
export type { Task, Challenge, Note, RoadmapItem, NexusState };
