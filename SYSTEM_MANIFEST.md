# AK-FLOW: Cognitive Agent Architecture Manifest
**System Version:** 4.0 (Modular Architecture + Boot Logger)  
**Last Updated:** 2025-11-27  
**Architecture Type:** Active Inference (Friston) + Global Workspace Theory + Multi-Modal RAG  
**Status:** Autonomous / Stateful / Modular / Self-Aware

---

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
  - **Threshold:** voicePressure > 0.75 = Speak
  - Returns: `{ shouldSpeak, reason }`
- `calculateSilenceDuration(silenceStartTimestamp)` → Duration in seconds
- `shouldInitiateThought(silenceDuration)` → Boolean (threshold: 2s)
- `shouldPublishHeartbeat(silenceDuration)` → Boolean (every 30s after 10s)

**Decision Logic:**
- No content → No speech
- Voice pressure > 0.75 AND content exists → Speak
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
- `autonomousMode` - Kill switch (useState, default: false)
- `conversation` - Message history (useState)
- `isProcessing` - Processing flag (useState)
- `currentThought` - Current activity (useState)
- `systemError` - Error state (useState)

**Refs:**
- `stateRef` - Prevents React closure staleness
- `timeoutRef` - Loop timeout handle
- `silenceStartRef` - Silence tracking
- `lastVisualTimestamp` - Visual cooldown tracking
- `visualBingeCountRef` - Visual addiction prevention
- `isLoopRunning` - Loop state flag
- `hasBootedRef` - Boot once flag

**Boot Sequence (NEW in V4.0):**
- Captures complete initial state snapshot
- Logs: Limbic, Soma, Resonance, Configuration
- Publishes to EventBus as `SYSTEM_BOOT_COMPLETE`
- Stores in memory for analysis
- Console logs for debugging

**Cognitive Cycle Flow:**
1. **Kill Switch Check** - Exit if autonomousMode = false
2. **Metabolic State** - SomaSystem.calculateMetabolicState()
3. **Sleep/Wake Handling** - Apply regeneration or drain
4. **Volition Evaluation** - VolitionSystem.evaluateVolition()
5. **Autonomous Thinking** - If awake and silence > 2s
6. **Speech Decision** - If voice pressure > 0.75
7. **Emotional Update** - LimbicSystem.applySpeechResponse()
8. **Schedule Next Tick** - BiologicalClock tick intervals

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

**Features:**
- Real-time updates via EventBus subscription
- Visual indicators for sleep state
- Message type differentiation (thought/speech/visual/intel)
- Image display for visual memories
- Source citations for research

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
