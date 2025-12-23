# Dead Code Triage

Goal: stop deleting by hunch. Every candidate gets a callsite audit.

Rules:
- KEEP: at least one callsite in `src/**` (including lazy imports in tools).
- QUARANTINE: no callsite, but historical/reference value.
- DELETE: no callsite + no reference value + causes confusion.

Fields:
- Candidate: file or symbol
- Purpose: why it exists
- Callsite: exact path(s) or "none"
- Flags: feature flag or runtime condition
- Decision: KEEP / QUARANTINE / DELETE
- Notes: follow-ups

| Candidate | Purpose | Callsite | Flags | Decision | Notes |
| --- | --- | --- | --- | --- | --- |
| `VolitionSystem.shouldSpeak` | Legacy speech gate (pre-ExecutiveGate) | `__tests__/unit/VolitionSystem.test.ts` only | None | TBD | No runtime callsites; candidate to quarantine or delete. |
| `VolitionSystem.evaluateVolition` | Legacy autonomy decision helper | `src/core/systems/VolitionSystem.ts` export only | None | TBD | No runtime callsites; consider removing after audit. |
| `SessionMemoryService` | Session stats for "yesterday/today" questions | `src/core/systems/cortex/processUserMessage.ts`, `src/core/systems/eventloop/AutonomousVolitionStep.ts` | None | KEEP | Active runtime usage. |
| `SnapshotService` | Snapshot export + DB save | `src/tools/toolParser.ts` (lazy import) | None | KEEP | Active tool path. |
| `GoalSystem` | Goal formation + journal | `src/core/systems/EventLoop.ts` | None | KEEP | Used in runtime loop. |
| `ConversationArchive` | Supabase message archive | `src/hooks/useCognitiveKernelLite.ts`, `src/core/memory/ConversationStore.ts`, `src/services/SnapshotService.ts` | None | KEEP | Used in runtime. |
| `PrismMetrics` | Trust index + penalty caps | `src/core/systems/FactEchoPipeline.ts` | None | KEEP | Used in pipeline. |
| `BiologicalClock` | Tick schedule defaults | `src/core/kernel/reducer/handlers/tick.ts` | None | KEEP | Used in kernel reducer. |
| `ConfessionService` | Self-regulation reporting | `src/runtime/initRuntime.ts` | None | KEEP | Runtime init. |
| `TraitEvolutionEngine` | Trait homeostasis | `src/core/services/WakeService.ts` | None | KEEP | Singleton in runtime. |
