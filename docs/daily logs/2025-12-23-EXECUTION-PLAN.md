# P0 Execution Plan - 2025-12-23

## Cel dnia
- Odczarować „ghosty" przez jawny bootstrap
- Dodać MAINTAIN akcję autonomii z deterministyczną regułą
- Dodać [SNAPSHOT] tool
- Testy zabezpieczające

---

## P0.0 - Pre-flight (10 min)

```bash
npm test
npm run build
```

**Warunek:** PASS przed zmianami

---

## P0.1 - Runtime Bootstrap (30-45 min)

### Nowy plik: `core/initRuntime.ts`

```typescript
/**
 * initRuntime - Centralne miejsce startowe serwisów
 * 
 * Zasada: Każdy serwis z subskrypcją eventBus ma init/dispose.
 * Koniec ghostów na zawsze.
 */

import { eventBus } from './EventBus';
import { initConfessionService } from '../services/ConfessionService';

export interface RuntimeHandle {
  dispose(): void;
}

let initialized = false;

export function initRuntime(): RuntimeHandle {
  if (initialized) {
    console.warn('[Runtime] Already initialized, skipping');
    return { dispose: () => {} };
  }

  console.log('[Runtime] Initializing...');

  // Init services with subscriptions
  const confession = initConfessionService(eventBus);

  initialized = true;
  console.log('[Runtime] initialized');

  return {
    dispose() {
      confession.dispose();
      initialized = false;
      console.log('[Runtime] disposed');
    }
  };
}

export function isRuntimeInitialized(): boolean {
  return initialized;
}
```

### Gdzie wpiąć: `hooks/useCognitiveKernelLite.ts`

Dodać w sekcji REFS (około linii 159):
```typescript
const runtimeRef = useRef<RuntimeHandle | null>(null);
```

Dodać useEffect po bootstrapie identity (około linii 273):
```typescript
useEffect(() => {
  if (!runtimeRef.current) {
    runtimeRef.current = initRuntime();
  }
  return () => {
    // Nie dispose przy każdym renderze - tylko przy unmount całej aplikacji
  };
}, []);
```

**Warunek:** Po uruchomieniu w konsoli: `[Runtime] initialized`

---

## P0.2 - ConfessionService Refactor (45-60 min)

### Zmiany w `services/ConfessionService.ts`

**USUNĄĆ (linia 33-44):**
```typescript
private static instance: ConfessionService;

private constructor() {
    this.initialize();
}

public static getInstance(): ConfessionService {
    if (!ConfessionService.instance) {
        ConfessionService.instance = new ConfessionService();
    }
    return ConfessionService.instance;
}
```

**USUNĄĆ (linia 292):**
```typescript
export const confessionService = ConfessionService.getInstance();
```

**ZAMIENIĆ NA:**
```typescript
// Konstruktor publiczny, przyjmuje bus
public constructor(private bus: typeof eventBus) {
    this.subscriptions = [];
    this.initialize();
}

private subscriptions: Array<() => void> = [];

private initialize() {
    const unsub1 = this.bus.subscribe(PacketType.MOTOR_COMMAND, (packet: CognitivePacket) => {
        if (packet.source === AgentType.MOTOR && packet.payload?.action === 'SPEAK') {
            this.runConfessionProtocol(packet.payload.content);
        }
    });
    
    const unsub2 = this.bus.subscribe(PacketType.STATE_UPDATE, (packet: CognitivePacket) => {
        if (packet.payload?.neuro) this.neuroState = packet.payload.neuro;
        if (packet.payload?.limbic) this.limbicState = packet.payload.limbic;
    });
    
    this.subscriptions.push(unsub1, unsub2);
    console.log('[ConfessionService] v2.1 Pain-Based initialized.');
}

public dispose() {
    this.subscriptions.forEach(unsub => unsub());
    this.subscriptions = [];
    console.log('[ConfessionService] disposed');
}

// Factory function
export function initConfessionService(bus: typeof eventBus = eventBus): ConfessionService {
    return new ConfessionService(bus);
}
```

**Warunek:** Confession działa tylko gdy initRuntime() zostało wywołane

---

## P0.3 - Tool [SNAPSHOT] (45-60 min)

### Dodać w `utils/toolParser.ts` (po sekcji WORKSPACE TOOLS, około linii 403)

```typescript
// SNAPSHOT TOOL
// [SNAPSHOT] - Creates full system snapshot
const snapshotMatch = cleanText.match(/\[SNAPSHOT\]/i);
if (snapshotMatch) {
    cleanText = cleanText.replace(snapshotMatch[0], '').trim();
    const tool = 'SNAPSHOT';
    const intentId = generateUUID();

    eventBus.publish({
        id: intentId,
        timestamp: Date.now(),
        source: AgentType.CORTEX_FLOW,
        type: PacketType.TOOL_INTENT,
        payload: { tool },
        priority: 0.8
    });

    addMessage('assistant', 'Creating system snapshot...', 'action');
    setCurrentThought('Generating snapshot...');

    try {
        const agentId = deps.getActiveSessionId?.()?.split('_')[0] || 'unknown';
        const sessionId = deps.getActiveSessionId?.() || 'unknown';
        
        // Get kernel state from stateRef
        const kernelState = {
            conversation: [],
            limbicState: stateRef.current.limbicState || { fear: 0, curiosity: 0.5, frustration: 0, satisfaction: 0.5 },
            chemState: { dopamine: 50, serotonin: 50, norepinephrine: 50 },
            somaState: { energy: 80, cognitiveLoad: 20, isSleeping: false }
        };

        // Import dynamically to avoid circular deps
        const { exportFullSnapshot, saveSnapshotToDb } = await import('../services/SnapshotService');
        const snapshot = await exportFullSnapshot(agentId, sessionId, kernelState);
        
        // Try DB first, fallback to artifact
        const snapshotId = await saveSnapshotToDb(snapshot);
        
        if (snapshotId) {
            emitToolResult({ tool, intentId, payload: { snapshotId, savedToDb: true } });
            addMessage('assistant', `SNAPSHOT_OK: ${snapshotId} (saved to DB)`, 'tool_result');
        } else {
            // Fallback: create artifact
            const store = useArtifactStore.getState();
            const artifactName = `snapshot_${Date.now()}.json`;
            const artifactId = store.create(artifactName, JSON.stringify(snapshot, null, 2));
            emitToolResult({ tool, intentId, payload: { artifactId, savedToArtifact: true } });
            addMessage('assistant', `SNAPSHOT_OK: ${artifactId} (${artifactName})`, 'tool_result');
        }
    } catch (e: any) {
        emitToolError({ tool, intentId, payload: {}, error: e?.message || String(e) });
    }
}
```

**Warunek:** `[SNAPSHOT]` w rozmowie generuje artefakt/zapis DB

---

## P0.4 - Autonomia MAINTAIN (60-90 min)

### Zmiany w `core/systems/AutonomyRepertoire.ts`

**1. Dodać do typu AutonomyAction (linia 70-76):**
```typescript
export type AutonomyAction = 
  | 'CONTINUE'
  | 'CLARIFY'
  | 'SUMMARIZE'
  | 'EXPLORE'
  | 'WORK'
  | 'MAINTAIN'  // NEW: System maintenance mode
  | 'SILENCE';
```

**2. Dodać funkcję checkMaintenanceNeed (przed selectAction):**
```typescript
interface MaintenanceNeed {
  needed: boolean;
  reason: 'stale_conversation' | 'artifact_debt' | 'no_recent_snapshot' | null;
}

function checkMaintenanceNeed(grounding: GroundingAnalysis): MaintenanceNeed {
  // Reguła deterministyczna - brak pendingWork + (stale > 5min LUB artifactCount > 5 bez snapshota)
  
  const STALE_THRESHOLD_SEC = 300; // 5 min
  const ARTIFACT_DEBT_THRESHOLD = 5;
  
  // Check stale conversation
  if (grounding.isConversationStale && grounding.silenceDurationSec > STALE_THRESHOLD_SEC) {
    return { needed: true, reason: 'stale_conversation' };
  }
  
  // Check artifact debt
  const store = useArtifactStore.getState();
  const artifacts = store.list();
  const draftCount = artifacts.filter(a => a.status === 'draft').length;
  
  if (draftCount >= ARTIFACT_DEBT_THRESHOLD) {
    return { needed: true, reason: 'artifact_debt' };
  }
  
  return { needed: false, reason: null };
}
```

**3. Zmienić selectAction (linia 217-239):**
```typescript
export function selectAction(ctx: UnifiedContext): ActionDecision {
  const grounding = analyzeGrounding(ctx);
  getAutonomyConfig();

  const pendingWork = findPendingWork();
  
  // WORK ma priorytet
  if (pendingWork) {
    return {
      action: 'WORK',
      allowed: true,
      reason: `Pending work: ${pendingWork.artifactName} (${pendingWork.reason})`,
      groundingScore: 0.6,
      suggestedPrompt: buildActionPrompt('WORK', ctx, grounding, pendingWork)
    };
  }
  
  // MAINTAIN: deterministyczna reguła
  // Jeśli brak pendingWork I (stale > 5min LUB artifactDebt > 5)
  const maintenance = checkMaintenanceNeed(grounding);
  if (maintenance.needed) {
    return {
      action: 'MAINTAIN',
      allowed: true,
      reason: `Maintenance needed: ${maintenance.reason}`,
      groundingScore: 0.5,
      suggestedPrompt: buildActionPrompt('MAINTAIN', ctx, grounding)
    };
  }
  
  // Default: SILENCE
  return {
    action: 'SILENCE',
    allowed: true,
    reason: 'No pending work, no maintenance needed',
    groundingScore: 0
  };
}
```

**4. Dodać case MAINTAIN w buildActionPrompt (linia 283-329):**
```typescript
case 'MAINTAIN':
  return `
ACTION: MAINTAIN - System maintenance mode.
REASON: ${grounding.isConversationStale ? 'Conversation stale' : 'Artifact debt'}
INSTRUCTION: Create a system snapshot using [SNAPSHOT] tag.
Say: "Tworzę snapshot systemu dla zachowania stanu."
DO NOT: Start new topics. Just maintain.`;
```

**Warunek:** Brak pendingWork + stale → MAINTAIN zamiast SILENCE

---

## P0.5 - Testy (90-150 min)

### Nowy plik: `tests/toolParser.snapshot.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createProcessOutputForTools } from '../utils/toolParser';

describe('toolParser [SNAPSHOT]', () => {
  const mockDeps = {
    setCurrentThought: vi.fn(),
    addMessage: vi.fn(),
    setSomaState: vi.fn(),
    setLimbicState: vi.fn(),
    lastVisualTimestampRef: { current: 0 },
    visualBingeCountRef: { current: 0 },
    stateRef: { current: { limbicState: {} } },
    getActiveSessionId: () => 'test_session'
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should detect [SNAPSHOT] tag and emit tool intent', async () => {
    const processOutput = createProcessOutputForTools(mockDeps);
    const result = await processOutput('Some text [SNAPSHOT] more text');
    
    expect(result).not.toContain('[SNAPSHOT]');
    expect(mockDeps.addMessage).toHaveBeenCalledWith(
      'assistant',
      expect.stringContaining('snapshot'),
      expect.any(String)
    );
  });

  it('should handle [SNAPSHOT] case-insensitively', async () => {
    const processOutput = createProcessOutputForTools(mockDeps);
    const result = await processOutput('[snapshot]');
    
    expect(result).toBe('');
    expect(mockDeps.setCurrentThought).toHaveBeenCalled();
  });
});
```

### Nowy plik: `tests/AutonomyRepertoire.maintain.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { selectAction, analyzeGrounding } from '../core/systems/AutonomyRepertoire';
import type { UnifiedContext } from '../core/context';

// Mock artifact store
vi.mock('../stores/artifactStore', () => ({
  useArtifactStore: {
    getState: () => ({
      list: () => [],
      get: () => null
    })
  }
}));

describe('AutonomyRepertoire MAINTAIN', () => {
  const createMockContext = (overrides: Partial<UnifiedContext> = {}): UnifiedContext => ({
    dialogueAnchor: {
      recentTurns: [],
      topicSummary: 'No prior conversation',
      lastUserMessage: '',
      currentIntent: undefined
    },
    socialFrame: {
      silenceDurationSec: 0,
      turnCount: 0,
      lastSpeaker: 'user'
    },
    memoryAnchor: {
      episodes: [],
      semanticMatches: []
    },
    sessionMemory: {
      recentTopics: []
    },
    ...overrides
  });

  it('should return SILENCE when no pending work and conversation fresh', () => {
    const ctx = createMockContext({
      socialFrame: { silenceDurationSec: 60, turnCount: 5, lastSpeaker: 'user' }
    });
    
    const decision = selectAction(ctx);
    expect(decision.action).toBe('SILENCE');
  });

  it('should return MAINTAIN when stale > 5min and no pending work', () => {
    const ctx = createMockContext({
      socialFrame: { silenceDurationSec: 400, turnCount: 5, lastSpeaker: 'user' }
    });
    
    const decision = selectAction(ctx);
    expect(decision.action).toBe('MAINTAIN');
    expect(decision.reason).toContain('stale');
  });

  it('should have suggestedPrompt with [SNAPSHOT] for MAINTAIN', () => {
    const ctx = createMockContext({
      socialFrame: { silenceDurationSec: 400, turnCount: 5, lastSpeaker: 'user' }
    });
    
    const decision = selectAction(ctx);
    expect(decision.action).toBe('MAINTAIN');
    expect(decision.suggestedPrompt).toContain('SNAPSHOT');
  });
});
```

**Warunek:** `npm test` PASS

---

## Checklist końcowy

- [ ] `npm test` PASS
- [ ] `npm run build` PASS
- [ ] `[Runtime] initialized` w konsoli
- [ ] `[SNAPSHOT]` tworzy artefakt
- [ ] MAINTAIN wybierany przy stale > 5min
- [ ] Testy snapshot + maintain PASS

---

## Kolejność wykonania

1. **P0.0** - Pre-flight (zapisz wynik)
2. **P0.1** - `core/initRuntime.ts` + hook integration
3. **P0.2** - ConfessionService refactor
4. **P0.3** - [SNAPSHOT] tool w toolParser
5. **P0.4** - MAINTAIN w AutonomyRepertoire
6. **P0.5** - Testy
7. **Weryfikacja** - npm test + build + manual check

---

## P1 Preview (nie dzisiaj)

- `useKernelTick.ts` - pierwszy do wydzielenia z hooka
- `useKernelPersistence.ts` - drugi
- `useKernelAutonomy.ts` - trzeci (najbardziej splątany)
