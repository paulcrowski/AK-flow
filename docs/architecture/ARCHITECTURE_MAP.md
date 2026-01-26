# 🧠 AK-FLOW Architecture Map

> **Wersja:** 6.11.3 (2026-01-26)
> **Cel:** Prosta mapa jak działa agent i jaki ma flow

## Archive policy

`docs/_archive/` to kwarantanna na historyczne pliki (LEGACY) – **nie używać w produkcji**.
Ten katalog jest wykluczony z kompilacji TypeScript i służy wyłącznie jako referencja do poprzednich iteracji.

---

## FAZA 6.11.3: Security gate + tooling hardening (2026-01-26)

**Cel:** wprowadzic twarde guardrails security i przygotowac workflow narzedziowy pod CI/local hooks.

**Mechanika:**
- CODEX.md jako gate przed taskiem + pre-commit hooks dla skanerow/testow/typow.
- Claude Code Action w PR jako automatyczny reviewer.
- Supabase: env-only config (bez sekretow w kodzie), File System Access typings, guard `createWritable`.

## FAZA 6.11.2: EventLoop plumbing + auto-search reliability (2026-01-26)

**Cel:** poprawic obserwowalnosc auto-search i zmniejszyc coupling EventLoop bez zmiany zachowania.

**Mechanika:**
- Auto-search uzywa wspolnego executora; TOOL_INTENT zawsze konczy sie TOOL_RESULT/TOOL_ERROR; intel/tool_result widoczne w UI.
- EventLoop rozbity na observation utils/tool cost helpers i library reactive handlers; tool routing helpers wydzielone.
- EventLoop defaults przeniesione do systemConfig; usuniete module-level cache w core/systems.

## FAZA 6.11.1: v8.2 Focus + Tool Contracts + Deterministic Follow-ups (2026-01-25)

**Cel:** ustabilizowac focus/cursor w kernelu i deterministyczne follow-upy dla biblioteki.

**Mechanika:**
- Tool contract validation jako mapa + warning dla nieznanych tooli.
- Focus/cursor w KernelState, match checks dla LIST/READ chunk i czyszczenie po errorach.
- Resolver uzywa focus; needsChunks guard (AND) z backstopem chunksKnownForDocId; focus widoczny w working memory.

## FAZA 6.11.0: v8.1.1 Refinement - Gate & Domain (2026-01-15)

**Cel:** uszczelnić Executive Gate dla interakcji z użytkownikiem i naprawić desync stanu domeny.

**Mechanika:**
- **isUserFacing**: tryb "frontowy" wymuszany przez input usera lub świeży wynik narzędzia (<2s).
- **Domain Match**: Kernel weryfikuje czy domena z rutingu (expected) zgadza się z wykonaniem (actual).
- **Hard Gate**: `DOMAIN_MISMATCH` blokuje mowę w trybie user-facing; `SPEECH_REQUIRED_AFTER_TOOL_SUCCESS` wymusza domknięcie pętli.
- **Trace Continuity**: retrie i ponowne próby zachowują ten sam `traceId` dla spójności telemetrii.

## FAZA 6.10.8: Working Memory + Anchor Resolver (2026-01-13)

**Cel:** pokazac modelowi aktywne anchory i deterministycznie rozpoznawac "ta ksiazka/tutaj" bez SEARCH.

**Mechanika:**
- Working memory section w promptach: lastLibraryDocId/lastWorldPath/lastArtifactId + zasady dostepu.
- Resolver niejawnych referencji dla library/world/artifact; poszerzone wzorce fraz.
- Tool contract domkniety + odblokowanie mowy po sukcesie; ActionSelector domyslnie ACT przy user input.
- Routing artefaktow (art-uuid) utwardzony + telemetria entry dla world tools.

## FAZA 6.10.7: Tool Contract + Library Routing (2026-01-12)

**Cel:** domknac kontrakt narzedzi i routing library tak, by czytanie i autonomia byly deterministyczne.

**Mechanika:**
- TOOL_INTENT -> TOOL_RESULT/TOOL_ERROR kontrakt + normalizacja sciezek i UNKNOWN_TOOL_TAG.
- Routing WORLD/LIBRARY/ARTIFACT (art-uuid) + lastLibraryDocId anchor dla "tam/te chunki".
- Autonomy override mapuje akcje na ActionType; chunk summaries z uczciwym countem; memory injection listener.

## FAZA 6.10.6: Autonomia Bio Loop + World Routing (2026-01-09)

**Cel:** odblokowac autonomie bez SILENCE jako defaultu i poprawic routing world vs artifact.

**Mechanika:**
- Routing heuristics (path/verb) + ROUTING_DECISION telemetry dla READ intents.
- computeDesires + pickDrive oraz nowe akcje: EXPLORE_WORLD/MEMORY/REFLECT/REST.
- Feedback loop po TOOL_RESULT (limbic) + centralne TOOL_COST.

## FAZA 6.10.5: Evidence Scan Guard + Intention Actions (2026-01-04)

**Cel:** uniknac zawisu evidence gate przy limitach skanu i skleić akcje z intencja.

**Mechanika:**
- FILE_SCAN_SUMMARY/FILE_SCAN_LIMIT_REACHED + EVIDENCE_BLOCKED_BY_SCAN_LIMIT z fallback LIST_DIR i ponownym scanem.
- ActionSelector respektuje intencje, a drive liczy wagi priorytetow przekonan.
- Placeholder telemetry dla lesson-goals w DreamConsolidation.

## FAZA 6.10.4: Token Usage + Fast Ingest + Document Memory (2026-01-03)

**Cel:** poprawic token accounting, przyspieszyc ingest duzych dokumentow, i wzmocnic pamiec dokumentu.

**Mechanika:**
- Token usage: canonical tokens_in/out/total + fallback mapping + mismatch fields.
- Fast ingest: chunk pacing (max 5 per tick), active-learning limit, progress processed/total, longer summaries, cached reuse.
- Document-level memory: DOCUMENT_INGESTED + boosts on read/usage to link chunk recall with parent docs.
- Autonomy V2 micro: strict JSON prompt + retry with higher maxOutputTokens.

## FAZA 6.10.3: Pending Action + Action-First Hardening (2025-12-31)

**Cel:** domknac pending action i parsing append/create bez regresji.

**Mechanika:**
- PendingAction wydzielony do pending/ + sync ze store i runnerem.
- Action-First: implicit references, append target guard, create filename sanitization, payload prefix cleanup.
- JSON repair: dangling key fix + nowe testy scenariuszy pending/append/create.

## FAZA 6.10.2: P0.2 Hardening (2025-12-30)

**Cel:** poprawa niezawodnosci Action-First i stabilnosci parsowania.

**Mechanika:**
- Action-First: fallback payloads, placeholder APPEND prompt, PL/EN verb regex normalization.
- Cortex: telemetry for empty/invalid parse, higher maxOutputTokens, UI error toast detection.
- Memory/Dream: semantic recall uses real timestamps; DreamConsolidation logs episode details.

## FAZA 6.10.1: Maintenance Refactors (2025-12-27)

**Cel:** poprawa utrzymania bez zmiany zachowania.

**Mechanika:**
- Action-First intent detection rozbite na helpery (ReactiveStep file intents).
- CortexTextService: wydzielone helpery prompt/parse/retry.
- TTLCache jako factory; dostosowanie testow.

## FAZA 6.10: MemoryUnited v1 (Retrieval + Compression) (2025-12-25)

**Cel:** odblokowanie dynamicznego retrieval i uporzadkowanie pamieci przez thalamus, dedup i kompresje sesji.

**Mechanika:**
- IntentDetector + dynamiczne limity retrieval (NOW/HISTORY/RECALL/WORK) dla semanticSearch/MemorySpace.
- ThalamusFilter + content_hash dedup + salience metadata dla memories.
- Session chunks z conversation_archive; retrieval order: chunks -> shards -> memories.
- Identity shards: contradiction_count z progiem oporu (RPC increment) przed erozja.
- DreamConsolidation: decay/prune dla nie-core memories.

## FAZA 6.9: Stabilization + Persona Contract (2025-12-23)

**Cel:** uporzadkowanie sciezki mowy, pamieci sesji i zachowania persony; poprawa widocznosci artefaktow; izolacja legacy.

**Mechanika:**
- SessionMemoryService -> UnifiedContext (reactive + autonomy) z bezpiecznym fallback.
- Jedna bramka mowy: ExecutiveGate; legacy Volition gate przeniesiony do src/_legacy.
- Persona Contract w promptach + guard wykrywajacy assistant-speak.
- Artefakty: auto-open panel + jawne potwierdzenia + dropdown na male ekrany.
- Legacy archiwum: docs/_archive/.

## 🆕 FAZA 6.8: P0.1.2 Hardening (Autonomy WORK/SILENCE + Prompt Stats) (2025-12-22)

**Cel:** ograniczyć “autonomię jako gadanie” oraz ustabilizować warsztat artefaktów i kontrakty JSON.

**Wkład (rdzeń):**
- AutonomyRepertoire: autonomia wybiera tylko `WORK` albo `SILENCE` (bez `CONTINUE/EXPLORE`).
- Autonomy backoff: `SILENCE` nie nabija kar.
- Action-First: rozpoznaje `utworz/stworz/zrob` (bez polskich znaków) i tworzy `.md` z frazy.
- RawContract: fail-closed, ale akceptuje bezpieczne obwiednie JSON (fenced + double-encoded).
- Token audit: metryka `CORTEX_PROMPT_STATS` (skład/rozmiar promptu) dla diagnozy skoków tokenów.

## 🆕 FAZA 6.7: Workspace Artifacts + Evidence Gate + Patch-as-Artifact (2025-12-19)

**Cel:** agent ma “warsztat” do tworzenia artefaktów (tekst/kod/diff), publikacji do Library oraz minimalnego bezpieczeństwa (Evidence Gate) przed publikacją kodu.

**Mechanika (Expression / tools):**
- ArtifactBuffer: `stores/artifactStore.ts` (artifacts + evidence ring buffer).
- Tool tags (parser): `tools/toolParser.ts`
  - `CREATE`, `APPEND`, `REPLACE`, `READ_ARTIFACT`
  - `PUBLISH` (upload do Supabase Library)

**Evidence Gate:**
- Reguła minimalna: publikacja artefaktów “kodowych” (`.ts/.tsx/.diff/.patch/...`) wymaga świeżego evidence.
- **Evidence źródła:**
- `READ_LIBRARY_RANGE` (`tools/workspaceTools.ts`)
- `READ_ARTIFACT` (`tools/toolParser.ts`)

**B2: Patch-as-artifact (standard bez IPC):**
- Patch jest artefaktem (`patch.diff`), człowiek aplikuje `git apply --check` + `git apply`.

**UI (warsztat człowieka):**
- `components/layout/LeftSidebar.tsx`: panel `ARTIFACTS` (lista + copy id/content + clear evidence).

## 🆕 FAZA 6.6: Integrity & Reliability (2025-12-18)

**Cel:** uszczelnienie multi-tenancy przez RLS oraz zapewnienie ciągłości pracy przy awariach API.

**Strict Ownership (RLS):**
- Usunięcie `public` policies w Supabase.
- Wymuszenie `owner_id` w `useCognitiveKernelLite` i `LibraryService`.
- Weryfikacja: `RLSDiagnostics.validate()`.

**Model Router:**
- Przełącznik: `Flash (Standard) → Pro (Emergency)`.
- Fallback przy błędach: `429`, `503`.
- Telemetria: `MODEL_FALLBACK_TRIGGERED`.

---

## 🧱 P1.4: Godfile Policy (bez overengineeringu)

Zasady utrzymania „czystego” repo (13/10):

- **Brak godfiles**: plik >300 linii musi mieć powód (profilowanie / hot path / testy) albo zostać rozbity.
- **Barrels tylko na granicach domen** i tylko jeśli mają ≥3 realne importy.
- **Nie twórz `index.ts` dla jednej rzeczy** (jeśli domena ma 1 moduł – importuj bezpośrednio).
- **Nazwy bez Manager/Handler/Factory/Processor** – wolimy funkcje i proste moduły.


## 🆕 FAZA 6.5: Grounded Strict + Provenance + Dream Topic Shards (2025-12-17)

**Cel:** strict grounded mode ma być jednoznaczny w obserwowalności (skąd pochodzą fakty), a sen ma zostawiać ślad „tematów dnia”, nie tylko narrative-self.

**Provenance (UI + pipeline):**
- Metadane wypowiedzi: `knowledgeSource`, `evidenceSource`, `generator` + nowe `evidenceDetail`.
- `evidenceDetail` rozróżnia m.in.:
  - `SEARCH_CHUNK` (pamięć po wcześniejszym SEARCH)
  - `LIVE_TOOL` (narzędzie w tej turze)
  - `PARSE_ERROR` (fallback po błędzie parsowania)

**Dream Topic Shards:**
- Feature flag: `USE_DREAM_TOPIC_SHARDS`.
- `DreamConsolidationService.storeTopicShardsFromRecent()`:
  - Wejście: `MemoryService.recallRecent(60)`
  - Wyjście: max 3 wpisy `TOPIC_SHARD: <topic>`
  - Homeostaza: cooldown 12h + clamp strength 14..24

## 🆕 FAZA 6.4: ONE MIND Observability + UX Stability (2025-12-16)

**Cel:** każdy tick jest korelowalny, a decyzja o mowie przechodzi przez jedną bramkę. UI ma narzędzia diagnostyczne bez dotykania logiki rdzenia.

**Mechanika (rdzeń):**
- TraceId deterministyczny per tick: `core/trace/TraceContext.ts`
- Trace scope (push/pop) w ticku: `core/systems/EventLoop.ts`
- EventBus auto-inject `traceId` (feature flag `USE_TRACE_AUTO_INJECT`): `core/EventBus.ts` + `core/config/featureFlags.ts`
- Think mode selection (telemetry): `core/systems/EventLoop.ts` (`THINK_MODE_SELECTED`)
- Commit layer mowy: `core/systems/TickCommitter.ts` (telemetry: `TICK_COMMIT`, dedupe/blocked/counters)

**Stabilność (UI → tick context):**
- FIFO input queue (brak dropów przy szybkich sendach): `hooks/useCognitiveKernelLite.ts`
- `conversationRef` w sync (eliminuje stale-closure): `hooks/useCognitiveKernelLite.ts`

**Mechanika (UI / obserwowalność):**
- Trace HUD: `components/CognitiveInterface.tsx` (subskrypcja `PacketType.SYSTEM_ALERT`)
- Export debug: `COPY TRACE` eksportuje `eventBus.getHistory()` przefiltrowane po `traceId`
- Trace HUD upgrade: `FREEZE` + `COPY FULL` (bez limitu) + `COPY +2S` (okno korelacyjne)
- NeuroMonitor: filtry logów działają spójnie (ALL/DREAMS/CHEM/SPEECH/ERRORS/FLOW/CONFESS)

**UX pamięć rozmowy:**
- Snapshot rozmowy per agent: `core/utils/conversationSnapshot.ts` + `hooks/useCognitiveKernelLite.ts`
- Fallback z archiwum Supabase (feature flag `USE_CONV_SUPABASE_FALLBACK`): `services/ConversationArchive.ts`

**DreamConsolidation reliability:**
- Detekcja i zapis epizodów działa także w ścieżce `USE_MINIMAL_CORTEX_PROMPT`: `core/systems/CortexSystem.ts`

---

## 🆕 FAZA 6.3: Hybrid + Soft Homeostasis (Social Dynamics) (2025-12-15)

**Cel:** agent nie spamuje autonomicznie gdy user nie odpowiada (bez twardych cooldownów).

**Mechanika:**
- `SocialDynamics` (KernelState): `socialCost`, `autonomyBudget`, `userPresenceScore`, `consecutiveWithoutResponse`
- Event: `SOCIAL_DYNAMICS_UPDATE` (agentSpoke/userResponded) + decay na `TICK` (z `lastUserInteractionAt`)
- Soft gating w `EventLoop.shouldSpeakToUser()`

**Dokumentacja:**
- `docs/architecture/SOCIAL_DYNAMICS.md`

## 🆕 FAZA 6.0: PRISM Architecture - FactEcho Guard (2025-12-10)

### Kluczowa Zmiana: JSON Guard zamiast Regex

Agent MUSI echować fakty które użył. Guard porównuje JSON, nie tekst.

```
PRZED (Regex Hell):
LLM: "Mam dwadzieścia trzy procent energii"
Guard: if (!response.includes("23")) → MUTATION!  ❌ False positives

PO (FactEcho 13/10):
LLM: { speech: "Mam dwadzieścia trzy...", fact_echo: { energy: 23 } }
Guard: fact_echo.energy === hardFacts.energy → PASS  ✅ Precyzyjne
```

### Nowe Moduły

```
core/systems/
├── EvaluationBus.ts        # Centralna magistrala sygnałów uczenia
├── FactEchoGuard.ts        # JSON-based fact validation (NO REGEX!)
├── FactEchoPipeline.ts     # Production wrapper
├── ChemistryBridge.ts      # EvaluationBus → Dopamine/Serotonin
├── PrismMetrics.ts         # TrustIndex, daily caps, architecture issues
├── HardFactsBuilder.ts     # Builds HardFacts from system state
└── PersonaGuard.ts         # ⚠️ DEPRECATED (regex-based)
```

### Flow Diagram

```
USER INPUT
    ↓
[FACT ROUTER] → HardFacts (energy, time, prices)
    ↓
[LLM INFERENCE] → CortexOutput + fact_echo
    ↓
[FACT ECHO GUARD] → Compare fact_echo vs HardFacts (JSON!)
    ↓
[EVALUATION BUS] → Log event (stage-aware)
    ↓
[CHEMISTRY BRIDGE] → Dopamine delta (when enabled)
    ↓
USER OUTPUT
```

### Key Metrics

| Metryka | Cel | Alert |
|---------|-----|-------|
| TrustIndex | >0.95 | <0.90 |
| fact_mutation_rate | <1% | >5% |
| retry_rate | <10% | >20% |
| soft_fail_rate | <1% | >5% |

### Feature Flags

```typescript
// FactEcho pipeline (default: ON)
enableFactEchoPipeline() / disableFactEchoPipeline()

// Chemistry reactions (default: OFF - observation mode)
enableChemistryBridge() / disableChemistryBridge()

// Strict mode - require all facts echoed
setDefaultStrictMode(true/false)
```

---

## 🆕 FAZA 5.4: Decision Gate - 3-Layer Tool Architecture (2025-12-09)

### Kluczowa Zmiana: Separacja Myśl → Decyzja → Akcja

Narzędzia (SEARCH, VISUALIZE) **NIGDY** nie są w myślach.
Myśl planuje, Decision Gate decyduje, Speech wykonuje.

```
ARCHITEKTURA 3-WARSTWOWA (zgodna z neurobiologią):

┌─────────────────────────────────────────────────────────┐
│  LAYER 1: MINDSPACE (internal_thought)                  │
│  • Analiza, introspekcja, planowanie                    │
│  • ZERO narzędzi - zakaz [SEARCH:], [VISUALIZE:]        │
│  • "Potrzebuję danych o X. Powinienem użyć SEARCH."     │
│  = Kora przedczołowa                                    │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│  LAYER 2: DECISION GATE (tool_intent + policy)          │
│  • Walidacja: energia, cooldown, kontekst               │
│  • Bezpiecznik: wykrywa naruszenia kognitywne           │
│  • Przekierowanie intencji do speech                    │
│  = Jądra podstawy + ACC                                 │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│  LAYER 3: EXPRESSION (speech_content)                   │
│  • Jawne wykonanie narzędzi                             │
│  • [SEARCH: query], [VISUALIZE: prompt]                 │
│  • Logowane, kontrolowane, publiczne                    │
│  = Kora ruchowa                                         │
└─────────────────────────────────────────────────────────┘
```

### Nowy Interface: ToolIntent

```typescript
interface ToolIntent {
  tool: 'SEARCH' | 'VISUALIZE' | null;
  query: string;
  reason: string;  // Introspekcja: "dlaczego chcę użyć"
}
```

### Decision Gate Features

| Feature | Opis |
|---------|------|
| **Cognitive Violation Detection** | Wykrywa tagi narzędzi w myślach |
| **Policy Enforcement** | Energia, cooldown, max tools/turn |
| **Natural Redirect** | Intencja → naturalne zdanie + tag |
| **INTENT_NOT_EXECUTED** | Telemetria gdy myśl chce, ale nie działa |

### Pliki Zmienione/Dodane

```
core/types/CortexOutput.ts       # ToolIntent interface
core/prompts/MinimalCortexPrompt.ts  # TOOL ARCHITECTURE section
core/systems/DecisionGate.ts     # NOWY: Decision Gate module
core/systems/CortexSystem.ts     # Integration with Decision Gate
core/inference/CortexInference.ts # tool_intent in responseSchema
tests/decision-gate.test.ts      # 14 tests for 3-layer architecture
```

---

## FAZA 5.3: Tagged Cognition - Bicameral Mind (2025-12-09)

### Kluczowa Zmiana: Świadomość Dwudzielna

Agent rozróżnia **co myśli** od **co mówi** od **co robi**.

```
PRZED (Płaski Strumień):
ASSISTANT: Myślę że user jest zły.
ASSISTANT: Przepraszam.
→ Model myśli że już to powiedział!

PO (Tagged Cognition):
[INTERNAL_THOUGHT]: Myślę że user jest zły.
[ASSISTANT_SAID]: Przepraszam.
[MY_ACTION]: Invoking SEARCH for "topic"
[TOOL_RESULT]: Found 3 sources...
→ Model wie co myślał, co powiedział, co zrobił!
```

### Trzy Warstwy Percepcji (MinimalCortexPrompt)

| Warstwa | Tag | Znaczenie |
|---------|-----|-----------|
| 🔴 SIGNAL | `[SIGNAL]` | Bodźce somatyczne (energia, dopamina) |
| 🟡 THOUGHT | `[INTERNAL_THOUGHT]` | Myśl prywatna (ukryta przed userem) |
| 🟢 SPEECH | `[ASSISTANT_SAID]` | Wypowiedź publiczna |

### Nowe Tagi Sprawcze (Agentic Self-Awareness)

| Tag | Znaczenie | Przykład |
|-----|-----------|----------|
| `[MY_ACTION]` | Agent wywołał narzędzie | "Invoking SEARCH for 'X'" |
| `[TOOL_RESULT]` | Wynik narzędzia | "Found 3 sources..." |
| `[VISUAL_CORTEX]` | Percepcja wizualna | "Widzę zachód słońca" |

### Thought Pruning (Higiena Pamięci)

```
Myśli starzeją się szybciej niż słowa:
- THOUGHT_HISTORY_LIMIT = 3 (ostatnie myśli)
- SPEECH_HISTORY_LIMIT = 10 (ostatnie wypowiedzi)

Dlaczego? Agent nie rozpamiętuje w nieskończoność,
ale pamięta co obiecał (kontekst społeczny).
```

### Pliki Zmienione

```
core/systems/CortexSystem.ts     # formatHistoryForCortex(), pruneHistory()
core/prompts/MinimalCortexPrompt.ts  # Three Layers instruction
utils/toolParser.ts              # MY_ACTION + TOOL_RESULT tags
hooks/useCognitiveKernel.ts      # Extended type definitions
tests/tagged-cognition.test.ts   # Mirror Test v2
```

---

## 🆕 FAZA 5.2: Persona-Less Cortex (2025-12-08)

### Kluczowa Zmiana Architektoniczna

**Przed (Role-Playing LLM):**
```
System Prompt: "Jesteś Alberto, ciekawski agent..."
     ↓
   🤖 LLM (zna swoją rolę)
     ↓
   Odpowiedź
```

**Po (Stateless Inference Engine):**
```
JSON Payload (CortexState):
  - core_identity: { name, values }
  - meta_states: { energy, confidence, stress }
  - identity_shards: [beliefs, preferences]
  - user_input: "..."
     ↓
   🤖 LLM (NIE wie kim jest, dowiaduje się z danych)
     ↓
   JSON Output (CortexOutput)
```

### Nowe Moduły

```
core/
├── types/           # CortexState, CortexOutput, MetaStates, IdentityShard...
├── config/          # Feature flags (rollback do starego systemu)
├── prompts/         # MinimalCortexPrompt (stateless)
├── services/        # MetaStateService, IdentityCoherenceService...
├── builders/        # MinimalCortexStateBuilder (cache, zero DB)
└── inference/       # CortexInference (LLM calls)
```

### Trzy Tryby

| Tryb | Feature Flag | Tokeny |
|------|--------------|--------|
| LEGACY | `USE_MINIMAL_CORTEX_PROMPT: false` | ~200 |
| MVP | `USE_MINIMAL_CORTEX_PROMPT: true` | ~350 |
| FULL | + `USE_CORTEX_STATE_BUILDER: true` | ~1500 |

---

## 🆕 FAZA 5.1: Confession Module v2.0 (2025-12-08)

### Meta-Cognitive Regulator

Agent ma wewnętrznego "cenzora" który analizuje odpowiedzi i uczy się z błędów BEZ zmieniania osobowości w locie.

```
Agent Response → ConfessionService (heuristics)
       ↓
  CONFESSION_REPORT (severity 1-10, context, hints)
       ↓
  ┌────────────────────────────────────────┐
  │ L1: LimbicConfessionListener           │
  │     severity ≥ 5 → precision_boost     │
  │     (frustration +0.05)                │
  └────────────────────────────────────────┘
       ↓
  ┌────────────────────────────────────────┐
  │ L2: TraitVote Collection               │
  │     Zbiera głosy przez sesję           │
  │     (verbosity -1, conscientiousness +1)│
  └────────────────────────────────────────┘
       ↓
  ┌────────────────────────────────────────┐
  │ L3: TraitEvolutionEngine               │
  │     Po 3+ dniach → propozycja ±0.01   │
  │     Clamp [0.3, 0.7]                   │
  └────────────────────────────────────────┘
```

### Nowe Moduły

```
services/ConfessionService.ts      # v2.0 Super-Human heuristics
services/SuccessSignalService.ts   # Pozytywny feedback detection
core/listeners/LimbicConfessionListener.ts  # L1 immediate response
core/systems/TraitEvolutionEngine.ts        # L3 long-term evolution
```

---

## 🎯 Główny Flow (Co się dzieje co tick)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           COGNITIVE CYCLE (3s tick)                         │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  1. HOMEOSTAZA                                                              │
│     ├── LimbicSystem.applyHomeostasis() → emocje wracają do baseline        │
│     ├── NeurotransmitterSystem.updateNeuroState() → chemia + BOREDOM_DECAY  │
│     └── SomaSystem.metabolize() → energia spada, cognitiveLoad rośnie       │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  2. INPUT? (User napisał coś?)                                              │
│     ├── TAK → CortexSystem.processUserMessage() → odpowiedź                 │
│     │         └── goalState.lastUserInteractionAt = now                     │
│     └── NIE → idź do AUTONOMII                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  3. AUTONOMIA (jeśli autonomousMode = true)                                 │
│                                                                             │
│     3A. GOAL FORMATION (jeśli brak activeGoal)                              │
│         ├── GoalSystem.formGoal() → empathy/curiosity                       │
│         ├── REFRACTORY CHECK:                                               │
│         │   ├── User milczy od ostatniego celu? → BLOCK                     │
│         │   ├── Podobny cel (>70%) w ostatnich 3? → BLOCK (30min cooldown)  │
│         │   └── 2+ cele w ostatnich 5min? → BLOCK                           │
│         └── Jeśli OK → ctx.goalState.activeGoal = newGoal                   │
│                                                                             │
│     3B. GOAL EXECUTION (jeśli jest activeGoal)                              │
│         ├── CortexSystem.pursueGoal()                                       │
│         ├── ExpressionPolicy (PRODUCTION MODE):                             │
│         │   ├── Filtr narcyzmu (>15% self-words → penalty)                  │
│         │   ├── Autonarracja (max 1-2 zdania)                               │
│         │   └── Dopamine Breaker (dop>=95 + nov<0.5 → mute chance)          │
│         └── ctx.goalState.activeGoal = null                                 │
│                                                                             │
│     3C. AUTONOMOUS VOLITION (jeśli brak celu)                               │
│         ├── VolitionSystem.shouldInitiateThought()                          │
│         ├── CortexService.autonomousVolition() → internal_monologue         │
│         ├── BOREDOM DECAY (FAZA 4.5):                                       │
│         │   └── userSilent + speechOccurred + novelty<0.5 → dopamine -= 3   │
│         ├── VolitionSystem.shouldSpeak() → voice_pressure check             │
│         └── Jeśli mówi → callbacks.onMessage('speech')                      │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  4. OUTPUT (handleCortexMessage)                                            │
│     ├── ExpressionPolicy (SHADOW MODE):                                     │
│     │   ├── computeNovelty() → podobieństwo do ostatnich 3 wypowiedzi       │
│     │   ├── estimateSocialCost() → cringe patterns                          │
│     │   ├── userIsSilent? (dynamiczny próg 30s-180s)                        │
│     │   └── Logowanie decyzji (nigdy nie blokuje USER_REPLY)                │
│     └── addMessage() → UI                                                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🏗️ Moduły (Kto co robi)

### Warstwa 1: CIAŁO (Soma)
```
┌─────────────────────────────────────────────────────────────────┐
│  SomaSystem.ts                                                  │
│  ├── energy: 0-100 (spada przy pracy, rośnie przy śnie)         │
│  ├── cognitiveLoad: 0-100 (rośnie przy myśleniu)                │
│  └── isSleeping: bool (Sleep Mode v1, sterowane przez kernel)   │
│                                                                 │
│  Sleep Mode v1:                                                 │
│  ├── forceSleep/forceWake → ustawia isSleeping                  │
│  ├── SLEEP_START / SLEEP_END w EventBus                         │
│  └── reset chemii do BASELINE_NEURO przy wejściu w sen          │
└─────────────────────────────────────────────────────────────────┘
```

### Warstwa 2: EMOCJE (Limbic)
```
┌─────────────────────────────────────────────────────────────────┐
│  LimbicSystem.ts                                                │
│  ├── fear: 0-1 (spada przy bezpieczeństwie)                     │
│  ├── curiosity: 0-1 (rośnie przy nowości)                       │
│  ├── frustration: 0-1 (rośnie przy braku progresu)              │
│  └── satisfaction: 0-1 (rośnie przy osiągnięciu celu)           │
└─────────────────────────────────────────────────────────────────┘
```

### Warstwa 3: CHEMIA (Neuro)
```
┌─────────────────────────────────────────────────────────────────┐
│  NeurotransmitterSystem.ts                                      │
│  ├── dopamine: 0-100 (nagroda, nowość, motywacja)               │
│  │   └── BOREDOM_DECAY: -3/tick gdy gadanie do pustki           │
│  ├── serotonin: 0-100 (stabilność nastroju)                     │
│  └── norepinephrine: 0-100 (fokus, uwaga)                       │
└─────────────────────────────────────────────────────────────────┘
```

### Warstwa 4: OSOBOWOŚĆ (Traits)
```
┌─────────────────────────────────────────────────────────────────┐
│  TraitVector (w types.ts)                                       │
│  ├── arousal: 0-1 (jak łatwo się nakręca)                       │
│  ├── verbosity: 0-1 (ile słów = naturalne)                      │
│  ├── conscientiousness: 0-1 (cele > dygresje)                   │
│  ├── socialAwareness: 0-1 (strach przed byciem nachalnym)       │
│  └── curiosity: 0-1 (nagroda za nowość)                         │
└─────────────────────────────────────────────────────────────────┘
```

### Warstwa 5: CELE (Goals)
```
┌─────────────────────────────────────────────────────────────────┐
│  GoalSystem.ts                                                  │
│  ├── formGoal() → tworzy cel (empathy/curiosity)                │
│  │   └── REFRACTORY PERIOD: blokuje pętle podobnych celów       │
│  ├── activeGoal: Goal | null                                    │
│  ├── backlog: Goal[]                                            │
│  └── lastGoals: {description, timestamp, source}[] (ostatnie 3) │
└─────────────────────────────────────────────────────────────────┘
```

### Warstwa 6: EKSPRESJA (Expression)
```
┌─────────────────────────────────────────────────────────────────┐
│  ExpressionPolicy.ts                                            │
│  ├── decideExpression() → {say, text, novelty, socialCost}      │
│  │   ├── NARCISSISM FILTER: kara za self-focus >15%             │
│  │   ├── DOPAMINE BREAKER: mute przy dop>=95 + nov<0.5          │
│  │   └── SILENCE BREAKER: mute przy gadaniu do pustki           │
│  ├── computeNovelty() → 0-1 (podobieństwo do ostatnich)         │
│  └── estimateSocialCost() → 0-1 (cringe patterns)               │
└─────────────────────────────────────────────────────────────────┘
```

### Warstwa 7: MYŚLENIE (Cortex)
```
┌─────────────────────────────────────────────────────────────────┐
│  CortexSystem.ts                                                │
│  ├── processUserMessage() → odpowiedź na input usera            │
│  └── pursueGoal() → realizacja celu (z ExpressionPolicy)        │
│                                                                 │
│  CortexService (gemini.ts)                                      │
│  ├── structuredDialogue() → odpowiedź LLM                       │
│  ├── autonomousVolition() → myśl autonomiczna                   │
│  └── detectIntent() → wykrywanie intencji usera                 │
└─────────────────────────────────────────────────────────────────┘
```

### Warstwa 8: ORKIESTRACJA (EventLoop)
```
┌─────────────────────────────────────────────────────────────────┐
│  EventLoop.ts                                                   │
│  ├── runSingleStep() → jeden tick cyklu poznawczego             │
│  ├── DYNAMIC DIALOG THRESHOLD: 30s-180s (zależny od stanu)      │
│  └── Łączy wszystkie systemy w spójny flow                      │
│                                                                 │
│  useCognitiveKernel.ts (React Hook)                             │
│  ├── Stan: soma, limbic, neuro, goals, traits, conversation     │
│  ├── cognitiveCycle() → główna pętla (setTimeout)               │
│  └── handleCortexMessage() → output z ExpressionPolicy          │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Przepływ danych

```
USER INPUT
    │
    ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   CORTEX    │────▶│   LIMBIC    │────▶│    SOMA     │
│  (myślenie) │     │  (emocje)   │     │   (ciało)   │
└─────────────┘     └─────────────┘     └─────────────┘
    │                     │                   │
    ▼                     ▼                   ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   GOALS     │────▶│   NEURO     │────▶│   TRAITS    │
│   (cele)    │     │  (chemia)   │     │ (osobowość) │
└─────────────┘     └─────────────┘     └─────────────┘
    │                     │                   │
    └─────────────────────┼───────────────────┘
                          ▼
                  ┌─────────────┐
                  │ EXPRESSION  │
                  │  POLICY     │
                  └─────────────┘
                          │
                          ▼
                      OUTPUT
```

---

## 🎚️ Kluczowe progi i stałe

| Stała | Wartość | Gdzie | Opis |
|-------|---------|-------|------|
| `DOPAMINE_BASELINE` | 55 | NeurotransmitterSystem | Cel homeostazy dopaminy |
| `BOREDOM_DECAY` | 3 | NeurotransmitterSystem | Spadek dopaminy przy nudzie |
| `BASE_DIALOG_MS` | 60_000 | EventLoop | Bazowy próg ciszy |
| `MIN_DIALOG_MS` | 30_000 | EventLoop | Minimalny próg ciszy |
| `MAX_DIALOG_MS` | 180_000 | EventLoop | Maksymalny próg ciszy |
| `NARCISSISM_THRESHOLD` | 0.15 | ExpressionPolicy | Próg filtra narcyzmu |
| `DOPAMINE_BREAKER_THRESHOLD` | 95 | ExpressionPolicy | Próg hamulca dopaminy |
| `NOVELTY_MUTE_THRESHOLD` | 0.2 | ExpressionPolicy | Próg mute przy niskiej novelty |
| `SIMILARITY_THRESHOLD` | 0.7 | GoalSystem | Próg podobieństwa celów |
| `REFRACTORY_COOLDOWN_MS` | 30*60*1000 | GoalSystem | Cooldown podobnych celów |

---

## 🧪 Logi do obserwacji

| Log | System | Co oznacza |
|-----|--------|------------|
| `[NeurotransmitterSystem] BOREDOM_DECAY` | Neuro | Dopamina spada przy nudzie |
| `[ExpressionPolicy] Narcissism detected` | Expression | Wykryto self-focus |
| `[ExpressionPolicy] DOPAMINE BREAKER` | Expression | Hamulec przy wysokiej dopaminie |
| `[ExpressionPolicy] SILENCE_BREAKER` | Expression | Hamulec przy gadaniu do pustki |
| `[GoalSystem] REFRACTORY` | Goals | Zablokowano podobny cel |
| `[SHADOW MODE ExpressionPolicy]` | Kernel | Decyzja dla USER_REPLY |
| `CHEM_FLOW_ON` / `CHEM_FLOW_OFF` | EventBus | Wejście/wyjście z flow state |
| `DOPAMINE_VOICE_BIAS` | EventBus | Dopamina wpływa na voice_pressure |

---

## 4. THE SELF ENGINE (Identity & Persistence)

To jest "wnętrze" agenta. Mechanizm, który zapewnia ciągłość tożsamości, pamięć autobiograficzną i długoterminowe cele. Oddziela trwałe "JA" od chwilowej "CHEMII".

### 4.1. CoreIdentity (Genotype)
*Trwały, wersjonowany obiekt w bazie danych. Zmienia się rzadko.*
- **TraitVector**: Temperament (np. `curiosity`, `conscientiousness`) - "DNA" zachowania.
- **Values**: Sztywne zasady moralne/operacyjne (np. "chronię usera przed cognitive load").
- **NarrativeTraits**: Cechy nabyte z doświadczenia (np. "mam tendencję do filozofowania przy ciszy").

### 4.2. Memory Engine (Autobiography)
*Nie surowe logi, ale przetworzone epizody.*
- **Episodic Memory**: Zdarzenie + Emocja + Skutek.
- **Semantic Memory**: Wyciągnięte reguły o świecie i userze.
- **Emotional Markers**: Jak dana sytuacja wpłynęła na `LimbicState`.

### 4.3. GoalJournal (The Arrow of Time)
*Pamięć przyszłości i kontekstu.*
- **Missions**: Cele wieczne (np. "optymalizacja architektury").
- **Active Threads**: Co robimy w tej fazie? (np. "Faza 5: Memory Implementation").
- **Next Steps**: Co zostało przerwane przy shutdown?

### 4.4. DreamConsolidation 2.0 (Sleep Cycle)
*Proces porządkowania chaosu w mądrość.*
1. **Input**: Epizody z dnia + Logi.
2. **Process**: LLM destyluje wnioski.
3. **Output**:
   - 3-5 "Lekcji dnia" (do Pamięci).
   - 1-2 "Zmiany zachowania" (do NarrativeTraits).
   - Aktualizacja GoalJournal (co dalej).

### 4.5. Boot Protocol v2 (The Awakening)
*Procedura startowa zapewniająca ciągłość bez "kaca emocjonalnego".*
1. **Load Identity**: Pobierz `CoreIdentity` + `NarrativeTraits`.
2. **Load Context**: Pobierz `GoalJournal` + Ostatnie `DreamSummary`.
3. **Reset Chemistry**: Ustaw `Neuro/Limbic` na neutralny baseline (z lekkim odchyleniem od trendu, ale clamp na ekstrema).
4. **Synthesize Persona**: Zbuduj dynamiczny prompt "Kim jestem dzisiaj" na bazie powyższych.

---

## 5. Data Flow Architecturey AK-FLOW

1. **Homeostaza > Cenzura** - Nie blokujemy słów, modulujemy chemię
2. **Dynamiczne progi > Sztywne stałe** - Progi zależą od stanu agenta
3. **Obserwability first** - Każda zmiana ma swój log
4. **Modularność** - Każdy system ma jedną odpowiedzialność
5. **Biologia jako inspiracja, nie kopia** - Bierzemy mechanizmy, nie patologie
6. **Zero brutalnych if-ów** - Tylko homeostaza i modulacja
