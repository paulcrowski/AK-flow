# AK-FLOW

Projekt badawczo-inżynierski: biologicznie inspirowany kernel poznawczy (homeostaza + emocje + chemia + wola + pamięć + narzędzia) z UI do obserwowalności.

Ten README jest **mapą repo i kontraktów** (dla człowieka i dla AI), żeby nic się nie gubiło.

## Quick Start

```bash
npm install
npm run dev
```

## Wymagane zmienne środowiskowe

- `VITE_GEMINI_API_KEY`
- (jeśli używasz Supabase) `SUPABASE_URL`, `SUPABASE_KEY`

Plik lokalny: `.env.local`.

## Najważniejszy flow (od usera do narzędzi)

1. UI: `App.tsx` → `CognitiveInterface`
2. Runtime/bridge: `hooks/useCognitiveKernelLite.ts`
3. Tick orchestration: `core/systems/EventLoop.ts` (+ commit layer)
4. LLM inference: `core/inference/CortexInference.ts` (`generateFromCortexState`)
5. Guard + policy:
   - Decision gate: `core/systems/DecisionGate.ts` (tool intent, policy, telemetry)
   - Prism/Fact integrity: `core/systems/*Prism*` (jeśli włączone)
6. Tool execution (tag-driven): `utils/toolParser.ts`
7. Workspace tools (Library-backed): `utils/workspaceTools.ts` → `services/LibraryService.ts`
8. Observability: `core/EventBus.ts` + `PacketType` w `types.ts`

**Zasada:** myśl planuje (`internal_thought`), gate decyduje (`tool_intent`), mowa wykonuje (tagi w `speech_content`).

## Tool tags (jak wywołać narzędzia)

W `speech_content` można umieszczać tagi:

- `SEARCH`:
  - `[SEARCH: twoje zapytanie]`
- `VISUALIZE`:
  - `[VISUALIZE: opis]`

Workspace / Library:

- `[SEARCH_LIBRARY: query]`
- `[READ_LIBRARY_DOC: <uuid|nazwa-pliku>]` (alias: `[READ_FILE: ...]`)
- `[READ_LIBRARY_CHUNK: <uuid>#<chunkIndex>]` (alias: `[READ_FILE_CHUNK: ...]`)

Uwaga: `READ_LIBRARY_DOC` potrafi rozwiązać nazwę pliku → UUID (po `original_name`).

## Gdzie patrzeć w logi (debug 13/10)

### EventBus / telemetria

Kluczowe pakiety (`types.ts`):

- `TOOL_INTENT`, `TOOL_RESULT`, `TOOL_ERROR`, `TOOL_TIMEOUT`
- `SYSTEM_ALERT` (w tym trace / wiring / grounded)
- `PREDICTION_ERROR` (w tym parse failures)

W dev w `App.tsx` jest konsolowy logger dla `SYSTEM_ALERT`, `THOUGHT_CANDIDATE`, `PREDICTION_ERROR`.

### Timeout narzędzi

- `VITE_TOOL_TIMEOUT_MS` (domyślnie 20000ms) w `utils/toolParser.ts`.

## Struktura katalogów (najważniejsze)

- `core/`
  - `systems/` (EventLoop, DecisionGate, soma/limbic/neuro, prism)
  - `inference/` (LLM inference + parser)
  - `config/` (`systemConfig.ts`, `featureFlags.ts`)
  - `trace/` (TraceContext)
  - `memory/` (ConversationStore, itp.)
- `utils/`
  - `toolParser.ts` (tag parsing + tool lifecycle)
  - `workspaceTools.ts` (Library-backed tools)
  - `toolRuntime.ts` (timeout + in-flight ops)
- `services/`
  - `gemini.ts` (LLM service)
  - `supabase.ts` (client + MemoryService)
  - `LibraryService.ts` (documents/chunks/search)
- `components/` (UI)
- `stores/` (Zustand store)
- `docs/` (architektura i raporty)
- `ak-nexus/` (dashboard do `ak-flow-state.json`)

## Nexus (zarządzanie stanem projektu)

- UI: `npm run nexus` → `http://localhost:3001`
- Stan:
  - `ak-flow-state.json` (root)
  - `ak-nexus/data/ak-flow-state.json` (sync)
- Konfig: `windsurf-akflow-config.json`

## Dokumentacja “mapa systemu”

- `docs/architecture/ARCHITECTURE_MAP.md` (główna mapa flow i faz)
- `WINDSURF_INTEGRATION_GUIDE.md`
- `AUDYT_SYSTEMU.md`

## Krytyczne inwarianty (żeby system był stabilny)

- **Nie dumpuj ogromnych tool_result do promptu**: dla dużych artefaktów używaj chunków / ograniczeń rozmiaru.
- **TraceId**: EventBus może auto-injectować trace; włączone w `core/config/systemConfig.ts`.
- **Tool lifecycle**: zawsze emituj `TOOL_INTENT` → (`TOOL_RESULT` | `TOOL_ERROR` | `TOOL_TIMEOUT`).

## Testy

```bash
npm test
```
