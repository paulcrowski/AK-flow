# AGI Tests Checklist (v1)

Purpose: a lightweight contract for core AGI invariants.
How to use: mark PASS/FAIL and attach evidence links (logs, snapshots, test runs).

Smoke checklist (manual UI):
- [x] `npm run smoke` passes (test + build) | Evidence: `npm run smoke` 2025-12-25 16:26:22
- [x] runtime init log is visible | Evidence: SYSTEM_ALERT `IDENTITY_LOADED` traceId `boot-1766676835535-1` timestamp `1766676835535`
- [x] `[SNAPSHOT]` creates an artifact and it is visible in the panel | Evidence: TOOL_RESULT artifactId `art-90811036-7ed1-4905-b187-dd8b287a4425` snapshotId `snap-1766676874568-h6i6qsx0d` timestamp `1766676874691` + UI artifacts list shows `snapshot_1766676874567.json`
- [ ] "yesterday" questions return numbers + topics | Status: FAIL | Evidence: manual UI check pending (need SessionMemory recall log); cause TBD (data/prompt/gating)

- [ ] evidence-first | Status: PASS | Evidence: Persona Contract in `src/core/context/UnifiedContextBuilder.ts` + FactEcho pipeline `src/core/systems/FactEchoPipeline.ts` (not re-verified today)
- [ ] bootstrap present | Status: PASS | Evidence: runtime init logs in `src/runtime/initRuntime.ts` (not re-verified today)
- [ ] confession wired | Status: PASS | Evidence: `src/runtime/initRuntime.ts` + `src/core/listeners/LimbicConfessionListener.ts` (not re-verified today)
- [ ] strict enabled | Status: PASS | Evidence: `tsconfig.json` strict=true
- [ ] single speech gate path | Status: PASS | Evidence: ExecutiveGate used in `src/core/systems/eventloop/ReactiveStep.ts` + `src/core/systems/eventloop/AutonomousVolitionStep.ts`
- [ ] memory-yesterday | Status: FAIL | Evidence: manual UI pending (need SessionMemory recall log); tests in `__tests__/unit/SessionMemory.test.ts`; cause TBD (data/prompt/gating)
- [ ] memory-week | Status: FAIL | Evidence: manual UI pending (need SessionMemory recall log); cause TBD (data/prompt/gating)
- [ ] memory-topics | Status: PASS | Evidence: tests in `__tests__/unit/SessionMemory.test.ts` (not re-verified today)
- [ ] synaptic memory in state | Status: PASS | Evidence: `src/core/kernel/initialState.ts` + `src/types.ts`
- [ ] hardcoded thresholds in config | Status: PASS | Evidence: `src/core/config/systemConfig.ts`
- [ ] snapshot tool works end-to-end | Status: PASS | Evidence: `src/tools/toolParser.ts` + `__tests__/integration/P0ToolLifecycle.test.ts` (not re-verified today)
- [ ] artifact visible after creation | Status: PASS | Evidence: `src/components/layout/LeftSidebar.tsx` + `__tests__/integration/ActionFirst.test.ts` (not re-verified today)
- [ ] artifact create parses filename correctly | Status: PASS | Evidence: `__tests__/unit/IntentContract.test.ts` ("CREATE: should parse explicit filename with \"tresc:\" payload")
- [ ] personality: no-assistant-speak | Status: PASS | Evidence: `src/core/systems/PersonaGuard.ts` + `__tests__/integration/PersonaGuard.test.ts` (not re-verified today)
- [ ] single facts validation path | Status: PASS | Evidence: `src/llm/gemini/CortexTextService.ts` + `src/core/systems/cortex/processUserMessage.ts` + `__tests__/integration/FactEchoPipeline.test.ts` + `__tests__/integration/PersonaGuard.test.ts`
- [ ] silence: valid state | Status: PASS | Evidence: `src/core/systems/AutonomyRepertoire.ts` + `__tests__/unit/AutonomyRepertoire.test.ts`
- [ ] autonomy chooses CLARIFY with missing data | Status: PASS | Evidence: `__tests__/unit/AutonomyRepertoire.test.ts` ("should select CLARIFY when user message lacks usable data")
- [ ] deterministic trigger maintained | Status: PASS | Evidence: `src/core/trace/TraceContext.ts` + `__tests__/unit/TraceContext.test.ts`
- [ ] embeddings health visible | Status: PASS | Evidence: `src/components/CognitiveInterface.tsx` + `__tests__/unit/EmbeddingStatus.test.ts` + `__tests__/unit/MemoryServiceEmbeddingFallback.test.ts`
