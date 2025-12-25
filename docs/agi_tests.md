# AGI Tests Checklist (v1)

Purpose: a lightweight contract for core AGI invariants.
How to use: mark PASS/FAIL and attach evidence links (logs, snapshots, test runs).

Smoke checklist (manual UI):
- [ ] `npm run smoke` passes (test + build)
- [ ] runtime init log is visible
- [ ] `[SNAPSHOT]` creates an artifact and it is visible in the panel
- [ ] "yesterday" questions return numbers + topics

- [ ] evidence-first | Status: PASS | Evidence: Persona Contract in `src/core/context/UnifiedContextBuilder.ts` + FactEcho pipeline `src/core/systems/FactEchoPipeline.ts` (not re-verified today)
- [ ] bootstrap present | Status: PASS | Evidence: runtime init logs in `src/runtime/initRuntime.ts` (not re-verified today)
- [ ] confession wired | Status: PASS | Evidence: `src/runtime/initRuntime.ts` + `src/core/listeners/LimbicConfessionListener.ts` (not re-verified today)
- [ ] strict enabled | Status: PASS | Evidence: `tsconfig.json` strict=true
- [ ] single speech gate path | Status: PASS | Evidence: ExecutiveGate used in `src/core/systems/eventloop/ReactiveStep.ts` + `src/core/systems/eventloop/AutonomousVolitionStep.ts`
- [ ] memory-yesterday | Status: PASS | Evidence: tests in `__tests__/unit/SessionMemory.test.ts` (not re-verified today)
- [ ] memory-topics | Status: PASS | Evidence: tests in `__tests__/unit/SessionMemory.test.ts` (not re-verified today)
- [ ] synaptic memory in state | Status: FAIL | Evidence: not verified in current code
- [ ] hardcoded thresholds in config | Status: FAIL | Evidence: not verified in current code
- [ ] snapshot tool works end-to-end | Status: PASS | Evidence: `src/tools/toolParser.ts` + `__tests__/integration/P0ToolLifecycle.test.ts` (not re-verified today)
- [ ] artifact visible after creation | Status: PASS | Evidence: `src/components/layout/LeftSidebar.tsx` + `__tests__/integration/ActionFirst.test.ts` (not re-verified today)
- [ ] personality: no-assistant-speak | Status: PASS | Evidence: `src/core/systems/PersonaGuard.ts` + `__tests__/integration/PersonaGuard.test.ts` (not re-verified today)
- [ ] silence: valid state | Status: FAIL | Evidence: not verified in current code
- [ ] autonomy chooses CLARIFY with missing data | Status: FAIL | Evidence: not verified in current code
- [ ] deterministic trigger maintained | Status: FAIL | Evidence: not verified in current code
