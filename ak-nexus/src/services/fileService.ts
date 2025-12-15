// ═══════════════════════════════════════════════════════════════
// FILE SERVICE - Local JSON Storage with Watch Mode
// Enables AI (Windsurf) to edit JSON while UI auto-refreshes
// ═══════════════════════════════════════════════════════════════

import { ProjectState } from '../types';

const STATE_FILE_NAME = 'ak-flow-state.json';
const HISTORY_FILE_NAME = 'ak-flow-history.json';

interface FileServiceConfig {
  onExternalChange?: (state: ProjectState) => void;
  onError?: (error: Error) => void;
  autoSaveDebounce?: number;
}

class FileService {
  private fileHandle: FileSystemFileHandle | null = null;
  private directoryHandle: FileSystemDirectoryHandle | null = null;
  private watchInterval: number | null = null;
  private lastKnownContent: string = '';
  private config: FileServiceConfig = {};
  private saveTimeout: number | null = null;

  // ─────────────────────────────────────────────────────────────
  // INITIALIZATION
  // ─────────────────────────────────────────────────────────────

  configure(config: FileServiceConfig) {
    this.config = { ...this.config, ...config };
  }

  /**
   * Open file picker and get persistent access to the JSON file
   */
  async openFile(): Promise<ProjectState | null> {
    try {
      // Check if File System Access API is supported
      if (!('showOpenFilePicker' in window)) {
        throw new Error('File System Access API not supported. Use Chrome/Edge.');
      }

      const [handle] = await (window as any).showOpenFilePicker({
        types: [{
          description: 'AK-FLOW State',
          accept: { 'application/json': ['.json'] }
        }],
        multiple: false
      });

      this.fileHandle = handle;
      return await this.readFile();
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        this.config.onError?.(error);
      }
      return null;
    }
  }

  /**
   * Select directory for project files
   */
  async openDirectory(): Promise<boolean> {
    try {
      if (!('showDirectoryPicker' in window)) {
        throw new Error('Directory picker not supported');
      }

      this.directoryHandle = await (window as any).showDirectoryPicker({
        mode: 'readwrite'
      });

      // Try to find existing state file
      try {
        this.fileHandle = await this.directoryHandle.getFileHandle(STATE_FILE_NAME);
      } catch {
        // File doesn't exist, will create on first save
        this.fileHandle = null;
      }

      return true;
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        this.config.onError?.(error);
      }
      return false;
    }
  }

  // ─────────────────────────────────────────────────────────────
  // READ / WRITE
  // ─────────────────────────────────────────────────────────────

  async readFile(): Promise<ProjectState | null> {
    if (!this.fileHandle) return null;

    try {
      const file = await this.fileHandle.getFile();
      const content = await file.text();
      this.lastKnownContent = content;
      return JSON.parse(content) as ProjectState;
    } catch (error: any) {
      this.config.onError?.(error);
      return null;
    }
  }

  async saveFile(state: ProjectState): Promise<boolean> {
    try {
      // Ensure we have a file handle
      if (!this.fileHandle && this.directoryHandle) {
        this.fileHandle = await this.directoryHandle.getFileHandle(
          STATE_FILE_NAME, 
          { create: true }
        );
      }

      if (!this.fileHandle) {
        // Fallback: prompt to save
        return await this.saveFileAs(state);
      }

      const writable = await (this.fileHandle as any).createWritable();
      const content = JSON.stringify(state, null, 2);
      await writable.write(content);
      await writable.close();
      
      this.lastKnownContent = content;
      return true;
    } catch (error: any) {
      this.config.onError?.(error);
      return false;
    }
  }

  async saveFileAs(state: ProjectState): Promise<boolean> {
    try {
      if (!('showSaveFilePicker' in window)) {
        // Fallback: download
        this.downloadState(state);
        return true;
      }

      const handle = await (window as any).showSaveFilePicker({
        suggestedName: STATE_FILE_NAME,
        types: [{
          description: 'AK-FLOW State',
          accept: { 'application/json': ['.json'] }
        }]
      });

      this.fileHandle = handle;
      return await this.saveFile(state);
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        this.config.onError?.(error);
      }
      return false;
    }
  }

  /**
   * Debounced save - prevents too many writes
   */
  debouncedSave(state: ProjectState, delay: number = 1000) {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    this.saveTimeout = window.setTimeout(() => {
      this.saveFile(state);
    }, delay);
  }

  // ─────────────────────────────────────────────────────────────
  // WATCH MODE - Detect external changes (from Windsurf)
  // ─────────────────────────────────────────────────────────────

  startWatching(intervalMs: number = 1000) {
    if (this.watchInterval) {
      this.stopWatching();
    }

    this.watchInterval = window.setInterval(async () => {
      if (!this.fileHandle) return;

      try {
        const file = await this.fileHandle.getFile();
        const content = await file.text();

        if (content !== this.lastKnownContent) {
          console.log('[FileService] External change detected!');
          this.lastKnownContent = content;
          
          try {
            const state = JSON.parse(content) as ProjectState;
            this.config.onExternalChange?.(state);
          } catch (parseError) {
            console.error('[FileService] Invalid JSON in file');
          }
        }
      } catch (error) {
        // File might be temporarily locked during write
      }
    }, intervalMs);

    console.log('[FileService] Watch mode started');
  }

  stopWatching() {
    if (this.watchInterval) {
      clearInterval(this.watchInterval);
      this.watchInterval = null;
      console.log('[FileService] Watch mode stopped');
    }
  }

  isWatching(): boolean {
    return this.watchInterval !== null;
  }

  // ─────────────────────────────────────────────────────────────
  // FALLBACK: Download/Upload (for unsupported browsers)
  // ─────────────────────────────────────────────────────────────

  downloadState(state: ProjectState) {
    const content = JSON.stringify(state, null, 2);
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = STATE_FILE_NAME;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async uploadState(file: File): Promise<ProjectState | null> {
    try {
      const content = await file.text();
      return JSON.parse(content) as ProjectState;
    } catch (error: any) {
      this.config.onError?.(error);
      return null;
    }
  }

  // ─────────────────────────────────────────────────────────────
  // UTILITY
  // ─────────────────────────────────────────────────────────────

  hasFileAccess(): boolean {
    return this.fileHandle !== null || this.directoryHandle !== null;
  }

  getFileName(): string | null {
    return this.fileHandle?.name || null;
  }

  isFileSystemSupported(): boolean {
    return 'showOpenFilePicker' in window;
  }

  // Create initial state
  createDefaultState(): ProjectState {
    const now = new Date().toISOString();
    return {
      version: '13.0',
      lastModified: now,
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
        lastSync: now,
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
      }
    };
  }
}

// Singleton export
export const fileService = new FileService();

// ═══════════════════════════════════════════════════════════════
// HISTORY SERVICE - Track all changes
// ═══════════════════════════════════════════════════════════════

import { HistoryEntry } from '../types';

class HistoryService {
  private entries: HistoryEntry[] = [];
  private maxEntries: number = 100;
  private undoStack: HistoryEntry[] = [];

  addEntry(entry: Omit<HistoryEntry, 'id' | 'timestamp'>) {
    const fullEntry: HistoryEntry = {
      ...entry,
      id: `hist-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString()
    };
    
    this.entries.unshift(fullEntry);
    
    if (this.entries.length > this.maxEntries) {
      this.entries.pop();
    }
    
    // Clear redo stack on new action
    this.undoStack = [];
  }

  getEntries(limit: number = 50): HistoryEntry[] {
    return this.entries.slice(0, limit);
  }

  getLastEntry(): HistoryEntry | null {
    return this.entries[0] || null;
  }

  canUndo(): boolean {
    return this.entries.length > 0;
  }

  canRedo(): boolean {
    return this.undoStack.length > 0;
  }

  popForUndo(): HistoryEntry | null {
    const entry = this.entries.shift();
    if (entry) {
      this.undoStack.push(entry);
    }
    return entry || null;
  }

  popForRedo(): HistoryEntry | null {
    const entry = this.undoStack.pop();
    if (entry) {
      this.entries.unshift(entry);
    }
    return entry || null;
  }

  clear() {
    this.entries = [];
    this.undoStack = [];
  }

  exportHistory(): string {
    return JSON.stringify(this.entries, null, 2);
  }
}

export const historyService = new HistoryService();
