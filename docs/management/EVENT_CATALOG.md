# Event Catalog (EventBus) — Operational Telemetry

## Scope
This file documents **operational events** emitted to `eventBus` (mainly `PacketType.SYSTEM_ALERT`) so debugging does not require reading source.

## Core Concepts

### traceId
- **tick trace**: `tick-<startedAt>-<tickNumber>` (generated in `core/trace/TraceContext.ts`)
- **boot trace**: `boot-<timestamp>-<n>` (startup correlation)
- **external trace**: `ext-<timestamp>-<n>` (events outside any tick scope)

### Where events come from
- **Tick lifecycle**: `core/systems/TickLifecycleTelemetry.ts`
- **Reactive / goal / autonomy**: `core/systems/EventLoop.ts`
- **Identity load**: `components/CognitiveInterface.tsx` + `hooks/useIdentitySync.ts`
- **Conversation fallback**: `hooks/useCognitiveKernelLite.ts`

---

## Tick lifecycle (SYSTEM_ALERT)

### TICK_START
- **When**: at the beginning of each `EventLoop.runSingleStep`
- **Fields**:
  - `tickNumber`
- **Goal**: mark new episode boundary; anchor for per-tick trace correlation

### THINK_MODE_SELECTED
- **When**: every tick, after trace init
- **Fields**:
  - `tickNumber`
  - `mode`: `reactive | goal_driven | autonomous | idle`
- **Goal**: explicit phase label for the pipeline

### TICK_SKIPPED
- **When**: tick cannot proceed (e.g. no agent id)
- **Fields**:
  - `tickNumber`
  - `reason`
- **Goal**: fail-closed diagnostics for why tick did not run

### TICK_END
- **When**: end of tick (`finally`)
- **Fields**:
  - `tickNumber`
  - `durationMs`
  - optional: `skipped`, `skipReason`
- **Goal**: tick duration + closure marker

---

## Speech commit layer (SYSTEM_ALERT)

### TICK_COMMIT
- **When**: every attempt to emit speech via `TickCommitter.commitSpeech`
- **Fields**:
  - `tickNumber` (optional)
  - `origin`: `reactive | goal_driven | autonomous`
  - `committed` / `blocked`
  - `blockReason` (e.g. `DEDUPED`, `EMPTY`, `FILTERED_TOO_SHORT`)
  - `deduped`
  - `counters`: `{ totalCommits, blockedCommits, dedupedCommits }`
- **Goal**: single gate for speech output; dedupe + observability

---

## Startup / identity / UI (SYSTEM_ALERT)

### KERNEL_BOOT
- **When**: on kernel initialization (boot sequence)
- **Fields**:
  - `architecture`
  - `message`
- **Goal**: marker that kernel started

### IDENTITY_LOADED
- **When**: agent identity loaded in UI
- **Fields**:
  - `agentId`, `name`, `persona`, `core_values`, `voice_style`, `trait_vector`, `narrative_traits`, `language`
- **Goal**: confirm runtime identity payload

### IDENTITY_SNAPSHOT
- **When**: identity is active in kernel
- **Fields**:
  - `agentId`, `agentName`, `agentPersona`, `traitVector`, `message`
- **Goal**: kernel-side confirmation (useful when UI changes)

---

## Conversation fallback (SYSTEM_ALERT)

### CONV_FALLBACK_DB_ATTEMPT
- **When**: localStorage snapshot empty and fallback enabled
- **Fields**:
  - `agentId`
- **Goal**: diagnostic marker that DB fallback started

### CONV_FALLBACK_DB_EMPTY
- **When**: DB returned no turns
- **Fields**:
  - `agentId`
- **Goal**: distinguishes "DB reachable but empty" from "DB failure"

### CONV_FALLBACK_DB_OK
- **When**: DB returned turns and UI was hydrated
- **Fields**:
  - `agentId`, `count`

### CONV_FALLBACK_DB_FAIL
- **When**: DB request threw
- **Fields**:
  - `agentId`, `error`

---

## Notes
- `CONV_FALLBACK_DB_ATTEMPT` + `CONV_FALLBACK_DB_EMPTY` are **not duplicates**: they represent attempt + outcome.
- For startup correlation, prefer a single `boot-* traceId` shared across boot events.
