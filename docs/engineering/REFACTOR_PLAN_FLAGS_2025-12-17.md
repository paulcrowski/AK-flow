# AK-FLOW FLAG REFACTORING PLAN 13/10
## "Dać w pysk Karpathy'emu"
### 2025-12-17

---

## EXECUTIVE SUMMARY

```
╔══════════════════════════════════════════════════════════════════════════════╗
║                                                                              ║
║   PROBLEM: 17 feature flags = 131,072 możliwych kombinacji stanów           ║
║   KARPATHY: "Za dużo przełączników. Każda flaga to potencjalny bug."        ║
║                                                                              ║
║   ROZWIĄZANIE: 5 GŁÓWNYCH FLAG + reszta hardcoded jako sub-config           ║
║   CEL: Uprościć, nie usunąć funkcjonalność                                  ║
║                                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

---

## I. OBECNY STAN (17 FLAG)

### Flagi WŁĄCZONE (13)
| # | Flaga | Cel | Propozycja |
|---|-------|-----|------------|
| 1 | `USE_MINIMAL_CORTEX_PROMPT` | Persona-less LLM | → `cortex.minimalPrompt` (hardcoded ON) |
| 2 | `USE_ONE_MIND_PIPELINE` | Trace+Gate+Memory | → **`ONE_MIND_ENABLED`** (MAIN) |
| 3 | `USE_TRACE_AUTO_INJECT` | Auto traceId | → `oneMind.traceAutoInject` (sub) |
| 4 | `USE_TRACE_HANDLER_SCOPE` | Handler propagation | → `oneMind.traceHandlerScope` (sub) |
| 5 | `USE_TRACE_EXTERNAL_IDS` | External IDs | → `oneMind.traceExternalIds` (sub) |
| 6 | `USE_TRACE_MISSING_ALERT` | Missing trace alert | → `oneMind.traceMissingAlert` (sub) |
| 7 | `USE_CONV_SUPABASE_FALLBACK` | DB conversation | → `memory.supabaseFallback` (sub) |
| 8 | `USE_MEMORY_RECALL_RECENT_FALLBACK` | Recent recall | → `memory.recallRecentFallback` (sub) |
| 9 | `USE_SEARCH_KNOWLEDGE_CHUNKS` | Search learning | → `memory.searchKnowledgeChunks` (sub) |
| 10 | `USE_SEARCH_KNOWLEDGE_CHUNK_HOMEOSTASIS` | Chunk homeostasis | → `memory.chunkHomeostasis` (sub) |
| 11 | `USE_GLOBAL_RECALL_DEFAULT` | Global baseline | → `memory.globalRecallDefault` (sub) |
| 12 | `USE_GROUNDED_STRICT_MODE` | Force evidence | → **`GROUNDED_MODE`** (MAIN) |
| 13 | `USE_DREAM_TOPIC_SHARDS` | Dream consolidation | → **`DREAM_ENABLED`** (MAIN) |

### Flagi WYŁĄCZONE (4 - future features)
| # | Flaga | Status | Propozycja |
|---|-------|--------|------------|
| 14 | `USE_CORTEX_STATE_BUILDER` | ❌ OFF | → `cortex.stateBuilder` (future) |
| 15 | `USE_META_STATE_HOMEOSTASIS` | ❌ OFF | → `cortex.metaStateHomeostasis` (future) |
| 16 | `USE_IDENTITY_COHERENCE_CHECK` | ❌ OFF | → `cortex.identityCoherence` (future) |
| 17 | `USE_STYLE_EXAMPLES` | ❌ OFF | → `cortex.styleExamples` (future) |

---

## II. NOWA ARCHITEKTURA (5 GŁÓWNYCH FLAG)

### 5 MASTER FLAGS

```typescript
features: {
  /** MASTER: ONE MIND architecture (trace+gate+memory) */
  ONE_MIND_ENABLED: true,

  /** MASTER: Force evidence from memory/tools (no hallucinations) */
  GROUNDED_MODE: true,

  /** MASTER: Allow autonomous speech without user prompt */
  AUTONOMY_ENABLED: true,

  /** MASTER: Dream consolidation & topic shards */
  DREAM_ENABLED: true,

  /** MASTER: Verbose logging + trace overlay */
  DEBUG_MODE: false,
}
```

### SUB-CONFIG (hardcoded when parent ON)

```typescript
oneMind: {
  traceAutoInject: true,      // Był: USE_TRACE_AUTO_INJECT
  traceHandlerScope: true,    // Był: USE_TRACE_HANDLER_SCOPE
  traceExternalIds: true,     // Był: USE_TRACE_EXTERNAL_IDS
  traceMissingAlert: true,    // Był: USE_TRACE_MISSING_ALERT
},

memory: {
  supabaseFallback: true,       // Był: USE_CONV_SUPABASE_FALLBACK
  recallRecentFallback: true,   // Był: USE_MEMORY_RECALL_RECENT_FALLBACK
  globalRecallDefault: true,    // Był: USE_GLOBAL_RECALL_DEFAULT
  searchKnowledgeChunks: true,  // Był: USE_SEARCH_KNOWLEDGE_CHUNKS
  chunkHomeostasis: true,       // Był: USE_SEARCH_KNOWLEDGE_CHUNK_HOMEOSTASIS
},

cortex: {
  minimalPrompt: true,          // Był: USE_MINIMAL_CORTEX_PROMPT (always ON)
  stateBuilder: false,          // Był: USE_CORTEX_STATE_BUILDER (future)
  metaStateHomeostasis: false,  // Był: USE_META_STATE_HOMEOSTASIS (future)
  identityCoherence: false,     // Był: USE_IDENTITY_COHERENCE_CHECK (future)
  styleExamples: false,         // Był: USE_STYLE_EXAMPLES (future)
},
```

---

## III. MAPOWANIE MIGRACJI

### Tabela konwersji

| Stara flaga | Nowy accessor | Typ |
|-------------|---------------|-----|
| `USE_ONE_MIND_PIPELINE` | `isFeatureEnabled('ONE_MIND_ENABLED')` | MAIN |
| `USE_TRACE_AUTO_INJECT` | `isOneMindSubEnabled('traceAutoInject')` | SUB |
| `USE_TRACE_HANDLER_SCOPE` | `isOneMindSubEnabled('traceHandlerScope')` | SUB |
| `USE_TRACE_EXTERNAL_IDS` | `isOneMindSubEnabled('traceExternalIds')` | SUB |
| `USE_TRACE_MISSING_ALERT` | `isOneMindSubEnabled('traceMissingAlert')` | SUB |
| `USE_CONV_SUPABASE_FALLBACK` | `isMemorySubEnabled('supabaseFallback')` | SUB |
| `USE_MEMORY_RECALL_RECENT_FALLBACK` | `isMemorySubEnabled('recallRecentFallback')` | SUB |
| `USE_GLOBAL_RECALL_DEFAULT` | `isMemorySubEnabled('globalRecallDefault')` | SUB |
| `USE_SEARCH_KNOWLEDGE_CHUNKS` | `isMemorySubEnabled('searchKnowledgeChunks')` | SUB |
| `USE_SEARCH_KNOWLEDGE_CHUNK_HOMEOSTASIS` | `isMemorySubEnabled('chunkHomeostasis')` | SUB |
| `USE_GROUNDED_STRICT_MODE` | `isFeatureEnabled('GROUNDED_MODE')` | MAIN |
| `USE_DREAM_TOPIC_SHARDS` | `isFeatureEnabled('DREAM_ENABLED')` | MAIN |
| `USE_MINIMAL_CORTEX_PROMPT` | `isCortexSubEnabled('minimalPrompt')` | SUB (always ON) |

### Backward Compatibility Layer

```typescript
// LEGACY_FLAG_MAP - do usunięcia po pełnej migracji
const LEGACY_FLAG_MAP: Record<string, () => boolean> = {
  'USE_ONE_MIND_PIPELINE': () => isFeatureEnabled('ONE_MIND_ENABLED'),
  'USE_TRACE_AUTO_INJECT': () => isOneMindSubEnabled('traceAutoInject'),
  'USE_GROUNDED_STRICT_MODE': () => isFeatureEnabled('GROUNDED_MODE'),
  'USE_DREAM_TOPIC_SHARDS': () => isFeatureEnabled('DREAM_ENABLED'),
  // ... rest
};

/** @deprecated Use new flag system */
export function isLegacyFeatureEnabled(flag: string): boolean {
  const mapper = LEGACY_FLAG_MAP[flag];
  if (mapper) return mapper();
  console.warn(`[FeatureFlags] Unknown legacy flag: ${flag}`);
  return false;
}
```

---

## IV. PLIKI DO MODYFIKACJI

### Faza 1: Config refactor

| Plik | Akcja | LOC zmiana |
|------|-------|------------|
| `core/config/systemConfig.ts` | Reorganizacja features → 5 main + sub-configs | ~-50 |
| `core/config/featureFlags.ts` | Nowe helpery + LEGACY_FLAG_MAP | ~+30 |

### Faza 2: Migracja użyć (grep wyniki)

```bash
# Pliki używające isFeatureEnabled() - do aktualizacji
grep -r "isFeatureEnabled" --include="*.ts" | wc -l
# Szacunek: ~40 miejsc do aktualizacji
```

| Plik | Użycia | Priorytet |
|------|--------|-----------|
| `core/systems/EventLoop.ts` | ~8 | P0 |
| `core/systems/CortexSystem.ts` | ~6 | P0 |
| `hooks/useCognitiveKernelLite.ts` | ~4 | P0 |
| `services/DreamConsolidationService.ts` | ~2 | P1 |
| `core/systems/TickCommitter.ts` | ~2 | P1 |
| `core/context/UnifiedContextBuilder.ts` | ~2 | P1 |
| Pozostałe | ~16 | P2 |

---

## V. PLAN WYKONANIA

### Dzień 1: Przygotowanie

```
□ 1.1 Backup obecnych plików config
□ 1.2 Stwórz nową strukturę w systemConfig.ts
□ 1.3 Dodaj LEGACY_FLAG_MAP w featureFlags.ts
□ 1.4 npm test - upewnij się że backward compat działa
```

### Dzień 2: Migracja krytycznych plików

```
□ 2.1 EventLoop.ts - zamień USE_ONE_MIND_PIPELINE → ONE_MIND_ENABLED
□ 2.2 CortexSystem.ts - zamień USE_GROUNDED_STRICT_MODE → GROUNDED_MODE
□ 2.3 TickCommitter.ts - sprawdź użycia
□ 2.4 npm test
```

### Dzień 3: Migracja pozostałych + cleanup

```
□ 3.1 Migruj pozostałe pliki z LEGACY_FLAG_MAP
□ 3.2 Usuń LEGACY_FLAG_MAP gdy wszystko zmigrane
□ 3.3 Usuń stare definicje flag z systemConfig.features
□ 3.4 npm test - pełny suite
□ 3.5 Zmierz redukcję LOC
```

---

## VI. DODATKOWE PORZĄDKI (BONUS)

### A. Konsolidacja conversationSnapshot.ts

```
PROBLEM: conversationSnapshot.ts to osobny plik ~140 LOC
         ConversationArchive.ts robi to samo dla Supabase

ROZWIĄZANIE: 
1. Przenieś funkcje do MemorySpace.ts
2. conversationSnapshot → localStorage fallback only
3. ConversationArchive → Supabase primary
4. Unified interface w MemorySpace
```

### B. Usunięcie @deprecated

```bash
# Znajdź deprecated kod
grep -r "@deprecated\|DEPRECATED" --include="*.ts" .

# Szacunek: ~6 miejsc z lokalnymi stałymi zamiast SYSTEM_CONFIG
```

### C. Usunięcie martwego kodu

```
□ serializeConversationSnapshot() - nigdzie nie używana
□ Lokalne CONFIG w ChemistryBridge.ts
□ Lokalne CONFIG w FactEchoPipeline.ts
□ Lokalne CONFIG w GoalSystem.ts
```

---

## VII. METRYKI SUKCESU

### Przed

```
Feature flags: 17
Kombinacji stanów: 131,072
Plików config: 2 (systemConfig + featureFlags)
LOC config: ~680
```

### Po

```
Feature flags: 5 MAIN
Kombinacji stanów: 32
Plików config: 2 (bez zmian)
LOC config: ~550 (-19%)
```

### Jakość

```
□ Wszystkie 517 testów przechodzą
□ Backward compatibility przez LEGACY_FLAG_MAP
□ Jasna dokumentacja które flagi są MAIN vs SUB
□ Łatwiejsze debugowanie (5 stanów do sprawdzenia)
```

---

## VIII. ODPOWIEDŹ DLA KARPATHY'EGO

> **Karpathy:** "Za dużo przełączników. Każda flaga to potencjalny bug."

**Nasza odpowiedź:**

```
╔══════════════════════════════════════════════════════════════════════════════╗
║                                                                              ║
║  "Andrej, masz rację. Uprościliśmy z 17 do 5 głównych flag.                 ║
║                                                                              ║
║   🎯 ONE_MIND_ENABLED    - całe trace/gate/memory pipeline                  ║
║   🎯 GROUNDED_MODE       - wymuszanie dowodów                               ║
║   🎯 AUTONOMY_ENABLED    - mowa bez promptu                                 ║
║   🎯 DREAM_ENABLED       - konsolidacja pamięci                             ║
║   🎯 DEBUG_MODE          - verbose logging                                  ║
║                                                                              ║
║   Reszta to sub-config hardcoded TRUE gdy parent ON.                        ║
║   131,072 kombinacji → 32 kombinacji.                                       ║
║                                                                              ║
║   Czy to wystarczy, czy chcesz żebyśmy jeszcze bardziej uprościli?"         ║
║                                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

---

## IX. KOLEJNE KROKI PO FLAGACH

### P1: Memory Consolidation
- Przenieś `conversationSnapshot.ts` → `MemorySpace.ts`
- Unified interface dla localStorage + Supabase

### P2: Legacy Cleanup
- Usuń @deprecated funkcje
- Usuń lokalne CONFIG (użyj SYSTEM_CONFIG)

### P3: World Model (Wizja)
- Dodaj `WorldModel.ts` - planowanie do przodu
- Dodaj `HierarchicalGoals.ts` - dekompozycja celów
- Dodaj `EmotionTrajectory.ts` - emocje jako trajektorie

---

*Plan przygotowany: 2025-12-17*
*Autor: Windsurf Agent*
*Dla: AK-FLOW Development Team*
*Status: GOTOWY DO IMPLEMENTACJI*
