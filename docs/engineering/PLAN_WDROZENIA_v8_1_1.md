# AK-FLOW PLAN WDROZENIA v8.1.1 (FINAL)
## Checklist wykonawczy per commit - bez kodu, bez interpretacji

---

# DIAGNOZA (przypomnienie)

> **"Anchor jest w state, ale nie jest w promptach. System ma pamiec, tylko jej nie pokazuje modelowi."**

---

# POPRAWIONA KOLEJNOSC (v8.1.1)

```
#3 Working Memory -> #4 Anchor Resolver -> #2 Tool Contract -> #5 Artifact Routing -> #6 Gate Unblock -> #1 Telemetry
```

**Dlaczego ta kolejnosc:**
- #2 przed #6: gate unblock zalezy od lastTool.ok i domknietego kontraktu
- #5 przed #6: gate bez poprawnego routingu wymusza speech po blednym toolu (spam)
- #1 na koncu: traceId i tak wchodzi w #2, telemetry to "dopalenie"

---

# KRYTYCZNE MINY DO UNIKNIECIA

| Mina | Rozwiazanie |
|------|-------------|
| anchors.json w `src/agent` | **NIE!** Runtime state + hydrate, nie pliki w repo |
| Heurystyka "dlugosc > 8 slow = explicit" | **NIE!** Tylko: cudzyslow, UUID, rozszerzenie, sciezka, `id=...` |
| Lokalne emitToolX w wielu plikach | **NIE!** Jeden modul `toolContract.ts` |
| Test bez izolacji eventBus | **NIE!** Reset/unsubscribe miedzy testami |
| Regex `art-[a-f0-9-]+` | **NIE!** Tylko pelny UUID pattern (8-4-4-4-12) |
| Gate unblock globalnie | **NIE!** Tylko user-facing ticks (w tym retry z tym samym traceId) |
| Brak clear anchor on error | **DODAJ!** NOT_FOUND -> anchor = null (tylko gdy error dotyczy anchorowanego ID) |
| Wiecej niz jeden close per intent | **NIE!** Exactly one RESULT/ERROR per intentId |

---

# COMMIT #3: WORKING MEMORY INJECT

## Pliki
- `src/core/kernel/types.ts`
- `src/core/kernel/initialState.ts`
- `src/llm/gemini/UnifiedContextPromptBuilder.ts` (lub realny builder)
- `__tests__/unit/WorkingMemoryState.test.ts` (nowy)

## Kroki

### 3.1 Dodaj pola WM do typu
```
CognitiveState {
  // Anchory
  lastLibraryDocId: string | null
  lastLibraryDocName: string | null
  lastLibraryDocChunkCount: number | null    // NOWE: ile chunkow ma dokument
  lastWorldPath: string | null
  lastArtifactId: string | null
  lastArtifactName: string | null

  // Kontekst domenowy
  activeDomain: 'WORLD' | 'LIBRARY' | 'ARTIFACT' | null   // NOWE: w jakiej domenie jestesmy

  // Ostatnie narzedzie
  lastTool: { tool: string, ok: boolean, at: number } | null
}
```

### 3.2 Dodaj do initialState
```
lastLibraryDocId: null
lastLibraryDocName: null
lastLibraryDocChunkCount: null
lastWorldPath: null
lastArtifactId: null
lastArtifactName: null
activeDomain: null
lastTool: null
```

### 3.3 W builderze: sekcja WM
- **DATA-ONLY** - zadnych regul typu "NIE rob X"
- Max **15 linii** w najgorszym przypadku
- Pokaz tylko pola ktore sa nie-null
- Format:
  ```
  ## TWOJ KONTEKST
  Domena: [WORLD/LIBRARY/ARTIFACT]
  Aktywna ksiazka: [name] (ID: [id], chunkow: [count])
  Ostatni katalog: [path]
  Ostatni artefakt: [name] (ID: [id])
  Ostatnie narzedzie: [tool] [ok/fail]

  Mozliwosci: WORLD (pliki), LIBRARY (dokumenty), ARTIFACTS
  ```

### 3.4 Capabilities
- 1-2 linie na koncu sekcji WM
- Bez szczegolow, bez instrukcji

## DoD
- [ ] Snapshot promptu zawiera sekcje WM gdy cokolwiek nie-null
- [ ] Sekcja WM <= 15 linii w najgorszym przypadku
- [ ] Brak instrukcji "NIE rob X" w sekcji WM
- [ ] WM wstrzykiwany w 100% tickow (user-facing i autonomy), ale renderowany tylko przy non-null polach
- [ ] `lastLibraryDocChunkCount` aktualizowany wylacznie z narzedzia, ktore zwraca chunkCount (bez zgadywania)
- [ ] activeDomain aktualizowane po kazdym TOOL_RESULT
- [ ] Test WorkingMemoryState.test.ts zielony
- [ ] `npx tsc --noEmit` przechodzi

---

# COMMIT #4: ANCHOR RESOLVER + UPDATE

## Pliki
- `src/core/systems/eventloop/ReactiveStep.ts` (lub centralny listener)
- `__tests__/unit/LibraryAnchorResolver.test.ts` (nowy)
- `__tests__/unit/WorldAnchorResolver.test.ts` (opcjonalnie)

## Kroki

### 4.1 Anchor update TYLKO po TOOL_RESULT/TOOL_ERROR
- **NIGDY** po intent
- **NIGDY** po speech
- Trigger: TOOL_RESULT z ok=true dla READ/LIST/CREATE

### 4.2 Clear anchor on critical error
- TOOL_ERROR z kodem: `NOT_FOUND`, `NO_DOC`, `NO_CHUNKS`, `MISSING_DOC`
- **WARUNEK**: clear TYLKO jesli blad dotyczy dokladnie anchorowanego id/path
  - Jesli error.docId === lastLibraryDocId -> clear
  - Jesli error.path === lastWorldPath -> clear
  - Inaczej -> nie ruszaj anchora (to moze byc rownolegla akcja)
- Akcja: `lastLibraryDocId = null` (lub odpowiedni anchor)
- **Bez tego bedzie "flapping" anchorow**

### 4.3 Resolver cross-domain
Priorytety (od najwyzszego):
1. **Jawne ID/sciezka/nazwa** -> uzyj jawnie, ignoruj anchor
2. **Wzorzec jezykowy + anchor istnieje** -> uzyj anchor
3. **Brak anchor** -> fallback (SEARCH/ask)

### 4.4 Wykrywanie jawnosci (TYLKO te warunki)
- Cudzyslow: `"..."`, `'...'`, `„..."`
- Pelne UUID: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`
- Rozszerzenie pliku: `.txt`, `.md`, `.pdf`, `.doc`
- Sciezka: zawiera `/` lub `\`
- Prefix art-UUID: `art-xxxxxxxx-xxxx-...`
- DocId format: UUID pattern
- **NOWE**: Explicit ID pattern: `docId=...`, `id:...`, `ID: ...`

**NIE uzywaj:**
- Dlugosci inputu (> N slow)
- Heurystyk "wyglada jak nazwa"

### 4.5 Wzorce jezykowe dla anchor
Library:
- "ta ksiazka", "tej ksiazki", "tego dokumentu"
- "chunki", "fragmenty", "tresc"
- "co jest w...", "o czym..."

World:
- "tam", "tutaj", "w tym folderze/katalogu"
- "co jest w tym..."

Artifact:
- "ten plik", "ten artefakt", "ta notatka"

## DoD
- [ ] "ta ksiazka" po READ_LIBRARY_DOC -> LIST_LIBRARY_CHUNKS bez SEARCH (10/10)
- [ ] "w tym folderze" po LIST_DIR -> LIST_DIR na anchor (10/10)
- [ ] Jawne "/code" ZAWSZE omija anchor
- [ ] Jawne "Reinforcement Learning.txt" omija anchor
- [ ] TOOL_ERROR NOT_FOUND -> anchor cleared
- [ ] Testy resolvera zielone
- [ ] `npx tsc --noEmit` przechodzi

---

# COMMIT #2: TOOL CONTRACT (SINGLE SOURCE)

## Pliki
- `src/core/telemetry/toolContract.ts` (NOWY - jedno zrodlo prawdy)
- `src/tools/workspaceTools.ts` (usun lokalne emitery)
- `src/core/systems/eventloop/ReactiveStep.ts` (uzyj toolContract)
- `__tests__/contracts/ToolContractGate.test.ts` (nowy)

## Kroki

### 2.1 Jeden modul toolContract.ts
```
Eksportuje:
- withToolContract(tool, arg, fn) -> Promise<Result>
- emitToolIntent(tool, arg) -> intentId
- emitToolResult(tool, intentId, result)
- emitToolError(tool, intentId, arg, error)
```

### 2.2 Uzyj WSZEDZIE
- World tools (workspaceTools.ts)
- Library tools (ReactiveStep.ts - read/list/search)
- Artifact tools (gdzie sa)

### 2.3 Usun lokalne emitery
- Wywal `const emitToolIntent = ...` z poszczegolnych plikow
- Import tylko z toolContract.ts

### 2.4 Zero "return przed close" + EXACTLY ONE close
- Kazda sciezka w toolu konczy sie RESULT lub ERROR
- **EXACTLY ONE** close per intentId (nie "co najmniej jeden")
- Dubel RESULT/ERROR = bug (gate zacznie wariowac)
- Uzyj try-finally lub wrapper z flaga `closed`

### 2.5 Test z izolacja eventBus
- beforeEach: reset struktur (intents map, results set)
- afterAll: unsubscribe wszystkich listenerow
- **Minimum 20 uruchomien lokalnie bez flake**
- Dodaj asercje: kazdy intentId ma dokladnie 1 close

## DoD
- [ ] INTENT == RESULT + ERROR w logach z 1 scenariusza integracyjnego
- [ ] **Kazdy intentId ma EXACTLY ONE close** (nie wiecej, nie mniej)
- [ ] ToolContractGate test nie flakuje (min 20 runow)
- [ ] Brak orphanow dla SEARCH/LIST/READ w logach
- [ ] Brak lokalnych emitToolX poza toolContract.ts
- [ ] `npx tsc --noEmit` przechodzi

---

# COMMIT #6: GATE UNBLOCK (USER-FACING ONLY)

## Pliki
- `src/core/systems/ExecutiveGate.ts`
- `src/core/systems/ActionSelector.ts`
- `__tests__/integration/NoEmptySpeechOnToolSuccess.test.ts` (nowy)

## Kroki

### 6.1 Rozroznienie tickow - definicja isUserFacing
Dodaj flage w kontekscie ticka:
- `isUserFacing: boolean`
- **true gdy:**
  - Jest user input w tym ticku, LUB
  - Tool uruchomiony jako odpowiedz na user input, LUB
  - **NOWE**: Tick jest kontynuacja user requestu (retry po parse error) i ma **ten sam traceId** co poprzedni user input

**Bez warunku traceId:** user pyta -> tool poszedl -> parse error -> retry juz "autonomy" -> znow cisza

### 6.2 Logika gate
```
Jesli isUserFacing AND lastTool.ok === true:
  -> speech WYMAGANY
  -> nie moze byc EMPTY_SPEECH

Jesli NIE isUserFacing (autonomia):
  -> speech moze byc pusty
  -> nie odblokuj globalnie
```

### 6.3 Dodatkowy warunek (z #5)
```
Speech required TYLKO gdy tool byl poprawnie zmapowany domenowo:
  - Jesli routing -> WORLD, ale tool ARTIFACT -> nie wymuszaj speech
  - To lapie bledy z #5 zanim wejda w #6
```

### 6.4 ActionSelector
```
Jesli isUserFacing:
  -> domyslna akcja = ACT
  -> nie NOTE, nie OBSERVE
```

### 6.5 Format odpowiedzi (minimalny)
Po TOOL_RESULT ok=true wymagaj:
- Co zrobiono: "Wykonalem [TOOL]"
- Co zobaczono: "Wynik: ..."
- (opcjonalnie) Nastepny krok

## DoD
- [ ] EMPTY_SPEECH po TOOL_RESULT(ok=true) == 0 dla user-facing tickow
- [ ] W autonomii nadal moze byc cisza (brak wzrostu spamu)
- [ ] Ratio ACT/note w user-facing > 80%
- [ ] **Retry po parse error (ten sam traceId) tez jest user-facing**
- [ ] `lastTool.domainExpected === lastTool.domainActual` zapisane przy wykonaniu toola i uzywane przez gate
- [ ] Test NoEmptySpeechOnToolSuccess zielony
- [ ] `npx tsc --noEmit` przechodzi

---

# COMMIT #5: ARTIFACT ROUTING (PRE-ROUTING)

## Pliki
- `src/tools/toolParser.ts`
- `__tests__/unit/ArtifactRouting.test.ts` (nowy)

## Kroki

### 5.1 Regex dla artifact - PELNY UUID (8-4-4-4-12)
```
TYLKO: art-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
NIE: art-[a-f0-9-]+ (za szeroki)
```

Pattern: `/^art-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i`

### 5.2 Routing order (POPRAWIONY)
1. **Jawna sciezka** (zawiera `/` lub `\`) -> **WORLD** (zawsze, nawet jesli zawiera "art-")
2. **Pelny art-UUID** -> ARTIFACT
3. **Pelny doc UUID** -> LIBRARY
4. **Anchor resolver** -> uzywa anchorow

**Sciezka jest najbardziej jednoznaczna i najczesciej przypadkiem zawiera "art-"**

### 5.3 Anty-false-positive
Jesli tekst zawiera sciezke (/ lub `\`):
- `/code/art-folder/file.txt` -> WORLD (nie ARTIFACT)
- `/art-123/data` -> WORLD (nie ARTIFACT)
- `C:\art-project\file` -> WORLD (nie ARTIFACT)

**Warunek: jesli jest `/` lub `\` -> to sciezka, WORLD wygrywa**

## DoD
- [ ] "art-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" -> ARTIFACT
- [ ] "/code/art-123" -> WORLD (nie ARTIFACT)
- [ ] "art-folder" -> WORLD (nie ARTIFACT, bo nie pelne UUID)
- [ ] "/art-uuid-like-path/" -> WORLD (sciezka wygrywa)
- [ ] Testy zielone
- [ ] `npx tsc --noEmit` przechodzi

---

# COMMIT #1: TELEMETRY (KORELACJA)

## Pliki
- `src/tools/workspaceTools.ts`
- `src/core/telemetry/toolContract.ts`
- `src/core/trace/TraceContext.ts` (jesli istnieje)

## Kroki

### 1.1 Kazdy log entry zawiera
- `traceId` lub `tickId` (ten sam przez caly tick)
- `intentId`
- `tool`
- `path/arg`
- `timestamp`

### 1.2 Korelacja
Ten sam traceId idzie przez:
- User input -> Tool intent -> Tool result/error -> Speech

## DoD
- [ ] Dla jednego user request da sie przesledzic caly flow po traceId
- [ ] Kazde wywolanie WORLD toola ma log z traceId
- [ ] `npx tsc --noEmit` przechodzi

---

# HARMONOGRAM DZIENNY

## Tydzien 1: Faza 0-1 (Stabilizacja + Working Memory)

| Dzien | Commit | Zadania |
|-------|--------|---------|
| 1 | Baseline | `npm test` - spisz wszystkie fail'e |
| 1 | Baseline | **NOWE**: uruchom ToolContractGate 10x - zapisz czy flakuje |
| 1 | #3 | types.ts + initialState.ts (z activeDomain, chunkCount) |
| 2 | #3 | UnifiedContextPromptBuilder - sekcja WM |
| 2 | #3 | Test WorkingMemoryState.test.ts |
| 3 | #4 | Anchor update po TOOL_RESULT (z activeDomain) |
| 3 | #4 | Clear anchor on error (tylko gdy error.id === anchor.id) |
| 4 | #4 | Resolver - wykrywanie jawnosci (+ `id=...` pattern) |
| 4 | #4 | Resolver - wzorce jezykowe |
| 5 | #4 | Testy LibraryAnchorResolver |
| 5 | - | Manual test: "ta ksiazka" flow |

## Tydzien 2: Faza 2 (Kontrakt + Routing + Gate)

| Dzien | Commit | Zadania |
|-------|--------|---------|
| 1 | #2 | toolContract.ts - modul (exactly one close) |
| 1 | #2 | Migracja workspaceTools.ts |
| 2 | #2 | Migracja ReactiveStep.ts (library tools) |
| 2 | #2 | Test ToolContractGate z izolacja (20 runow) |
| 3 | #5 | Artifact routing - regex (pelny UUID) |
| 3 | #5 | Artifact routing - sciezka zawsze wygrywa |
| 4 | #6 | ExecutiveGate - isUserFacing (z traceId continuity) |
| 4 | #6 | ActionSelector - domyslnie ACT |
| 5 | #6 | Test NoEmptySpeechOnToolSuccess |
| 5 | #1 | Telemetry - traceId |

---

# TESTY PO KAZDYM COMMICIE

## Automatyczne
```bash
npx tsc --noEmit
npm test -- --passWithNoTests
```

## Manual (1 scenariusz)
```
1. READ_LIBRARY_DOC -> "ta ksiazka" -> LIST_LIBRARY_CHUNKS bez SEARCH
2. LIST_DIR -> "w tym folderze" -> LIST_DIR na anchor
3. CREATE artifact -> "przeczytaj" -> READ_ARTIFACT (nie READ_FILE)
```

---

# FAZA 3-4: AUTONOMIA (Tydzien 3-4)

## Tydzien 3: Anchors v0 + Outcome

### Anchors jako runtime state (NIE pliki)
- Przechowywanie: istniejacy state + hydrate (Supabase/memory)
- NIE: `src/agent/anchors.json`
- Format:
  ```
  anchors: {
    activeGoalId: string | null
    lastTool: { tool, path, ok, timestamp } | null
    focus: { type, id, label } | null
    lastErrorCode: string | null
    lastCommit: string | null
  }
  ```

### Outcome/Friction record
- Zrodlo: EventBus + tick events
- Metryki:
  - toolFailures: count TOOL_ERROR
  - retries: count RETRY events
  - ambiguityHits: count AMBIGUOUS/MISSING_ANCHOR
  - parseErrors: count JSON_PARSE_ERROR

### DoD Tydzien 3
- [ ] Anchor stabilny miedzy tickami
- [ ] Anchor wstrzykiwany do promptu (przez WM)
- [ ] Metryki success rate + friction dostepne
- [ ] Brak plikow w `src/` dla runtime state

## Tydzien 4: Behavior Deltas

### Struktura
```
behaviorState: {
  confidence: number (0-1)
  caution: number (0-1)
  exploration: number (0-1)
}
```

### Zasady
- Delty CLAMPOWANE: max +/-0.05 na tick
- Feature flag: `ENABLE_BEHAVIOR_DELTAS=false` domyslnie
- Rollback: mozliwosc resetu do baseline
- Zrodlo delt: TYLKO outcome (success/fail), nie speech

### Wplyw na zachowanie
- Emocje wplywaja na WYBOR AKCJI
- Emocje NIE wplywaja na styl mowy
- Homeostaza > roleplay

### DoD Tydzien 4
- [ ] Delty aplikowane tylko gdy feature flag ON
- [ ] Rollback dziala
- [ ] Zachowanie zmienne, ton staly
- [ ] Tydzien zielonych testow przed wlaczeniem

---

# METRYKI SUKCESU

## Twarde (z logow)

| Metryka | Przed | Cel |
|---------|-------|-----|
| MISSING_LIBRARY_ANCHOR po READ | >0 | 0 |
| SEARCH_LIBRARY mimo anchor | >0 | 0 |
| TOOL_RESULT + EMPTY_SPEECH (user-facing) | >0 | 0 |
| Orphan TOOL_INTENT | 1+ | 0 |
| Dubel RESULT/ERROR per intent | ? | 0 |
| ACT ratio (user-facing) | ~0% | >80% |
| Tool success rate | ? | >80% |
| Friction score | ? | <0.3 |

## Kluczowa metryka: "Koniec glupich pytan"

> **Po udanym READ_LIBRARY_DOC, kolejne 3 ticki NIE MOGA zawierac pytania o tytul ksiazki.**

To jest wprost Twoj bol. Test:
```
1. READ_LIBRARY_DOC "Reinforcement Learning..."
2. User: "co jest w tej ksiazce?"
3. Agent NIE pyta "o jaka ksiazke chodzi?" (przez 3 ticki)
```

## Manual (10 prob)

| Test | Cel |
|------|-----|
| "Ta ksiazka" po READ_LIBRARY_DOC | 10/10 bez SEARCH |
| "Pokaz chunki" po READ_LIBRARY_DOC | 10/10 bez pytania |
| "W tym folderze" po LIST_DIR | 10/10 uzywa anchor |
| READ_ARTIFACT art-uuid | 10/10 nie READ_FILE |
| Jawna nazwa omija anchor | 10/10 |
| **3 ticki bez pytania o tytul po READ** | 10/10 |

---

# RYZYKA I MITYGACJE

| Ryzyko | Mitygacja |
|--------|-----------|
| Lokalne emitery wroca | Code review: grep na emitTool poza toolContract |
| Test flaky | Izolacja eventBus, **20+ runow przed merge**, baseline 10x na start |
| Anchor martwy (stale) | Clear on critical error (tylko gdy error.id === anchor.id) |
| Anchor flapping | Clear tylko przy match z anchorowanym ID |
| False positive artifact | Tylko pelny UUID pattern (8-4-4-4-12) |
| Sciezka z "art-" | Routing: sciezka (/ lub \\) zawsze wygrywa |
| Spam w autonomii | Gate unblock tylko user-facing |
| Retry = cisza | isUserFacing = true gdy ten sam traceId |
| Dubel RESULT/ERROR | Exactly one close per intentId |
| Dryf zachowania | Feature flag + clamp + rollback |
| WM za dlugie | Limit 15 linii, data-only |
| Heurystyka dlugosci | Usunieta, tylko jawne patterny |

---

# JEDNO ZDANIE

> **"Jeden modul toolContract z exactly-one-close, anchory w runtime state, sciezka zawsze wygrywa w routingu, gate unblock tylko user-facing (w tym retry z tym samym traceId), resolver bez heurystyk dlugosci."**

---

# KLUCZOWA METRYKA (nowa)

> **Po udanym READ_LIBRARY_DOC, kolejne 3 ticki NIE zawieraja pytania o tytul ksiazki.**

To jest test na "koniec glupich pytan".

---

# CHECKLIST PRZED KAZDYM MERGE

- [ ] `npx tsc --noEmit` zielone
- [ ] `npm test` zielone
- [ ] Manual scenario przechodzi
- [ ] Brak nowych lokalnych emitToolX
- [ ] Brak plikow runtime w `src/`
- [ ] DoD commita spelnione
- [ ] Code review przez druga osobe
