# RFC: Unified Cortex Architecture (13/10)
> "Delete the lobotomy. One brain, one mind."

## Status: DRAFT - Awaiting Review
**Author:** AK-FLOW Engineering  
**Date:** 2025-12-15  
**Priority:** CRITICAL (Race Condition + Split Brain)

---

## 1. Executive Summary

### Problem Statement
The current architecture has **two fundamental flaws**:

1. **Race Condition (Double Response):** `useConversation.handleInput` calls BOTH `actions.processUserInput()` AND `CortexSystem.processUserMessage()` directly, creating two execution paths for the same input.

2. **Split Brain Syndrome:** `autonomousVolition` is an isolated "island of stupidity" with no access to:
   - Active goals
   - User feedback history
   - RAG memories
   - Recent emotional context

### Evidence from Logs
```
Reactive Mode (High IQ):
  User: "znowu masz manie..." (You are manic again...)
  Agent: "Rozumiem... Skupię się na precyzji... spokoju."
  ✅ Perfect adaptation. Memory utilized.

Autonomous Mode (Low IQ):
  Seconds later...
  Agent: "Ej, ej! Co jeśli... WSZYSTKO jest połączone?!" 🤯
  ❌ Complete amnesia of user's feedback.
```

### Solution
**Unified Input Queue** + **Single Brain Architecture**

---

## 2. Critical Analysis (Karpathy/Hammond Style)

### 2.1 What Could Go Wrong?

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Latency increase (1 tick delay) | HIGH | LOW | Acceptable trade-off for consistency |
| Breaking existing UI flow | MEDIUM | HIGH | Maintain `isProcessing` state, fire events |
| Async queue race conditions | LOW | HIGH | Single-threaded queue, mutex pattern |
| Loss of responsiveness | MEDIUM | MEDIUM | Keep tick interval at 2-3 seconds |
| Test coverage gaps | MEDIUM | MEDIUM | Add integration tests before merge |

### 2.2 Alternative Approaches Considered

#### Option A: Keep Dual Path, Add Mutex
- **Pros:** Minimal changes
- **Cons:** Doesn't fix Split Brain, adds complexity
- **Verdict:** ❌ Rejected - treats symptoms, not cause

#### Option B: Make autonomousVolition smarter
- **Pros:** Less refactoring
- **Cons:** Two codepaths to maintain, divergence over time
- **Verdict:** ❌ Rejected - accumulates tech debt

#### Option C: Unified Queue + Single Brain (CHOSEN)
- **Pros:** Single source of truth, consistent behavior, testable
- **Cons:** Larger refactor, potential latency
- **Verdict:** ✅ Accepted - correct architectural solution

### 2.3 Why This Matters (AGI Principles)

> "A brain that thinks differently about the same situation based on who asked is not a brain - it's a committee."

The current split violates core AGI principles:
1. **Consistency:** Same context → same reasoning
2. **Memory Continuity:** All thoughts should access all memories
3. **Goal Coherence:** Active goals should influence ALL cognition

---

## 3. Proposed Architecture

### 3.1 Unified Input Interface

```typescript
// core/kernel/types.ts - NEW

export type CognitiveSignalType = 
  | 'USER_MESSAGE'      // External: user typed something
  | 'BOREDOM_TICK'      // Internal: silence exceeded threshold
  | 'DREAM_PHASE'       // Internal: sleep consolidation trigger
  | 'GOAL_CHECK'        // Internal: should we pursue active goal?
  | 'TOOL_RESULT';      // External: tool returned data

export interface CognitiveSignal {
  id: string;
  type: CognitiveSignalType;
  timestamp: number;
  payload: CognitiveSignalPayload;
}

export type CognitiveSignalPayload =
  | { type: 'USER_MESSAGE'; text: string; imageData?: string }
  | { type: 'BOREDOM_TICK'; silenceDurationSec: number }
  | { type: 'DREAM_PHASE'; phase: 'REM' | 'NREM' }
  | { type: 'GOAL_CHECK'; goalId: string }
  | { type: 'TOOL_RESULT'; toolType: string; result: any };
```

### 3.2 Unified Input Queue in KernelState

```typescript
// core/kernel/types.ts - MODIFY KernelState

export interface KernelState {
  // ... existing fields ...
  
  // NEW: Unified Input Queue
  inputQueue: CognitiveSignal[];
  
  // NEW: Currently processing signal (for UI state)
  processingSignal: CognitiveSignal | null;
}
```

### 3.3 Single Brain: CortexSystem.processSignal

```typescript
// core/systems/CortexSystem.ts - NEW FUNCTION

export async function processSignal(
  signal: CognitiveSignal,
  context: ProcessContext
): Promise<CortexResponse> {
  
  // 1. ALWAYS: Retrieve relevant memories (RAG)
  const memories = await MemoryService.semanticSearch(
    signal.payload.type === 'USER_MESSAGE' 
      ? signal.payload.text 
      : context.activeGoal?.description || ''
  );
  
  // 2. ALWAYS: Check active goals
  const activeGoal = context.goalState.currentGoal;
  
  // 3. ALWAYS: Check recent user feedback
  const recentFeedback = extractRecentFeedback(context.conversation);
  
  // 4. Build unified prompt
  const prompt = buildUnifiedPrompt({
    signal,
    memories,
    activeGoal,
    recentFeedback,
    identity: context.identity,
    limbic: context.limbic,
    soma: context.soma
  });
  
  // 5. Single inference call
  return await CortexService.generateFromUnifiedPrompt(prompt);
}
```

### 3.4 EventLoop: Consume from Queue

```typescript
// core/systems/EventLoop.ts - MODIFY runSingleStep

export async function runSingleStep(
  ctx: LoopContext,
  callbacks: LoopCallbacks
): Promise<LoopContext> {
  
  // 1. Check input queue
  if (ctx.inputQueue.length > 0) {
    const signal = ctx.inputQueue[0];
    ctx.inputQueue = ctx.inputQueue.slice(1); // Immutable pop
    ctx.processingSignal = signal;
    
    // 2. Process through unified brain
    const response = await CortexSystem.processSignal(signal, {
      limbic: ctx.limbic,
      soma: ctx.soma,
      neuro: ctx.neuro,
      conversation: ctx.conversation,
      goalState: ctx.goalState,
      identity: ctx.agentIdentity
    });
    
    // 3. Handle response
    if (response.speech) {
      callbacks.onMessage('assistant', response.speech, 'speech');
    }
    
    ctx.processingSignal = null;
    return ctx;
  }
  
  // 4. No queue items: Generate boredom signal if conditions met
  if (shouldGenerateBoredSignal(ctx)) {
    ctx.inputQueue.push({
      id: generateUUID(),
      type: 'BOREDOM_TICK',
      timestamp: Date.now(),
      payload: { type: 'BOREDOM_TICK', silenceDurationSec: ctx.silenceDuration }
    });
  }
  
  return ctx;
}
```

### 3.5 useConversation: Dispatch Only

```typescript
// hooks/useConversation.ts - MODIFY handleInput

const handleInput = useCallback(async (userInput: string, imageData?: string) => {
  if (isProcessing) return;
  
  // 1. Optimistic UI update for user message
  setConversation(prev => [...prev, { 
    role: 'user', 
    text: userInput,
    ...(imageData ? { imageData } : {})
  }]);
  
  // 2. Dispatch to queue - NO DIRECT CORTEX CALL
  actions.queueUserInput(userInput, imageData);
  
  // 3. UI will update via store subscription when AGENT_SPOKE fires
}, [isProcessing, actions]);
```

---

## 4. Implementation Plan

### Phase 1: Queue Infrastructure (Low Risk)
| Task | File | Effort |
|------|------|--------|
| Add `CognitiveSignal` types | `core/kernel/types.ts` | S |
| Add `inputQueue` to `KernelState` | `core/kernel/types.ts` | S |
| Add `inputQueue` to `initialState` | `core/kernel/initialState.ts` | S |
| Add `QUEUE_INPUT` event type | `core/kernel/types.ts` | S |
| Handle `QUEUE_INPUT` in reducer | `core/kernel/reducer.ts` | M |
| Add `queueUserInput` action | `stores/cognitiveStore.ts` | S |

### Phase 2: Unified Cortex (Medium Risk)
| Task | File | Effort |
|------|------|--------|
| Create `processSignal` function | `core/systems/CortexSystem.ts` | L |
| Create `buildUnifiedPrompt` helper | `core/systems/CortexSystem.ts` | M |
| Modify `runSingleStep` to use queue | `core/systems/EventLoop.ts` | L |
| Add boredom signal generation | `core/systems/EventLoop.ts` | M |

### Phase 3: Hook Refactor (High Risk - Breaking Change)
| Task | File | Effort |
|------|------|--------|
| Remove direct `CortexSystem` call | `hooks/useConversation.ts` | M |
| Subscribe to `AGENT_SPOKE` for UI | `hooks/useConversation.ts` | M |
| Update `useCognitiveKernelLite` | `hooks/useCognitiveKernelLite.ts` | M |

### Phase 4: Cleanup
| Task | File | Effort |
|------|------|--------|
| Deprecate `autonomousVolition` | `services/gemini.ts` | S |
| Remove dead code paths | Multiple | M |
| Add integration tests | `__tests__/integration/` | L |

---

## 5. Verification Plan

### 5.1 Automated Tests

```typescript
// __tests__/integration/UnifiedQueue.test.ts

describe('Unified Input Queue', () => {
  it('should process USER_MESSAGE through single brain', async () => {
    const store = createTestStore();
    
    // Queue input
    store.queueUserInput('Hello');
    expect(store.getState().inputQueue.length).toBe(1);
    
    // Run tick
    await store.executeCycle();
    
    // Assert processed
    expect(store.getState().inputQueue.length).toBe(0);
    expect(store.getState().conversation.length).toBe(2); // user + agent
  });
  
  it('should process BOREDOM_TICK with goal awareness', async () => {
    const store = createTestStore({
      goalState: { currentGoal: { description: 'Be calm' } }
    });
    
    // Simulate boredom
    store.queueSignal({ type: 'BOREDOM_TICK', silenceDurationSec: 30 });
    await store.executeCycle();
    
    // Agent should mention calmness, not random topics
    const lastMessage = store.getState().conversation.at(-1);
    expect(lastMessage.text).not.toContain('quantum');
  });
});
```

### 5.2 Manual Verification

1. **Race Condition Check:**
   - Input: "Hello"
   - Logs should show: `[Queue] Input Added` → `[EventLoop] Processing` → `[Cortex] Response`
   - UI should show exactly ONE agent response

2. **Split Brain Check:**
   - Tell agent: "Be calm, no excitement"
   - Wait 30 seconds (trigger boredom)
   - Agent autonomous speech should respect "be calm" instruction

3. **Goal Coherence Check:**
   - Set goal: "Learn about biology"
   - Wait for boredom tick
   - Agent should muse about biology, not random topics

---

## 6. Rollback Plan

If critical issues arise:
1. Feature flag: `UNIFIED_QUEUE_ENABLED` in `systemConfig.ts`
2. Dual path: Keep old `handleInput` behind flag
3. Revert: Single commit for entire change

---

## 7. Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Double responses per session | ~2-3 | 0 |
| Autonomous speech ignoring goals | 100% | 0% |
| Autonomous speech in wrong language | ~50% | 0% |
| Code paths for cognition | 2 | 1 |

---

## 8. Decision Required

**QUESTION FOR PAUL:**

This change moves from **reactive** (immediate promise) to **async game loop** (event-driven). This means:

1. `handleInput` will NOT return the agent's response directly
2. UI must listen to store updates for agent messages
3. Slight latency increase (~1 tick, 2-3 seconds max)

**Options:**
- **A) Full commit:** Implement as designed
- **B) Hybrid:** Keep reactive for user input, use queue for autonomous only
- **C) Delay:** Fix Split Brain first without queue (partial solution)

**Recommendation:** Option A (Full commit) - it's the correct architecture.

---

## Appendix A: Current vs Proposed Flow

### Current (Split Brain)
```
User Input ──┬──> useConversation ──> CortexSystem.processUserMessage ──> Response
             │
             └──> actions.processUserInput ──> KernelState update

Autonomous ──────> EventLoop ──> CortexService.autonomousVolition ──> Response
                   (SEPARATE BRAIN, NO MEMORY ACCESS)
```

### Proposed (Unified)
```
User Input ──> actions.queueUserInput ──> inputQueue ──┐
                                                       │
Boredom ────> EventLoop generates signal ──────────────┤
                                                       │
                                                       v
                                              EventLoop.runSingleStep
                                                       │
                                                       v
                                          CortexSystem.processSignal
                                                (SINGLE BRAIN)
                                                       │
                                                       v
                                                   Response
```

---

## Appendix B: Files to Modify

| File | Action | Risk |
|------|--------|------|
| `core/kernel/types.ts` | ADD types | LOW |
| `core/kernel/initialState.ts` | ADD field | LOW |
| `core/kernel/reducer.ts` | ADD handler | LOW |
| `stores/cognitiveStore.ts` | ADD action | LOW |
| `core/systems/CortexSystem.ts` | ADD function | MEDIUM |
| `core/systems/EventLoop.ts` | MODIFY | HIGH |
| `hooks/useConversation.ts` | MODIFY | HIGH |
| `hooks/useCognitiveKernelLite.ts` | MODIFY | MEDIUM |
| `services/gemini.ts` | DEPRECATE function | LOW |

---

*Document generated by AK-FLOW Engineering Team*
