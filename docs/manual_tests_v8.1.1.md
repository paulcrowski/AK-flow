
# Manual Test Cases: v8.1.1 Deployment (Gate Unblock & Domain Logic)

## 1. Gate Unblock: Tool Response Speech
**Objective:** Verify that the agent speaks immediately after a tool execution, even if the "Silence Window" (5s) has not passed since the user input that triggered it.

**Steps:**
1. **Setup:** Ensure `autonomousMode` is ON.
2. **Action:** User types: "Check files in current directory".
3. **Observation:**
   - Agent should trigger `LIST_DIR` (Action-First).
   - Tool Output should appear.
   - **CRITICAL:** Agent should **IMMEDIATELY** speak (e.g., "I see the following files...").
   - **Verify:** Check logs for `REACTIVE_VETO` or `AUTONOMOUS_WON` with `reason` not being `SILENCE_WINDOW_VIOLATED`.
   - **Verify:** Check `GateContext.isUserFacing` was true during the decision.

## 2. Gate Block: Domain Mismatch
**Objective:** Verify that if the agent *hallucinates* a tool usage in the wrong domain (conceptual mismatch), speech is blocked or suppressed to prevent confusing the user.

**Steps:**
1. **Setup:** (Hard to trigger naturally without mocking). Use `dev` override or specific prompt injection if possible. Or observe logs during chaos testing.
2. **Mock Scenario:**
   - Agent decides to `READ_FILE` (World Domain).
   - But internal routing context expects `LIBRARY`.
   - Tool returns result.
3. **Observation:**
   - Agent generates thought "I read the file...".
   - **CRITICAL:** Executive Gate should **BLOCK** speech with reason `DOMAIN_MISMATCH`.
   - Agent should remain silent or produce only a thought log.

## 3. Passive Autonomy (Silence Window)
**Objective:** Verify that standard autonomous thoughts (not tool responses) are still silenced if user spoke recently.

**Steps:**
1. **Setup:** `autonomousMode` ON.
2. **Action:** User says "Hello".
3. **Immediate Follow-up:** Wait 1 second.
4. **Observation:**
   - Agent should NOT generate spontaneous "I wonder about the weather" thoughts that Result in SPEECH immediately.
   - Thoughts might be generated but Gate should block with `SILENCE_WINDOW_VIOLATED`.
5. **Wait 6 seconds:**
   - Agent should now be allowed to speak autonomously.

## 4. Kernel Event Propagation
**Objective:** Verify `lastTool` state is correctly updated in Kernel.

**Steps:**
1. **Action:** Execute any tool (e.g., `LIST_DIR`).
2. **DevTools/Logs:** Inspect `KernelState`.
3. **Verify:** `state.lastTool` should contain:
   - `tool: 'LIST_DIR'`
   - `ok: true`
   - `domainActual: 'WORLD'` (inferred)
   - `domainExpected` (if routing event occurred)
