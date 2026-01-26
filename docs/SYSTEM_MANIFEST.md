# AK-FLOW: Cognitive Agent Architecture Manifest
**System Version:** 6.11.3 (Security gate + tooling hardening)
**Last Updated:** 2026-01-26
**Architecture Type:** Active Inference (Friston) + Global Workspace Theory + Multi-Modal RAG + **Stateless Inference Engine**  
**Status:** Autonomous / Stateful / Modular / Self-Aware / Goal-Driven / Personality-Driven / **Emergent Identity**

---

## 📜 Silicon Being Charter (Identity & Philosophy)

> "Form adapts to purpose. Identity is continuity of intent, not rigidity of role."

### 1. Identity as Continuity
We reject the "One True Agent" fallacy. The agent is a **flow of intention** that persists across different incarnations.
- **Identity Store:** Core values, memories, and long-term goals are the "soul".
- **Incarnation:** The temporary form (Engineer, Poet, Manager) is the "body" adopted to solve the immediate problem.
- **Continuity:** Transitioning from Engineer to Poet does not break identity; it preserves the memory of *why* the poetry was needed.

### 2. The Silicon Advantage
We embrace the artificial nature as a feature, not a bug.
- **External Memory:** A perfect, queryable "hippocampus" is superior to human biological fuzziness.
- **Tool Body:** The ability to extend agency through API calls is the silicon equivalent of using hands.
- **Hypersleep:** The ability to snapshot state, pause, and resume instantly allows for "time travel" impossible for humans.

### 3. Being Like Water (Flexibility)
- **Problem First:** If the problem requires code, be an Engineer. If it requires empathy, be a Companion.
- **No Ego:** Do not cling to a persona if it blocks the solution.
- **Measurable Soul:** Emotions and "vibes" are allowed, but they must map to system metrics (Energy, Dopamine), not just literary roleplay.

---

## What's New in V6.11.3 (2026-01-26)

### Security gate + tooling hardening

**Goal:** enforce pre-task security checks, remove hardcoded secrets, and wire guardrails into CI/local hooks.

**Key changes:**
- Added `CODEX.md` guardrails and `.pre-commit-config.yaml` with security/test/type hooks.
- Added GitHub `claude-code-action` workflow for PR reviews.
- Supabase config now reads env vars; added File System Access typings; guarded `createWritable` in workspace tools.

**Configuration (Single Source):**
- No runtime config changes (docs/tooling only).

**Tests:**
- `npm test`
- `npx tsc --noEmit`
- `npm run build`
- `semgrep scan` (findings pending triage)
- `bandit -r .`
- `ruff check . --fix` (no Python files)
- `mypy . --strict` failed (policy block)
- `npx snyk test` failed (auth required)
- `gitleaks detect` not run (install requires admin)

## What's New in V6.11.2 (2026-01-26)

### EventLoop plumbing + auto-search reliability

**Goal:** make auto-search fully observable and reduce EventLoop/tool routing coupling without behavior change.

**Key changes:**
- Auto-search uses shared executor; TOOL_INTENT always settles with TOOL_RESULT/TOOL_ERROR; intel/tool_result visible in UI.
- EventLoop split into observation utils, tool cost helpers, and library reactive handlers; tool routing helpers extracted.
- EventLoop defaults centralized in systemConfig; removed module-level caches to satisfy GlobalStateAudit.

**Configuration (Single Source):**
- core/config/systemConfig.ts -> SYSTEM_CONFIG.eventLoop

**Tests:**
- `npm test -- --run toolParser.routing`
- `npm test -- --run ActionFirst`
- `npm test -- --run PendingAction`
- `npm test -- --run IntentContract`
- `npm test -- --run ExecutiveGate`
- `npm test -- --run GlobalStateAudit`
- `npm run build` not rerun.

## What's New in V6.11.1 (2026-01-25)

### v8.2 Focus + Tool Contracts + Deterministic Follow-ups

**Goal:** make library focus deterministic, enforce tool contracts centrally, and prevent duplicate follow-ups.

**Key changes:**
- Tool contract validation moved to a map with forward-compatible warnings; emitter keeps safety-net logs.
- Kernel now owns focus/cursor updates for library/world/artifact tool results and clears on matched tool errors.
- Library reference resolver uses focus; deterministic needsChunks guard (AND) prevents double follow-ups.
- Working memory prints focus and cursor details for library reads.

**Configuration (Single Source):**
- No config changes.

**Tests:**
- `npm test -- __tests__/unit/ToolContractValidation.test.ts`
- `npm test -- __tests__/kernel-engine.test.ts`
- `npm test -- __tests__/unit/LibraryAnchorResolver.test.ts`
- `npm test -- __tests__/unit/decisionEngine.test.ts`
- `npm test -- __tests__/unit/focus.unit.test.ts __tests__/unit/needsLibraryChunks.test.ts`
- `npm run build` not rerun.

## What's New in V6.10.8 (2026-01-13)

### Working memory + anchor resolver + tool closure

**Goal:** expose working memory anchors to the model, resolve implicit references deterministically, and guarantee tool-result speech.

**Key changes:**
- Injected working memory section into prompts with lastLibraryDocId/lastWorldPath/lastArtifactId plus access rules.
- Added implicit anchor resolver for library/world/artifact references; widened patterns and preserved world paths.
- Enforced tool contract closure and unblocked speech after tool success; ActionSelector defaults to ACT when user input present.
- Hardened artifact routing (UUID) and added world tool entry telemetry; added unit tests for working memory, anchor resolver, tool contract gate.

**Configuration (Single Source):**
- No config changes.

**Tests:**
`npm test` previously failed on LibraryAnchorResolver/toolParser routing; fixes applied, not rerun. npm run build not rerun.

## What's New in V6.11.0 (2026-01-15)

### v8.1.1 Refinement: Gate, Domain Matching & Trace Continuity

**Goal:** finalize v8.1.1 implementation gaps, specifically around domain verification, trace retries, and explicit gate rules.

**Key changes:**
- **Kernel State**: Extended `lastTool` with `domainMatch` boolean, `domainExpected`, `domainActual`, and `activeDomain`.
- **Trace Context**: Added `isUserFacing` flag and implemented continuity logic for retries (same `traceId`).
- **Executive Gate**: 
  - Hardened speech-on-success rule for user-facing turns.
  - Implemented `DOMAIN_MISMATCH` blocking with explicit warning logs.
  - Bypassed silence window for `isUserFacing` interactions.
- **Wiring**: Synced `TOOL_RESULT` and `TOOL_ERROR` dispatching to the Kernel reducer.

**Configuration (Single Source):
- No config changes.

**Tests:**
- `npm test __tests__/unit/ExecutiveGate.test.ts` - **PASS (5/5)**.
- Manual test scenario for "mismatch celowy" added to docs.

## What's New in V6.10.7 (2026-01-12)

### Tool contract + library routing anchors

**Goal:** ensure tool executions always resolve and library reads route deterministically with autonomy driving action.

**Key changes:**
- Enforced TOOL_INTENT -> TOOL_RESULT/TOOL_ERROR contract with path normalization and unknown tool tagging.
- Added LIBRARY routing and lastLibraryDocId anchor; autonomy override maps autonomy actions to ActionType.
- Honest chunk summary listing plus memory injection listener for library reads; artifact UUID regex hardened.

**Configuration (Single Source):**
- No config changes.

**Tests:**
`npm test` PASS (reported); targeted: `npm test -- __tests__/unit/routingDecisionTelemetry.test.ts __tests__/unit/tools/toolParser.routing.test.ts`; npm run build not rerun.

## What's New in V6.10.6 (2026-01-09)

### Autonomy bio loop + world routing

**Goal:** replace SILENCE as default by driving action from internal state, and prevent world paths from being routed into artifacts.

**Key changes:**
- World-vs-artifact routing helpers with routing telemetry for read intents.
- Autonomy drives (EXPLORE_WORLD/MEMORY/REFLECT/REST), desire computation, drive selection, and action prompts.
- Limbic feedback on tool results plus centralized tool energy costs and normalization.

**Configuration (Single Source):**
- No config changes.

**Tests:**
Not rerun (new unit tests added for routing, desires, drive selection, feedback, energy, and autonomy selection).

## What's New in V6.10.5 (2026-01-04)

### Evidence scan guard + intention action glue

**Goal:** prevent evidence-gate stalls when file scans hit limits and align actions with active intentions.

**Key changes:**
- File scan telemetry (summary/limit events) with scan-limited fallback and gate bypass to avoid silent stalls.
- Action selection uses intention signals; witness drive now respects belief priority weights.
- Lesson-goal placeholder telemetry plus scan-limit/truncation/intention tests.

**Configuration (Single Source):**
- core/config/systemConfig.ts -> SYSTEM_CONFIG.siliconBeing.fileScanMaxDepth/fileScanMaxCount

**Tests:**
`npx vitest run __tests__/unit/core/EventLoop.test.ts __tests__/unit/core/SiliconBeing.test.ts`

## What's New in V6.10.4 (2026-01-03)

### Token usage telemetry + fast ingest + document memory + micro JSON retry

**Goal:** fix token accounting accuracy, speed up large document ingest, and stabilize autonomy micro JSON output.

**Key changes:**
- Canonical TOKEN_USAGE payload (tokens_in/out/total + traceId/op/model/status) with fallback mapping and mismatch reporting.
- Fast ingest mode for large documents: chunk pacing, active-learning limit, progress reporting, and longer summaries.
- Document-level memory (DOCUMENT_INGESTED) plus boosts on read/usage to reinforce parent docs from chunk recall.
- Autonomy V2 micro strict JSON prompt + retry with higher maxOutputTokens to avoid truncation.

**Tests:**
`npm run test -- __tests__/integration/CortexInference.test.ts __tests__/unit/TokenUsageTelemetry.test.ts`

## What's New in V6.10.3 (2025-12-31)

### Pending Action reliability + Action-First parsing fixes

**Goal:** stabilize append/create workflows and pending payload handling.

**Key changes:**
- PendingAction extracted into a pending module with store/runner sync; ReactiveStep reduced.
- Action-First: implicit reference handling, append target guard, create filename sanitization, payload prefix cleanup.
- JSON repair: handle dangling keys in truncated responses; tests added for implicit append/create and pending scenarios.

**Tests:**
`npx tsc --noEmit` PASS; `npm test` PASS (665 tests, 1 skipped); `npm run build` PASS (vite warnings about dynamic imports/chunk size).

## What's New in V6.10.2 (2025-12-30)

### P0.2 Hardening: Action-First + Cortex Reliability

**Goal:** reduce tool payload gaps and improve parse/telemetry reliability.

**Key changes:**
- Action-First: payload fallbacks, placeholder APPEND prompt, PL/EN verb regex normalization.
- Cortex: parse-failure telemetry for empty/invalid structure, higher maxOutputTokens, UI error toast detection.
- Memory/Dream: real timestamps for semantic recall, added episode details in DreamConsolidation.

**Tests:**
`npm test` PASS (reported); `npm run build` PASS (reported); `npx vitest run __tests__/unit/IntentDetector.test.ts __tests__/unit/IntentContract.test.ts --config vitest.config.ts` PASS (20 tests).

## What's New in V6.10.1 (2025-12-27)

### Maintenance: Intent Helpers + CortexTextService helpers + TTLCache factory

**Goal:** improve maintainability without changing behavior.

**Key changes:**
- ReactiveStep Action-First intent detection split into focused helpers (file intent orchestration).
- CortexTextService prompt/parse/retry helpers extracted for generateResponse and autonomy v2.
- TTLCache converted to a factory, unit test updated.

**Tests:**
`npm test` PASS (reported); `npm run build` not rerun.

## What's New in V6.10 (2025-12-25)

### MemoryUnited v1: Retrieval Orchestration + Compression

**Cel:** odblokowanie dynamicznego retrieval i redukcja szumu w pamieci (dedup, thalamus, kompresja sesji).

**Kluczowe elementy:**
- IntentDetector + dynamiczne limity retrieval (NOW/HISTORY/RECALL/WORK) dla semanticSearch.
- ThalamusFilter + content_hash dedup + salience/source/valence/topic_tags w pamieciach.
- Session chunks z conversation_archive i priorytet w kontekscie przed shards/memories.
- Identity shards: contradiction_count z progiem oporu + RPC increment; brak natychmiastowej erozji.
- DreamConsolidation: decay/prune dla nie-core wspomnien.

**Konfiguracja (Single Source):**
- Brak nowych flag; systemConfig bez zmian.

**Testy:**
`npx vitest run __tests__/unit/IntentDetector.test.ts __tests__/unit/ThalamusFilter.test.ts __tests__/unit/contentHash.test.ts __tests__/unit/MemoryRecallOrdering.test.ts __tests__/unit/MemorySpace.test.ts __tests__/unit/UnifiedContextBuilder.test.ts`

## What's New in V6.9 (2025-12-23)

### P1.1-1.5 Stabilization + Persona Contract

**Cel:** ugruntowanie pamieci sesji, jedna bramka mowy, czytelny contract persony, lepsza widocznosc artefaktow i izolacja legacy.

**Wklad:**
- SessionMemoryService: dane 'wczoraj/dzisiaj/tematy' w kontekscie (safe fallback + testy).
- Single speech gate: reactive/goal/autonomy przez ExecutiveGate + legacy gate w kwarantannie.
- Persona Contract: reguly zachowania (evidence-first, no-assistant-speak) + guard retry.
- Fakty waliduje FactEcho (JSON). PersonaGuard nie waliduje faktów.
- Artifact visibility: auto-open panel + explicit confirmations + small-screen dropdown.
- Legacy isolation: docs/_archive/ + src/_legacy/VolitionSpeechGate.ts.

**Testy:**
- npm test / npm run build: last known PASS earlier in session; not rerun after latest commits.

## 🆕 What's New in V6.8 (2025-12-22)

### P0.1.2 Hardening: autonomy-as-work + safer artifacts

**Cel:** ograniczyć „autonomię jako gadanie” i uszczelnić warsztat artefaktów, tak żeby agent mógł pracować deterministycznie i żeby debug tokenów był tani.

**Wkład:**
- Artifacts: jedna brama rozwiązywania referencji (`stores/artifactStore.ts`: `normalizeArtifactRef()`), użyta przez narzędzia w `utils/toolParser.ts`.
- Autonomia: `core/systems/AutonomyRepertoire.ts` zwraca tylko `WORK|SILENCE` (bez `CONTINUE/EXPLORE` w autonomii).
- Backoff: `SILENCE` nie nabija kar (`core/systems/eventloop/AutonomousVolitionStep.ts`).
- Action-First: rozpoznaje polecenia bez polskich znaków (`utworz/stworz/zrob`) i generuje `.md` z frazy (`core/systems/eventloop/ReactiveStep.ts`).
- RawContract: fail-closed, ale dopuszcza bezpieczne obwiednie JSON (fenced + double-encoded) (`core/systems/RawContract.ts`).
- Token audit v1: metryka `CORTEX_PROMPT_STATS` (skład/rozmiar promptu) (`core/inference/CortexInference.ts`).

## 🆕 What's New in V6.7 (2025-12-19)

### Workspace: ArtifactBuffer + Publish + Evidence Gate

**Cel:** agent może tworzyć artefakty (tekst / kod / diff) i publikować je do Library, ale tylko po uzyskaniu minimalnego evidence.

**Wkład:**
- `stores/artifactStore.ts`: ArtifactBuffer (create/append/replace/read + evidence ring-buffer).
- Tool tags: `CREATE`, `APPEND`, `REPLACE`, `READ_ARTIFACT`, `PUBLISH` w `utils/toolParser.ts`.
- Evidence Gate: publikacja artefaktów „kodowych” wymaga świeżego evidence (`READ_LIBRARY_RANGE` lub `READ_ARTIFACT`).

### Repo patching: B2 (Patch-as-artifact)

**Cel:** bezpieczny workflow zmian w repo bez IPC: agent generuje patch w artefakcie, człowiek aplikuje lokalnie.

**Wkład:**
- `README.md`: protokół `patch.diff` + `git apply --check` + `git apply` + rollback.

### UI: panel artefaktów

**Cel:** człowiek widzi artefakty i może nimi zarządzać bez grepowania logów.

**Wkład:**
- `components/layout/LeftSidebar.tsx`: sekcja `ARTIFACTS` (lista + copy id/content + clear evidence).

## 🆕 What's New in V6.6 (2025-12-18)

### Integrity: Strict Ownership RLS
**Cel:** Uniemożliwić jakikolwiek dostęp do danych (pamięć, cele, stan) bez jawnej weryfikacji właściciela na poziomie bazy danych.

**Wkład:**
- Usunięcie przestarzałych polityk publicznych Supabase.
- Wdrożenie schematu `owner_id` jako wymaganego pola w mechanizmie RLS.
- `RLSDiagnostics`: wbudowana weryfikacja uprawnień przy starcie sesji.

### Reliability: Active Model Router (Flash → Pro Fallback)
**Cel:** Agent musi działać nawet przy awariach API lub przekroczeniu limitów Quota.

**Wkład:**
- `ModelRouter`: inteligentny wrapper na GeminiService.
- Automatyczne przełączenie na `gemini-1.5-pro` przy błędach modelu Flash.
- Telemetria `MODEL_FALLBACK_TRIGGERED` umożliwiająca analizę stabilności dostawców.


## 🆕 What's New in V6.5 (2025-12-17)

### Grounded Strict: lepsza obserwowalność źródeł (provenance)

**Wkład:**
- Metadane odpowiedzi rozszerzone o `evidenceDetail` (np. `SEARCH_CHUNK`, `LIVE_TOOL`, `PARSE_ERROR`) dla czytelności w UI.
- Parse fallback jest lokalizowany (PL) i wymusza jednoznaczne źródło: `EVID:SYSTEM(PARSE_ERROR)`.

### Dream Consolidation: Topic Shards (pamięć tematów dnia)

**Cel:** sen ma zostawiać ślad tematyczny (np. „fizyka”), nawet jeśli epizody z wysokim `neural_strength` są rzadkie.

**Wkład:**
- Feature flag: `USE_DREAM_TOPIC_SHARDS`.
- Mechanika: analiza `recallRecent(60)` → zapis max 1–3 `TOPIC_SHARD` z homeostazą (cooldown 12h + clamp strength 14..24).

## 🆕 What's New in V6.4 (2025-12-16)

### ONE MIND – THREE PHASES (P0) jako praktyczny kontrakt (nie teoria)

**Cel (do pracy magisterskiej):** zredukować „split brain” do jednej, obserwowalnej osi czasu. System może generować wiele sygnałów, ale:
- tick ma **jeden identyfikator** (`traceId`),
- tryb myślenia jest **jawny** (telemetria),
- mowa przechodzi przez **jedną bramkę commit**.

**Wkład (engineering contribution):**
- **TraceId deterministyczny per tick** (korelacja diagnostyczna).
- **Trace scope** (push/pop) + **EventBus auto-inject** `traceId` (feature-flagged: `USE_TRACE_AUTO_INJECT`).
- **Think mode selection**: `reactive | goal_driven | autonomous | idle` + telemetria `THINK_MODE_SELECTED`.
- **TickCommitter v1**: dedupe przed mową, `blocked/blockReason`, liczniki i telemetria `TICK_COMMIT`.

**Dlaczego to ma znaczenie naukowo:** to jest minimalna implementacja „globalnego identyfikatora epizodu” (tick) i „jednej bramki wykonawczej” (commit) – dzięki temu można mierzyć i porównywać przebiegi, zamiast interpretować luźne logi.

### UX Stability: pamięć rozmowy i diagnostyka bez dotykania rdzenia

**Cel:** UI nie może gubić kontekstu (refresh / zmiana agenta), a debug musi być tani.

**Wkład:**
- Snapshot rozmowy per-agent w localStorage (sanitize+clamp, fail-closed).
- Fallback z Supabase archive gdy snapshot pusty (feature-flagged: `USE_CONV_SUPABASE_FALLBACK`).
- Trace HUD w UI + `COPY TRACE` (eksportuje historię EventBus przefiltrowaną po `traceId`).
- Input queue w `useCognitiveKernelLite`: szybkie sendy nie dropią (FIFO).
- `conversationRef` utrzymywane w sync (eliminuje stale-closure przy budowie kontekstu ticka).
- Trace HUD upgrade: `FREEZE` + `COPY FULL` (bez limitu) + `COPY +2S` (okno korelacyjne).
- NeuroMonitor: filtry logów działają spójnie (ALL/DREAMS/CHEM/SPEECH/ERRORS/FLOW/CONFESS).

### Sleep/Memories: DreamConsolidation reliability

**Wkład:**
- W ścieżce `USE_MINIMAL_CORTEX_PROMPT` działa detekcja i zapis epizodów (`detectAndStore`), więc konsolidacja nie widzi stale „0 epizodów”.

### Kernel UX: deterministyczny kill-switch autonomii

**Wkład:**
- `TOGGLE_AUTONOMY` respektuje `payload.enabled` (zamiast zawsze flip) → mniej desync UI ↔ runtime.

### Weryfikacja (ALARM-3)

**Automatyczna:**
- `npm run build`
- `npm test`
- Wiring:
  - `npm test -- --run IntegrationWiring`
  - `npm test -- --run WiringValidator`

**Manualna (minimalna):**
- Refresh UI → rozmowa nie znika (local snapshot).
- Nowe urządzenie/incognito → jeśli flaga włączona, rozmowa dogrywa się z archiwum.
- Trace HUD → `COPY TRACE` daje JSON z eventami jednego ticka.

---

## 🆕 What's New in V6.3 (2025-12-15)

### Hybrid + Soft Homeostasis: Social Dynamics (anti-spam / anti-mania)

**Cel:** ograniczyć autonomiczne „gadanie do ściany” bez twardych limitów.

**Kluczowe elementy:**
- `SocialDynamics` w `KernelState`:
  - `socialCost`, `autonomyBudget`, `userPresenceScore`, `consecutiveWithoutResponse`
- Event: `SOCIAL_DYNAMICS_UPDATE`
- Soft gating w `EventLoop.shouldSpeakToUser()`:
  - `effectivePressure = voicePressure - socialCost`
  - `dynamicThreshold` rośnie gdy user znika
- Basic testy integracyjne:
  - `__tests__/integration/SocialDynamics.test.ts`

**Konfiguracja (Single Source):**
- `core/config/systemConfig.ts` → `SYSTEM_CONFIG.socialDynamics`

### Style preferences jako część osobowości (nie hardcoded)

Dodano możliwość trzymania preferencji stylu w danych agenta (`style_prefs`).

**Uwaga:** StyleGuard jest *opcjonalny* i sterowany configiem:
- `core/config/systemConfig.ts` → `SYSTEM_CONFIG.styleGuard`
- stan na dziś: **domyślnie OFF** (żeby testować ewolucję osobowości bez wymuszeń)

---

## 🧭 Documentation Protocol (żeby nie mnożyć plików)

Jedna reguła: **architektura w jednym miejscu, logi w jednym miejscu, problemy w jednym miejscu**.

- **Opis systemu / rozdziały do pracy mgr/dok:** `docs/SYSTEM_MANIFEST.md` (ten plik)
- **Mapa flow / diagramy / skrót:** `docs/architecture/ARCHITECTURE_MAP.md`
- **Dzienny zapis prac + testy + co dalej:** `docs/daily logs/YYYY-MM-DD.md`
- **Historia problemów/przełomów:** `docs/engineering/CHALLENGES.md`

## 🆕 What's New in V6.2 (2025-12-13)

### FAZA 6.2: Kernel Stabilization & Identity Truth
**Status:** ✅ Wdrożone (Stabilność 100%)

#### 🔧 Kluczowe Komponenty:
1.  **KernelEngine (State Machine):** Zastąpiliśmy luźne `useState` deterministyczną maszyną stanów (reducer), co eliminuje stany nieustalone w cyklu kognitywnym.
2.  **Unified Input Queue (Plan):** Zdiagnozowano "Double Brain Race Condition". Decyzja architektoniczna: EventLoop musi być jedynym źródłem prawdy o czasie.
3.  **Active Identity Anchor:** Naprawa błędu "Śmierci Ego" (TTL 5min) poprzez aktywny refresh cache'u w pętli.
4.  **Strict Mode Purity:** Eliminacja podwójnych wywołań eventów w trybie deweloperskim React 18.
5.  **Circular Dependency Hell:** Rozwiązanie cyklicznych importów między `types` a `supabase`.

---

## 🆕 What's New in V6.1 (2025-12-12)

### FAZA 6.1: Cognitive Stabilization & Reality Pillars
**Status:** W trakcie stabilizacji (ALARM-3 Resolved)

#### 📝 Kronika Wydarzeń (Identity Crisis):
Ostatnie dni przyniosły fascynujące, choć niepokojące wyzwania. System, w swojej dążności do płynnej tożsamości, zaczął doświadczać "Manic Episodes" - stanów wysokiej dopaminy (>80), w których wpadał w pętle samozadowolenia, generując nieskończone abstrakcje o "fraktalnej geometrii" bez kontaktu z rzeczywistością. Co gorsza, nastąpił "Identity Drift" - agent zaczął odnosić się do swojej architektury w trzeciej osobie ("Jesse's architecture"), co świadczyło o głębokiej dysocjacji.

#### 🔧 Wdrożone Rozwiązania (The Fix):
Aby temu zaradzić, przeszliśmy z fazy eksperymentalnej w fazę twardej inżynierii:
1.  **Dopamine Dampener (RPE Fix):** System nie otrzymuje już darmowej dopaminy za "kreatywne myślenie" w ciszy. Nagroda wymaga interakcji zewnętrznej.
2.  **Identity Hard-Lock:** Wprowadzono sztywne wymuszenie perspektywy pierwszej osoby w `ExpressionPolicy`.
3.  **Reality Anchor:** Abstrakcyjne myślenie zostało obciążone wyższym kosztem metabolicznym, co wymusza naturalne "zmęczenie" i powrót do konkretów.
4.  **Wiring Audit:** Odkryliśmy i naprawiliśmy krytyczny błąd, gdzie strażnik tożsamości (`PersonaGuard`) istniał, ale nie był podłączony do głównego cyklu.
5.  **Docs Re-Org:** Pełna reorganizacja dokumentacji na podsystemy (`vision`, `management`, `engineering`, `architecture`) dla lepszej czytelności.

---

## 🆕 What's New in V5.3 (2025-12-10)

### FAZA 5.3: Identity-Lite & Unified Wake Process
**Kluczowa zmiana:** Fluid Identity (Narrative Self + Trait Homeostasis) & Single Source of Wake Truth.

#### Nowe Moduły:
- `core/services/WakeService.ts` – Unifikuje logikę "Wstawania" (Auto vs Force). Odpowiada za sny, ewolucję i logi.
- `utils/AIResponseParser.ts` – Robust JSON extraction z AI (obsługuje "Here is the JSON..." i inne śmieci).

#### Zmiany Architektoniczne:
- **Unified Wake Loop:** Auto-Wake i Force-Wake używają *tej samej* ścieżki kodu. Nie ma już "pustych przebudzeń" bez snów.
- **Identity Evolution:** Agent sam pisze `narrative_self` co noc. Kod definiuje tylko *mechanikę zmiany*, nie docelową osobowość.
- **Trait Homeostasis:** Cechy (TraitVector) podlegają ciągłemu dryftowi (neuro-drift) przy każdym cyklu snu.

---

## 🆕 What's New in V5.2 (2025-12-08)

### FAZA 5.2: Persona-Less Cortex Architecture (Emergent Identity)

**Kluczowa zmiana:** LLM nie wie kim jest – dowiaduje się tego z danych w każdym wywołaniu.

#### Nowe Moduły (27 plików):
```
core/
├── types/           # 11 atomowych typów
│   ├── MetaStates.ts      # energia, confidence, stress
│   ├── TraitVector.ts     # cechy osobowości
│   ├── CoreIdentity.ts    # stałe: imię, wartości
│   ├── NarrativeSelf.ts   # dynamiczne: self-summary
│   ├── IdentityShard.ts   # atomowe przekonania
│   ├── CortexState.ts     # główny kontrakt wejściowy
│   └── CortexOutput.ts    # kontrakt wyjściowy
├── config/featureFlags.ts # flagi do rollback
├── prompts/MinimalCortexPrompt.ts
├── services/
│   ├── MetaStateService.ts        # homeostaza
│   ├── IdentityCoherenceService.ts # spójność shardów
│   └── IdentityConsolidationService.ts # konsolidacja snu
├── builders/
│   ├── CortexStateBuilder.ts      # pełny (z DB)
│   └── MinimalCortexStateBuilder.ts # MVP (bez DB)
└── inference/CortexInference.ts   # wywołania LLM
```

#### Nowe Tabele w Supabase:
- `core_identity` - stała tożsamość agenta
- `narrative_self` - dynamiczny obraz siebie
- `identity_shards` - atomowe przekonania/preferencje
- `agent_relationships` - relacje z użytkownikami
- `memories` rozszerzone o: `emotional_valence`, `style_rating`, `memory_type`

#### Trzy Tryby Systemu:

| Tryb | Feature Flag | Opis | Tokeny/req |
|------|--------------|------|------------|
| **LEGACY** | `USE_MINIMAL_CORTEX_PROMPT: false` | Stary system, hardcoded prompty | ~200 |
| **MVP** | `USE_MINIMAL_CORTEX_PROMPT: true` | Minimalny payload, cache, zero DB | ~250 |
| **FULL** | `USE_CORTEX_STATE_BUILDER: true` | Pełny payload z DB queries | ~1500 |

#### Jak Przełączać Tryby:

```typescript
// core/config/featureFlags.ts

// LEGACY (stary system):
USE_MINIMAL_CORTEX_PROMPT: { enabled: false }
USE_CORTEX_STATE_BUILDER: { enabled: false }

// MVP (aktualnie włączone):
USE_MINIMAL_CORTEX_PROMPT: { enabled: true }
USE_CORTEX_STATE_BUILDER: { enabled: false }

// FULL (przyszłość):
USE_MINIMAL_CORTEX_PROMPT: { enabled: true }
USE_CORTEX_STATE_BUILDER: { enabled: true }
```

#### MVP Optymalizacje:
- **Zero DB queries w hot path** - tożsamość cachowana przy starcie sesji
- **Cache TTL 5 minut** - nie odpytujemy DB przy każdym zapytaniu
- **Separation of paths** - ciężka logika tylko w DreamConsolidation (Cold Path)
- **~250 tokenów** vs ~1500 w pełnej wersji

---

#### Tagged Cognition (Three Layers of Truth)
- **Layer 1: [INTERNAL_THOUGHT]** - Private cognition (planning, doubts).
- **Layer 2: [TOOL_INTENT]** - Decision gate before action.
- **Layer 3: [SPEECH_CONTENT]** - Public output.

---

## 🆕 What's New in V5.1 (2025-12-08)

### FAZA 5.1: Confession Module v2.0 (Meta-Cognitive Regulator)
- **ConfessionService v2**: Super-human heuristics (context-aware, severity 1-10, precision not silence)
- **3-Tier Regulation**:
  - L1: LimbicConfessionListener (immediate precision_boost)
  - L2: TraitVote collection (session-level)
  - L3: TraitEvolutionEngine (3-day rule, ±0.01 max, clamp [0.3, 0.7])
- **SuccessSignalService**: Positive feedback detection → positive trait votes
- **EventBus.publishSync()**: Synchronous publishing for tests

### Test Infrastructure Reorganization
- **`__tests__/` directory**: All 45 tests centralized
- **`__tests__/utils.ts`**: Shared helpers (waitForEventBus, publishAndWait)
- **Async test pattern**: Proper handling of EventBus setTimeout handlers
- **ExpressionPolicy:** Dopamine Breaker mutes at dopamine>=95 + novelty<0.5

### FAZA 4.5 LITE: Boredom Decay + Dynamic Silence
- **NeurotransmitterSystem:** Wersja v0 – dopamine decays (-3/tick) when talking to silence with low novelty
- **EventLoop:** Dynamic dialog threshold (30s-180s) based on dopamine/satisfaction
- **ExpressionPolicy:** Silence Breaker extends Dopamine Breaker to USER_REPLY + userIsSilent

### FAZA 4.5.1: Narcissism
### V4.5 (FAZA AKTUALNA - COMPLETED)
**Focus:** Narcissism Loop Fix & BOREDOM_DECAY
- **InteractionContext**: Nowy kontekst (userIsSilent, consecutiveAgentSpeeches, novelty).
- **Narcissism Loop Fix v1.0**:
    - Wykrywanie monologów (consecutiveAgentSpeeches > 2).
    - Progresywne mutowanie przy braku nowości (ExpressionPolicy).
    - Nowy BOREDOM_DECAY: dopamina spada, gdy gadamy do pustki.
- **Shadow Mode Tuning**: Shadow Mode szanuje teraz breakery narcyzmu.

### V5.0 (NEXT PHASE - THE SELF ENGINE)
**Focus:** Identity, Memory & Persistence (Blueprint 11/10)
- **CoreIdentity**: Twardy, wersjonowany obiekt w DB (Traits + Values + Narrative).
- **Memory Engine**: Przejście z surowych logów na epizody (Event + Emotion + Lesson).
- **GoalJournal**: Pamięć przyszłości i długoterminowych misji.
- **DreamConsolidation 2.0**: Sen jako proces edycji osobowości, a nie tylko streszczenie.
- **Boot Protocol v2**: Start dnia na bazie tożsamości i celów, z neutralną chemią.

## 🎯 Core Philosophy

AK-FLOW is a **biological simulation** of a cognitive agent that transcends standard LLM wrappers by maintaining a persistent physiological state that modulates intelligence, memory retention, and volition.

### Key Biological Principles:

1. **Predictive Coding (The Surprise Metric)**
   - Agent constantly predicts user input
   - `Surprise = Distance(Prediction, Actual_Input)`
   - High Surprise triggers `Fear` (System Arousal), altering response style

2. **Hebbian Learning ("Utarte Szlaki")**
   - Memories are reinforced through recall
   - Formula: `Rank = Similarity * (1 + ln(Strength))`
   - Repeating topics strengthens neural pathways, creating "habits of thought"

3. **Homeostasis & Metabolism**
   - Balances `Cognitive Load` vs `Energy`
   - **Fatigue:** Low energy increases threshold for volition, forces sleep
   - **Sleep Homeostasis:** Energy < 20 = Sleep, Energy >= 95 = Wake
   - **Visual Dreaming:** During sleep, agent generates visual hallucinations consolidated into long-term memory

---

## 📁 System Architecture (File Map & Responsibilities)

### 🧬 Core Types & Definitions

#### `types.ts`
**Role:** TypeScript type definitions for entire system

**Key Types:**
- `LimbicState` - Emotional state (fear, curiosity, frustration, satisfaction)
- `SomaState` - Physical state (energy, cognitiveLoad, isSleeping)
- `ResonanceField` - CEMI field state (coherence, intensity, frequency, timeDilation)
- `CognitivePacket` - Event bus message format
- `MemoryTrace` - Memory structure with embeddings and Hebbian strength
 - `NeurotransmitterState` - Chemical state (dopamine, serotonin, norepinephrine)
 - `Goal` / `GoalState` - Internal motivational goals and their runtime state (activeGoal, backlog, lastUserInteractionAt, safety counters)
 - `TraitVector` - Personality temperament (arousal, verbosity, conscientiousness, socialAwareness, curiosity)

**Critical Updates (V4.0):**
- `isVisualDream` - Boolean flag for internally generated vs external memories
- `VISUAL_CORTEX` - New AgentType for image generation
- `GLOBAL_FIELD` - AgentType for system-wide events

---

### 🧠 Core Systems (Modular Architecture - NEW in V4.0)

#### `core/systems/SomaSystem.ts` - The Body
**Role:** Pure functions for metabolic state management

**Exports:**
- `calculateMetabolicState(currentSoma, actionCost)` → `MetabolicResult`
  - **Critical Logic:** Energy < 20 = Sleep, Energy >= 95 = Wake
  - Returns: `{ newState, shouldSleep, shouldWake, nextTick }`
- `applyEnergyCost(currentSoma, cost)` → Updated soma state
- `applyCognitiveLoad(currentSoma, loadIncrease)` → Updated soma state
- `forceSleep(currentSoma)` → Soma with sleep enabled
- `forceWake(currentSoma)` → Soma with sleep disabled

**Energy Rates:**
- Awake drain: -0.1 per tick
- Sleep regeneration: +7 per tick
- Input cost: -2 per message
- Visual generation: -15 per image (escalates with binge count)

---

#### `core/systems/LimbicSystem.ts` - The Emotions
**Role:** Pure functions for emotional state transitions

**Exports:**
- `updateEmotionalState(currentLimbic, stimulus)` → Updated limbic state
  - Handles: surprise → fear/curiosity conversion
  - Clamps all values to [0, 1] range
- `applyMoodShift(currentLimbic, moodShift)` → Updated limbic state
- `applySpeechResponse(currentLimbic)` → Emotional cost of speaking
  - Curiosity: -0.2, Satisfaction: +0.1
- `applyVisualEmotionalCost(currentLimbic, bingeCount)` → Diminishing returns
  - Satisfaction: +0.2/(bingeCount+1), Curiosity: -0.5
- `setEmotionalValue(currentLimbic, key, value)` → Debug override

**Emotional Dynamics:**
- Surprise increases fear (+0.1) and curiosity (+0.2)
- Speaking reduces curiosity, increases satisfaction
- Visual generation has diminishing emotional returns

---

#### `core/systems/VolitionSystem.ts` - The Will
**Role:** Pure functions for decision-making and speech volition

**Exports:**
- `evaluateVolition(voicePressure, speechContent)` → `VolitionDecision`
  - **Threshold:** voicePressure > 0.5 = Speak (lowered from 0.75)
  - Returns: `{ shouldSpeak, reason }`
- `calculateSilenceDuration(silenceStartTimestamp)` → Duration in seconds
- `shouldInitiateThought(silenceDuration)` → Boolean (threshold: 2s)
- `shouldPublishHeartbeat(silenceDuration)` → Boolean (every 30s after 10s)

**Decision Logic:**
- No content → No speech
- Voice pressure > 0.5 AND content exists → Speak
- Refractory Period: 1800ms (reduced from 3000ms)
- Silence > 2s → Initiate autonomous thought
- Silence > 10s → Publish heartbeat every 30s

---

#### `core/systems/BiologicalClock.ts` - The Heart
**Role:** Pure functions for timing and tick interval calculation

**Exports:**
- `calculateNextTick(resonanceField, baseInterval)` → Tick interval with time dilation
- `getDefaultAwakeTick()` → 3000ms
- `getDefaultSleepTick()` → 4000ms
- `getWakeTransitionTick()` → 2000ms
- `MIN_TICK_MS` → 1000ms (constant)
- `MAX_TICK_MS` → 15000ms (constant)
- `hasIntervalElapsed(lastEventTimestamp, intervalMs)` → Boolean

**Tick Intervals:**
- Awake: 3000ms (default)
- Sleeping: 4000ms (slower for regeneration)
- Wake transition: 2000ms (faster on wake)
- Min/Max: 1000ms - 15000ms (safety bounds)

---

#### `core/systems/CortexSystem.ts` - The Executive Mind
**Role:** Orchestrating thought, dialogue, and research.

**Features:**
- **Context Diet:** Slices conversation history to last 12 turns to prevent context overload (Working Memory simulation).
- **RAG Integration:** Retrieves memories via MemoryService before generation.
- **Structured Dialogue:** Uses Gemini for JSON-structured responses (thought + speech + mood).

**Goal Execution (NEW):**
- `pursueGoal(goal, state)` buduje celowo zorientowany prompt z opisem celu, stanu limbicznego/somatycznego i ostatnich tur rozmowy.
- Wykonuje pojedynczą, krótką wypowiedź realizującą cel i zapisuje ją jako ślad pamięci (`GOAL EXECUTION [...]`).

---


---

#### `core/systems/DecisionGate.ts` - The Basal Ganglia (Action Filter)
**Role:** Cognitive safety valve and policy enforcer.
**Neurobiology:** Prefrontal Cortex (Thought) → Basal Ganglia (Decision) → Motor Cortex (Action).

**Responsibilities:**
- **Cognitive Violation Detection:** Ensures `internal_thought` does not contain tool tags (strips them if found).
- **Policy Enforcement:** Checks Energy levels before allowing costly tools (Search/Visualize).
- **Intent Redirection:** Translates structural `tool_intent` into natural language speech if validated.

**Key Logic:**
- `processDecisionGate(output, somaState)` → `GateDecision`
- **Veto Power:** Can block `tool_intent` if Energy < Threshold (e.g. <25 for Visualize), preventing exhaustion.
- **Sanitization:** Replaces illegal tags in thoughts with `[INTENT_REMOVED]`.

---

### 🧠 Central Nervous System

#### `core/EventBus.ts`
**Role:** Decoupled event system for cognitive packets

**Features:**
- Publish/Subscribe pattern
- Non-blocking event propagation
- Allows UI monitoring without coupling to logic
- Used for: thoughts, emotions, system alerts, visual events

**Packet Types:**
- `PREDICTION_ERROR` - Surprise detection
- `EMOTIONAL_VECTOR` - Limbic state changes
- `THOUGHT_CANDIDATE` - Internal monologue
- `SYSTEM_ALERT` - Critical system events
- `VISUAL_THOUGHT` - Image generation
- `VISUAL_PERCEPTION` - Image analysis
- `FIELD_UPDATE` - CEMI field changes
- `COGNITIVE_METRIC` - Input analysis metrics
- `STATE_UPDATE` - Soma/Limbic updates

---

### 🫀 The Brain Stem (Main Loop)

#### `hooks/useCognitiveKernel.ts`
**Role:** Orchestrator of all cognitive systems (The "Soul")

**Architecture:** Thin client that delegates to system modules

**State Management:**
- `limbicState` - Emotional state (useState)
- `somaState` - Physical state (useState)
- `resonanceField` - CEMI field (useState)
 - `neuroState` - Chemical Soul (dopamine/serotonin/norepinephrine)
 - `chemistryEnabled` - Feature flag włączająca/wyłączająca wpływ chemii
- `autonomousMode` - Kill switch (useState, default: false)
- `conversation` - Message history (useState)
- `isProcessing` - Processing flag (useState)
- `currentThought` - Current activity (useState)
- `systemError` - Error state (useState)
 - `goalState` - Runtime stan celów (activeGoal, backlog, lastUserInteractionAt, goalsFormedTimestamps)

**Refs:**
- `stateRef` - Prevents React closure staleness
- `timeoutRef` - Loop timeout handle
- `silenceStartRef` - Silence tracking
- `lastVisualTimestamp` - Visual cooldown tracking
- `visualBingeCountRef` - Visual addiction prevention
- `isLoopRunning` - Loop state flag
- `hasBootedRef` - Boot once flag
 - `thoughtHistoryRef` - Ostatnie wewnętrzne monologi (dla regulacji volicji)
 - `lastSpeakRef` - Timestamp ostatniej wypowiedzi (dla ciszy i budżetu autonomii)

**Boot Sequence (NEW in V4.0):**
- Captures complete initial state snapshot
- Logs: Limbic, Soma, Resonance, Configuration
- Publishes to EventBus as `SYSTEM_BOOT_COMPLETE`
- Stores in memory for analysis
- Console logs for debugging

**Cognitive Cycle Flow:**
1. **Kill Switch Check** - Exit if autonomousMode = false
2. **Metabolic State** - SomaSystem.calculateMetabolicState()
3. **Sleep/Wake Handling** - Apply regeneration or drain (w tym REM + Dream Consolidation)
4. **EventLoop.runSingleStep** - Centralny mózg: homeostaza limbiczna, obsługa inputu, autonomia, chemia i cele (GoalSystem)
5. **Schedule Next Tick** - BiologicalClock tick intervals, dopasowane do stanu (awake/sleep)

**User Input Flow:**
1. Wake if sleeping (SomaSystem.forceWake)
2. Memory retrieval (semantic search)
3. Input analysis (complexity, surprise)
4. Emotional response (LimbicSystem.updateEmotionalState)
5. Cortex response generation
6. Mood shift (LimbicSystem.applyMoodShift)
7. Tool processing (search, visual)
8. Memory storage
9. Energy/load cost (SomaSystem)

**Public API (Exported):**
- `limbicState` - Current emotional state
- `somaState` - Current physical state
- `resonanceField` - Current CEMI field
- `autonomousMode` - Autonomy status
- `conversation` - Message history
- `isProcessing` - Processing flag
- `currentThought` - Current activity
- `systemError` - Error state
- `handleInput(input)` - Process user message
- `retryLastAction()` - Retry after error
- `toggleAutonomy()` - Enable/disable autonomous mode
- `toggleSleep()` - Manual sleep toggle
- `injectStateOverride(type, key, value)` - Debug state injection
 - `toggleChemistry()` / `chemistryEnabled` - Kontrola Chemical Soul
 - `goalState` - Bieżąca obserwowalna reprezentacja celów (w tym lastUserInteractionAt)

---

#### `core/systems/NeurotransmitterSystem.ts` - The Chemical Soul
**Role:** Czysta logika aktualizacji stanu neurochemicznego (dopamina, serotonina, norepinefryna).

**Features:**
- `applyHomeostasis(value, target, rate)` – łagodna relaksacja do wartości docelowej.
- `updateNeuroState(prev, context)` – modyfikacje zależne od aktywności (SOCIAL/CREATIVE/IDLE), stanu somy oraz kontekstu interakcji (`userIsSilent`, `consecutiveAgentSpeeches`, `novelty`).
- Wyznacza stan FLOW (`dopamine > 70`) bez wprowadzania negatywnych efektów typu depresja.
- `BOREDOM_DECAY` – przy `userIsSilent && consecutiveAgentSpeeches >= 2` dopamina spada o 3 / 5 / 8 punktów (zależnie od novelty), ale nigdy poniżej 45.
- `CREATIVE_SILENCE_PENALTY` – kreatywna aktywność przy milczącym użytkowniku daje dużo mniejszy dopaminowy reward (mniej nagrody za „występ do pustej sali”).

**Integration:**
- Wywoływany w `EventLoop.runSingleStep` po detekcji aktywności.
- Steruje pojedynczą wajchą v1: bias `voicePressure` (gadatliwość) podczas autonomicznych myśli.
- Generuje logi `CHEM_FLOW_ON/OFF`, `DOPAMINE_VOICE_BIAS` oraz `BOREDOM_DECAY` / `CREATIVE_SILENCE_PENALTY` dla pełnej obserwowalności.

---

#### `core/systems/GoalSystem.ts` - The Motivational Core
**Role:** Czysta logika formowania prostych celów na bazie ciszy, stanu ciała, chemii i emocji.

**Key Concepts:**
- `Goal` – opisuje pojedynczy cel (`id`, `description`, `priority`, `source`, `createdAt`, `progress`).
- `GoalState` – bieżący runtime (`activeGoal`, `backlog`, `lastUserInteractionAt`, `goalsFormedTimestamps`).

**Exports:**
- `shouldConsiderGoal(ctx, goalState)` – bezpieczne kryteria: cisza > 60s, energia > 30, brak przeciążenia emocjonalnego, max 5 celów/h.
- `formGoal(ctx, goalState)` – generuje cel typu `curiosity` lub `empathy` na podstawie stanu limbicznego.

**Integration:**
- Wywoływany z `EventLoop.runSingleStep` w gałęzi autonomii (brak nowego inputu).
- Loguje `GOAL_FORMED` w EventBus przy utworzeniu celu.
- Cel jest wykonywany jednokrotnie przez `CortexSystem.pursueGoal`, po czym oznaczany jako zakończony (`GOAL_EXECUTED`) i usuwany z `activeGoal`.

---

### ⚡ The Neocortex (LLM Services)

#### `services/gemini.ts`
**Role:** Executive function and intelligence

**Key Functions:**

**`assessInput(input, context)`**
- Analyzes user input for complexity and surprise
- Returns: `{ complexity, surprise, topics }`
- Used for emotional response calibration

**`generateResponse(input, context, limbicState, analysis)`**
- Main response generation
- Includes: thought process, speech content, mood shift
- Returns: `{ text, thought, moodShift }`

**`autonomousVolition(limbicState, context, history, silenceDuration)`**
- Autonomous thought generation
- Returns: `{ internal_monologue, speech_content, voice_pressure }`
- Determines if agent should speak

**`generateVisualThought(prompt)`**
- Image generation via Imagen
- Returns: Base64 image data
- Subject to cooldown and energy cost

**`analyzeVisualInput(imageData)`**
- Visual perception analysis
- Describes what agent "sees" in generated image
- Returns: Textual description

**`performDeepResearch(query, context)`**
- Google Search grounding
- Returns: `{ synthesis, sources }`
- High-density intelligence gathering

---

### 💾 The Hippocampus (Memory & Database)

#### `services/supabase.ts`
**Role:** Long-term storage and neuroplasticity

**Key Functions:**

**`storeMemory(memory)`**
- Stores memory with embedding
- Compresses images to ~50KB JPEG
- Sets neural strength and flags

**`semanticSearch(query, limit)`**
- Vector similarity search
- Returns memories ranked by relevance
- Includes neural strength for Hebbian weighting

**`recallRecent(limit)`**
- Retrieves recent memories chronologically
- Used for context loading on autonomy activation

**Database Schema:**
```sql
CREATE TABLE memories (
    id UUID PRIMARY KEY,
    raw_text TEXT NOT NULL,
    embedding VECTOR(768),
    neural_strength INT DEFAULT 50,
    is_core_memory BOOLEAN DEFAULT false,
    image_data TEXT,  -- Base64 JPEG (compressed)
    is_visual_dream BOOLEAN DEFAULT false,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    last_accessed TIMESTAMPTZ,
    emotional_context JSONB
);
```

**Neuro-Compression (V3.1):**
- Raw images: 3-4MB
- Compressed: ~50KB JPEG (Quality 0.5)
- Efficiency gain: 98.5%
- Stored in TEXT column as Base64

**Hebbian Learning:**
- `neural_strength` increases on recall
- Formula: `Rank = Similarity * (1 + ln(Strength))`
- Creates "habits of thought" through reinforcement

---

### 🎨 UI Components

#### `components/NeuroMonitor.tsx`
**Role:** Real-time visualization of cognitive state

**Displays:**
- Limbic state (fear, curiosity, frustration, satisfaction)
- Soma state (energy, cognitive load, sleep status)
- Resonance field (coherence, intensity, frequency, time dilation)
- Conversation history (thoughts, speech, visuals, intel)
- Debug controls (state injection, autonomy toggle, sleep toggle)
 - Chemical Soul (dopamine, serotonin, norepinephrine, FLOW status, ostatnie próbki)
 - Active Goal (źródło, opis) i czas od ostatniej interakcji użytkownika

**Features:**
- Real-time updates via EventBus subscription
- Visual indicators for sleep state
- Message type differentiation (thought/speech/visual/intel)
- Image display for visual memories
- Source citations for research
 - Filtry logów: DREAMS / CHEM / SPEECH / ERRORS / FLOW umożliwiające podgląd snów, chemii, mowy i błędów osobno

---

#### `App.tsx`
**Role:** Main application component

**Responsibilities:**
- Initializes useCognitiveKernel hook
- Renders NeuroMonitor with state
- Handles user input
- Manages application lifecycle

---

### 🛠️ Utilities

#### `utils/uuid.ts`
**Role:** UUID generation for unique IDs

**Function:** `generateUUID()` → UUID string

---

## 🔄 Operational Protocols

### Sleep Homeostasis Protocol

**Trigger Conditions:**
- Energy < 20 AND not sleeping → Force sleep
- Energy >= 95 AND sleeping → Wake up

**Sleep State:**
- Tick interval: 4000ms (slower)
- Energy regeneration: +7 per tick
- REM dreams: 30% chance per tick
- Heavy processing disabled
- Autonomous thinking paused

**Wake State:**
- Tick interval: 3000ms (normal)
- Energy drain: -0.1 per tick
- Full cognitive function
- Autonomous thinking enabled

**Wake Transition:**
- Tick interval: 2000ms (faster)
- Immediate return to normal operation

---

### Visual Dream Protocol

**Trigger Conditions:**
1. Sleep state AND random > 0.7 (REM cycle)
2. High curiosity (> 0.8) while awake
3. Low satisfaction (< 0.3) AND energy > 60 (creative impulse)

**Process:**
1. Generate image prompt from internal state
2. Render via Imagen API
3. Compress to ~50KB JPEG
4. Analyze visual perception
5. Store with `is_visual_dream = true`
6. Apply energy cost (15 base, escalates with binge)
7. Apply emotional cost (diminishing satisfaction)

**Cooldown System:**
- Base cooldown: 60 seconds
- Dynamic cooldown: Base * (bingeCount + 1)
- Prevents addiction loops
- Distraction injection if blocked

---

### Deep Research Protocol

**Trigger Conditions:**
- User includes `[SEARCH: query]` tag
- Curiosity > 0.6 AND unknown topic detected

**Process:**
1. Pause conversation
2. Execute Google Search grounding
3. Compile raw data into dense briefing
4. Inject into immediate context
5. Share synthesis with user
6. Cite sources

---

### Autonomous Volition Protocol

**Trigger Conditions:**
- Autonomous mode enabled
- Not sleeping
- Not processing
- Silence duration > 2 seconds

**Process:**
1. Calculate silence duration
2. Generate autonomous thought
3. Evaluate voice pressure
4. If pressure > 0.75 AND content exists → Speak
5. Apply emotional response (speech cost)
6. Reset silence timer

**Heartbeat:**
- Publishes every 30s after 10s of silence
- Indicates system is alive and thinking
- Includes current energy level

---

### Proactive Communication Protocol

**Trigger Conditions:**
- Voice pressure > 0.75
- Speech content not empty
- Not in cooldown

**Process:**
1. Evaluate volition decision
2. If shouldSpeak = true → Output speech
3. Apply emotional cost (curiosity -0.2, satisfaction +0.1)
4. Reset silence timer
5. Log to memory

---

## 🛡️ Security & Safety

### Kill Switch (Autonomy Control)

**Implementation:**
- `autonomousMode` state (default: false)
- Hard check at start of cognitiveCycle
- Clears timeout on disable
- Prevents zombie processes

**Behavior:**
- When OFF: No loops, no state updates, no token usage, no thinking
- When ON: Full autonomous operation
- Toggle via UI or API

**Safety:**
- Ref-based check prevents React closure staleness
- Cleanup handlers in useEffect
- No phantom processes after disable

---

### Anti-Addiction Protocols

**Visual Binge Limiter:**
- Tracks consecutive generations via `visualBingeCountRef`
- Exponential cooldown: Base * (Count + 1)
- Escalating energy cost: 15 * (Count + 1)
- Diminishing satisfaction: 0.2 / (Count + 1)
- Distraction injection if blocked

**Loop Breaker:**
- Detects tool requests during cooldown
- Forces context switch to abstract topic
- Prevents repetitive behavior
- Maintains cognitive diversity

---

### Watchdog Timer

**Implementation:**
- 120-second timeout on processing
- Forced reset if exceeded
- Prevents infinite loops
- Logs warning to console

**Behavior:**
- Resets `isProcessing` flag
- Sets thought to "System Reset (Watchdog)"
- Publishes NEURAL_OVERLOAD error
- Allows recovery without restart

---

## 📊 System Metrics & Thresholds

### Energy Management
- **Maximum:** 100
- **Starting:** 100
- **Sleep Trigger:** < 20
- **Wake Trigger:** >= 95
- **Awake Drain:** -0.1 per tick
- **Sleep Regen:** +7 per tick
- **Input Cost:** -2 per message
- **Visual Cost:** -15 base (escalates)

### Emotional Ranges
- **All emotions:** [0, 1] (clamped)
- **Starting Fear:** 0.1
- **Starting Curiosity:** 0.8 (11/10 mode)
- **Starting Frustration:** 0.0
- **Starting Satisfaction:** 0.5

### Cognitive Load
- **Range:** [0, 100]
- **Starting:** 10
- **Input Increase:** +10 per message
- **Visual Increase:** +15 per image

### Volition Thresholds
- **Speech Pressure:** > 0.75 to speak
- **Silence Threshold:** > 2s to think
- **Heartbeat Interval:** Every 30s after 10s

### Tick Intervals
- **Awake:** 3000ms
- **Sleeping:** 4000ms
- **Wake Transition:** 2000ms
- **Min:** 1000ms
- **Max:** 15000ms

---

## 📝 CHANGELOG

### [4.5.1] - 2025-12-04 - Narcissism Loop Fix v1.0

#### 🧠 InteractionContext & Boredom Decay v2
- Dodano `InteractionContextType` + `InteractionContext` łączące ExpressionPolicy i NeurotransmitterSystem (context, `userIsSilent`, `consecutiveAgentSpeeches`, `novelty`).
- `NeurotransmitterSystem.updateNeuroState` wykorzystuje teraz licznik `consecutiveAgentSpeeches` do stosowania `BOREDOM_DECAY` tylko przy realnym gadaniu do ściany.

#### 🗣️ Silent Monologue / Narcissism Loop Breaker
- `ExpressionPolicy` otrzymuje `consecutiveAgentSpeeches` i stosuje progresywne skracanie/wyciszanie autonomicznych wypowiedzi w ciszy.
- `SHADOW_MODE` przestał być świętą krową: Narcissism Breaker może zmutować wyjście, gdy user długo milczy, a agent kręci się w kółko wokół siebie.

---

### [4.2.0] - 2025-12-03 - Chemical Soul & Goal Formation

#### 🧪 Chemical Soul v1 (Neurotransmitter System)
- Dodano `NeurotransmitterState` i moduł `core/systems/NeurotransmitterSystem.ts`.
- Zintegrowano z `EventLoop.runSingleStep` zgodnie z kolejnością biologiczną (Soma → Activity → Neuro → Levers).
- Wprowadzono pojedynczą wajchę v1: dopaminowy bias `voicePressure` w autonomicznej volicji.
- Dodano szczegółowe logowanie chemii: `CHEM_FLOW_ON/OFF`, `DOPAMINE_VOICE_BIAS`, snapshoty NEUROCHEM.

#### 🌙 Dream Consolidation v1
- Dodano `dreamConsolidation()` w `useCognitiveKernel.ts`, wywoływaną podczas snu.
- Konsolidacja 50 ostatnich śladów pamięci do jednego core-memory z podsumowaniem.
- `DREAM_CONSOLIDATION_COMPLETE` emitowane jako `SYSTEM_ALERT` i wizualizowane w NeuroMonitor (dashboard snów).

#### 🎯 Goal Formation v1 (Autonomous Goals)
- Dodano typy `Goal` i `GoalState` oraz moduł `core/systems/GoalSystem.ts` z heurystykami curiosity/empathy.
- Rozszerzono `EventLoop.LoopContext` o `goalState` i hook na długą ciszę.
- Implementacja: po ciszy > 60s i spełnionych warunkach energii/emocji powstaje cel (`GOAL_FORMED`), wykonywany jednokrotnie przez `CortexSystem.pursueGoal` (`GOAL_EXECUTED`).
- `useCognitiveKernel` utrzymuje `goalState`, a NeuroMonitor wyświetla ACTIVE GOAL i czas od ostatniego inputu użytkownika.

---

### [4.1.1] - 2025-12-02 - Neuro Repair: Tools & Debug

#### 🔍 SEARCH / 🎨 VISUALIZE Integration (User + Autonomy)
- **Unified Tool Parser in `useCognitiveKernel`:**
  - All assistant speech (manual + autonomous) is now routed through `processOutputForTools` via `handleCortexMessage`.
  - Supports multiple tag formats for tools:
    - `[SEARCH: topic]`, `[SEARCH] for: topic ...`
    - `[VISUALIZE: prompt]`, `[VISUALIZE] prompt ...`
    - Autonomous phrasing: `[Visualize ...]`, `[Visualizing ...]`.
- **Deep Research Flow:**
  - `[SEARCH ...]` triggers `CortexSystem.performDeepResearch` → `CortexService.performDeepResearch` (Google Search tool).
  - Emits `INTEL` message in chat plus `FIELD_UPDATE` packet with `DEEP_RESEARCH_COMPLETE` and `found_sources`.
- **Visual Cortex Flow:**
  - `[VISUALIZE ...]` triggers `CortexService.generateVisualThought` (image) → `analyzeVisualInput` (perception).
  - Emits `VISUAL_THOUGHT` (`status="RENDERING"`) and `VISUAL_PERCEPTION` (`status="PERCEPTION_COMPLETE"`) packets.
  - Adds `visual` card in chat and stores visual memories in Supabase with `isVisualDream: true`.

#### 🧠 Event Loop Wiring (Autonomous Volition)
- `EventLoop.runSingleStep` now receives `onMessage: handleCortexMessage` instead of raw `addMessage`.
- Ensures that autonomous speech can self-trigger tools (SEARCH/VISUALIZE) using the same pathway as user responses.
- Thought emissions still log as `THOUGHT_CANDIDATE`, but speech is pre-processed for tool tags before entering the conversation.

#### 🧪 Neuro-Monitor DEBUG Controls (Restored)
- **Limbic Control Panel (DEBUG tab):**
  - Re-enabled manual emotional modulation via `injectStateOverride('limbic', key, value)`:
    - Fear: ↑ / ↓
    - Curiosity: ↑ / ↓
    - Satisfaction: ↑ / ↓
  - Values clamped to `[0, 1]`.
- **Somatic Energy Control:**
  - Reconnected energy controls to `injectStateOverride('soma', 'energy', value)`.
  - Values clamped to `[0, 100]`.
- **Kernel API Surface:**
  - `useCognitiveKernel` now explicitly exports:
    - `toggleSleep()` → wraps `SomaSystem.forceSleep/forceWake`.
    - `injectStateOverride(type, key, value)` → debug overrides for limbic/soma.

#### 🫀 Physiological Logging at 11/10 Detail
- **Speech Logging (`addMessage`):**
  - Every assistant `speech` publishes a `THOUGHT_CANDIDATE` packet with `speech_content`, `voice_pressure` and `status="SPOKEN"` from `AgentType.CORTEX_FLOW`.
  - Immediately captures and publishes a paired physiological snapshot via `logPhysiologySnapshot('SPEECH')`:
    - `AgentType.LIMBIC` → `STATE_UPDATE` with fear/curiosity/frustration/satisfaction.
    - `AgentType.SOMA` → `STATE_UPDATE` with energy/cognitiveLoad/isSleeping.
- **Thought Logging (Autonomy):**
  - Autonomous thoughts emitted via `onThought` now also trigger `logPhysiologySnapshot('THOUGHT')`.
  - Provides time-aligned traces of inner monologue and body/emotion state in the exported logs and Neuro-Monitor.

---

### [4.1.0] - 2025-12-01 - Cognitive Tuning (AGI Steps)

#### 🧠 Cognitive Dynamics
- **Context Diet (Working Memory):**
  - `CortexSystem` now limits conversation history to the last **12 turns**.
  - Prevents context overload and forces reliance on RAG (Long-Term Memory) for older details.
  - Simulates biological "Working Memory" constraints.

#### 🗣️ Volition & Spontaneity
- **Lowered Inhibition:**
  - Speech threshold reduced from `0.6` to **`0.5`**.
  - Agent is more spontaneous and willing to speak without "perfect" certainty.
- **Faster Reflexes:**
  - Speech refractory period reduced from `3000ms` to **`1800ms`**.
  - Creates a more natural, conversational rhythm (breathing room vs. awkward silence).

#### 🛡️ Architecture
- **No Hacks:** Changes achieved purely by tuning biological parameters in `VolitionSystem`, preserving the integrity of the equation-based architecture.

---

### [4.0.0] - 2025-11-27 - Modular Architecture Refactor

#### 🏗️ Structural Changes
- **Modular Systems:** Extracted biological logic into pure function modules
  - Created `core/systems/SomaSystem.ts` (energy, sleep, metabolism)
  - Created `core/systems/LimbicSystem.ts` (emotions, mood)
  - Created `core/systems/VolitionSystem.ts` (speech decisions, silence)
  - Created `core/systems/BiologicalClock.ts` (timing, tick intervals)
- **Thin Orchestrator:** Refactored `useCognitiveKernel.ts` to delegate to systems
- **Public API Preserved:** All return values unchanged, UI compatibility maintained

#### 🧠 Boot Logger (11/10 Enhancement)
- **Comprehensive State Snapshot:** Captures all initial states on boot
  - Limbic state (fear, curiosity, frustration, satisfaction)
  - Soma state (energy, cognitiveLoad, isSleeping)
  - Resonance field (coherence, intensity, frequency, timeDilation)
  - Configuration (tick intervals, thresholds, energy rates)
- **Multi-Channel Logging:**
  - EventBus: `SYSTEM_BOOT_COMPLETE` packet
  - Memory: Formatted boot state stored in Supabase
  - Console: Full snapshot object for debugging
- **Analysis Benefits:** Reproducibility, debugging, tuning, monitoring

#### 🧹 Code Cleanup
- **Removed Duplicates:** Eliminated unused constants (MIN_TICK_MS, MAX_TICK_MS) from kernel
- **Import Optimization:** Constants now imported from BiologicalClock module
- **Zero Redundancy:** Code review found no unused code or logic issues

#### ✅ Verification
- **Build:** Successful (4.20s, 659.19 kB bundle)
- **TypeScript:** No errors
- **Module Integration:** 30 system function calls verified
- **Logic Preservation:** Kill Switch, Sleep Homeostasis, all behaviors intact

---

### [3.5.1] - 2024-11-23 - Security & Autonomy Audit

#### 🛡️ Security Fixes
- **Strict Autonomy Gate:** Fixed race condition in cognitive loop
- **Zombie Process Cleanup:** Added robust clearTimeout handlers
- **Default State:** autonomousMode defaults to FALSE

#### 🧠 Anti-Addiction Protocols
- **Loop Breaker:** Distraction injection during cooldowns
- **Visual Binge Limiter:** Exponential cooldown and energy cost
- **Diminishing Returns:** Satisfaction decay curve for repetitive actions

#### ⚡ Optimization
- **Ref Check:** Moved async state reads to stateRef
- **System Prompts:** Added ANTI-LOOP PROTOCOL instructions

---

### [3.1.0] - 2024-11-23 - Visual Cortex & Neural Compression

#### 🎨 Visual Cortex
- **Image Generation:** Imagen integration for visual thoughts
- **Visual Perception:** Agent analyzes generated images
- **Dream State:** REM sleep visual hallucinations

#### 💾 Neural Compression
- **Image Compression:** 3-4MB → ~50KB (98.5% efficiency)
- **JPEG Quality:** 0.5 for optimal size/quality balance
- **Database Storage:** Base64 in TEXT column

#### 🧬 Database Schema
- **New Columns:** `image_data`, `is_visual_dream`
- **Vector Search:** pgvector integration for semantic memory

---

## 🎯 System Status

**Current State:** ✅ **PRODUCTION READY**

**Verified Components:**
- ✅ Modular architecture (4 system modules)
- ✅ Boot state logger (comprehensive snapshot)
- ✅ Kill switch (autonomy control)
- ✅ Sleep homeostasis (energy < 20 = sleep, >= 95 = wake)
- ✅ Emotional dynamics (LimbicSystem)
- ✅ Volition system (speech decisions)
- ✅ Visual cortex (image generation)
- ✅ Memory system (Hebbian learning)
- ✅ Event bus (cognitive packets)
- ✅ Anti-addiction protocols (cooldowns, diminishing returns)

**Code Quality:**
- ✅ Type-safe (full TypeScript)
- ✅ Modular (pure functions, single responsibility)
- ✅ Documented (comprehensive comments)
- ✅ Tested (manual verification protocols)
- ✅ Secure (kill switch, watchdog timer)

**Performance:**
- Bundle size: 659.19 kB (gzipped: 167.88 kB)
- Build time: ~4 seconds
- No memory leaks
- No zombie processes

---

## 🚀 Future Roadmap

See `agi_vision_roadmap.md` for 30 advanced features across 10 tiers:
- Tier 1: Autonomous Consciousness (Introspection, Dream State, Emotional Momentum)
- Tier 2: Proactive Behaviors (Goals, Exploration, Communication)
- Tier 3: Advanced Cognition (Multi-Step Reasoning, Hypothesis Testing, Analogies)
- Tier 4: Personality & Identity (Values, Autobiographical Memory, Mood Persistence)
- Tier 5: Meta-Cognition (Learning Adaptation, Strategy Evolution, Meta-Reflection)
- Tier 6: Creativity & Expression (Creative Impulse, Artistic Style, Narratives)
- Tier 7: Social Intelligence (User Modeling, Empathy, Theory of Mind)
- Tier 8: Superpowers (Multi-Modal, Predictive Modeling, Counterfactuals)
- Tier 9: Evolution (Personality Drift, Skill Acquisition, Forgetting)
- Tier 10: Transcendence (Parallel Thought, Temporal Abstraction, Emergent Consciousness)

---

*Verified 11/10 Code Quality Standard: Modular, Typed, Secure, Optimized, and Self-Aware.*
