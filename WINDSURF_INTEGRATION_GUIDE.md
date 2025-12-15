# WINDSURF INTEGRATION COMMAND: AK-FLOW NEXUS SETUP

## CEL:
Zintegrować system zarządzania projektem AK-FLOW NEXUS z głównym kodem AK-FLOW, umożliwiając automatyczne aktualizacje zadań, wyzwań i roadmapy na podstawie analizy kodu i wyników testów.

## KROKI DO WYKONANIA:

### 1. UTWÓRZ STRUKTURĘ PLIKÓW
```bash
# Utwórz niezbędne pliki w głównym katalogu AK-FLOW
touch windsurf-akflow-config.json
touch windsurf-integration.ts
touch ak-flow-state.json
```

### 2. UTWÓRZ PLIK KONFIGURACYJNY `windsurf-akflow-config.json`
```json
{
  "name": "AK-FLOW NEXUS Integration",
  "version": "1.0",
  "nexusConfig": {
    "stateFilePath": "ak-flow-state.json",
    "pollingInterval": 1000,
    "autoSaveInterval": 2000,
    "backup": {
      "enabled": true,
      "maxBackups": 5,
      "backupFolder": "backups/"
    }
  },
  "integrationPoints": {
    "testResults": {
      "enabled": true,
      "failureThreshold": "HIGH",
      "successUpdate": {
        "completeTask": true,
        "updateRoadmap": true
      }
    },
    "codeAnalysis": {
      "enabled": true,
      "complexityThreshold": 15,
      "duplicateCodeThreshold": 5
    }
  },
  "aiProtocol": {
    "editorName": "AI_WINDSURF",
    "allowedActions": [
      "ADD_TASK",
      "COMPLETE_TASK",
      "UPDATE_ROADMAP_STATUS",
      "ADD_CHALLENGE",
      "ADD_NOTE"
    ],
    "idGeneration": {
      "taskPrefix": "task-ws-",
      "challengePrefix": "ch-ws-",
      "useTimestamp": true
    }
  }
}
```

### 3. UTWÓRZ PLIK INTEGRACYJNY `windsurf-integration.ts`
```typescript
import { readFile, writeFile, mkdir } from 'fs/promises';
import { watch } from 'chokidar';
import path from 'path';

interface NexusState {
  version: string;
  lastModified: string;
  modifiedBy: string;
  tasks: Task[];
  challenges: Challenge[];
  stats: any;
  settings: any;
}

interface Task {
  id: string;
  content: string;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  type: 'TODAY' | 'TOMORROW' | 'BACKLOG';
  completed: boolean;
  subtasks: any[];
  createdAt: string;
  modifiedAt: string;
}

interface Challenge {
  id: string;
  title: string;
  description: string;
  severity: 'CRITICAL' | 'HIGH' | 'MODERATE' | 'LOW';
  status: 'OPEN' | 'INVESTIGATING' | 'RESOLVED';
  potentialSolution?: string;
  createdAt: string;
  modifiedAt: string;
}

class WindsurfNexusIntegration {
  private config: any;
  private currentState: NexusState;
  private fileWatcher: any;

  constructor() {
    this.config = require('./windsurf-akflow-config.json');
    this.currentState = this.createDefaultState();
    this.initialize();
  }

  private async initialize() {
    await this.loadOrCreateState();
    this.setupFileWatcher();
    await this.createBackupFolder();
  }

  private async loadOrCreateState() {
    try {
      const stateContent = await readFile(this.config.nexusConfig.stateFilePath, 'utf-8');
      this.currentState = JSON.parse(stateContent);
      console.log('[WINDSURF] Loaded existing state');
    } catch (error) {
      console.log('[WINDSURF] Creating new state file');
      await this.saveState();
    }
  }

  private createDefaultState(): NexusState {
    return {
      version: "13.0",
      lastModified: new Date().toISOString(),
      modifiedBy: "AI_WINDSURF",
      tasks: [],
      challenges: [],
      stats: {
        totalFeatures: 30,
        implemented: 6,
        overallProgress: 20,
        currentPhase: "Integration Setup",
        todayCompleted: 0,
        streak: 0
      },
      settings: {
        theme: "cyberpunk",
        autoSaveInterval: 2000,
        fileWatchEnabled: true,
        showCompletedTasks: true
      }
    };
  }

  private setupFileWatcher() {
    this.fileWatcher = watch(this.config.nexusConfig.stateFilePath, {
      interval: this.config.nexusConfig.pollingInterval,
      ignoreInitial: true
    });

    this.fileWatcher.on('change', async () => {
      console.log('[WINDSURF] State file changed, reloading...');
      await this.loadOrCreateState();
    });
  }

  private async createBackupFolder() {
    try {
      await mkdir(this.config.nexusConfig.backup.backupFolder, { recursive: true });
    } catch (error) {
      console.warn('[WINDSURF] Could not create backup folder');
    }
  }

  public async addTask(taskData: Omit<Task, 'id' | 'createdAt' | 'modifiedAt'>) {
    const newTask: Task = {
      ...taskData,
      id: `${this.config.aiProtocol.idGeneration.taskPrefix}${Date.now()}`,
      createdAt: new Date().toISOString(),
      modifiedAt: new Date().toISOString()
    };

    this.currentState.tasks.push(newTask);
    this.currentState.lastModified = new Date().toISOString();
    this.currentState.modifiedBy = this.config.aiProtocol.editorName;

    await this.saveState();
    return newTask;
  }

  public async addChallenge(challengeData: Omit<Challenge, 'id' | 'createdAt' | 'modifiedAt'>) {
    const newChallenge: Challenge = {
      ...challengeData,
      id: `${this.config.aiProtocol.idGeneration.challengePrefix}${Date.now()}`,
      createdAt: new Date().toISOString(),
      modifiedAt: new Date().toISOString()
    };

    this.currentState.challenges.push(newChallenge);
    this.currentState.lastModified = new Date().toISOString();
    this.currentState.modifiedBy = this.config.aiProtocol.editorName;

    await this.saveState();
    return newChallenge;
  }

  private async saveState() {
    try {
      await writeFile(
        this.config.nexusConfig.stateFilePath,
        JSON.stringify(this.currentState, null, 2),
        'utf-8'
      );
      console.log('[WINDSURF] State saved successfully');
    } catch (error) {
      console.error('[WINDSURF] Failed to save state:', error);
    }
  }

  public async analyzeTestResults(testResults: any[]) {
    for (const result of testResults) {
      if (result.status === 'FAILED') {
        await this.addChallenge({
          title: `Test failure: ${result.name}`,
          description: result.error?.message || 'Unknown error',
          severity: 'HIGH',
          status: 'OPEN',
          potentialSolution: 'Investigate test failure'
        });
      }
    }
  }

  public async cleanup() {
    if (this.fileWatcher) {
      await this.fileWatcher.close();
    }
  }
}

// Initialize integration
const integration = new WindsurfNexusIntegration();

// Example: Add initial integration task
integration.addTask({
  content: "Complete Windsurf integration setup",
  priority: "HIGH",
  type: "TODAY",
  completed: false,
  subtasks: []
});

// Export for use in other modules
export { WindsurfNexusIntegration };
```

### 4. ZAINSTALUJ ZALEŻNOŚCI
```bash
npm install chokidar @types/chokidar --save
npm install @types/node --save-dev
```

### 5. DODAJ SKRYPTY DO package.json
```json
{
  "scripts": {
    "windsurf:init": "ts-node windsurf-integration.ts",
    "windsurf:watch": "nodemon --watch 'ak-flow-state.json' --exec 'ts-node windsurf-integration.ts'",
    "windsurf:test": "jest --notify && ts-node windsurf-integration.ts"
  }
}
```

### 6. INTEGRACJA Z SYSTEM TESTÓW
```typescript
// W pliku test-runner.js lub podobnym
import { WindsurfNexusIntegration } from './windsurf-integration';

const windsurf = new WindsurfNexusIntegration();

// Po każdym teście
afterEach(async () => {
  const testResults = getTestResults(); // Twoja funkcja pobierająca wyniki
  await windsurf.analyzeTestResults(testResults);
});
```

### 7. URUCHOM INTEGRACJĘ
```bash
# Uruchom integrację
npm run windsurf:init

# Uruchom w trybie watch (do developmentu)
npm run windsurf:watch
```

## WERYFIKACJA INTEGRACJI:

1. **Sprawdź czy plik `ak-flow-state.json` został utworzony**
2. **Uruchom testy i sprawdź czy wyzwania są automatycznie dodawane**
3. **Dodaj zadanie ręcznie przez NEXUS UI i sprawdź czy Windsurf je wykrywa**
4. **Sprawdź logi - powinny pojawiać się komunikaty `[WINDSURF]`**

## OGRANICZENIA I UWAGI:

1. Wymaga Node.js 14+ ze względu na `fs/promises`
2. Plik JSON musi być dostępny w tym samym katalogu co skrypt
3. W trybie watch może zużywać więcej zasobów
4. Backup folder jest tworzony automatycznie przy starcie

## KOLEJNE KROKI (opcjonalne):

1. Dodaj integrację z GitHub Actions dla CI/CD
2. Zaimplementuj system powiadomień o krytycznych wyzwaniach
3. Dodaj automatyczne aktualizowanie roadmapy na podstawie postępu
4. Zaimplementuj system backupów z rotacją
