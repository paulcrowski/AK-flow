# Persona-Less Cortex Architecture

**Status:** ✅ Implemented  
**Version:** 1.0  
**Date:** 2025-12-08

## Overview

Przejście od "role-playing LLM" do "stateless inference engine" z emergentną tożsamością.

**Kluczowa zmiana:** LLM nie wie kim jest – dowiaduje się tego z danych w każdym wywołaniu.

```
JSON Payload → 🤖 LLM (Stateless) → JSON Output
                    ↑
            Minimal System Prompt
            (stały dla wszystkich agentów)
```

## Architecture

### Modular Structure

```
core/
├── types/           # Atomowe typy (11 plików)
│   ├── MetaStates.ts
│   ├── TraitVector.ts
│   ├── CoreIdentity.ts
│   ├── NarrativeSelf.ts
│   ├── IdentityShard.ts
│   ├── StyleExample.ts
│   ├── InteractionMode.ts
│   ├── Relationship.ts
│   ├── CortexState.ts      # Main contract
│   ├── CortexOutput.ts
│   └── index.ts            # Barrel export
│
├── config/
│   ├── featureFlags.ts     # Feature flags for rollback
│   └── index.ts
│
├── prompts/
│   └── MinimalCortexPrompt.ts  # Stateless system prompt
│
├── services/
│   ├── MetaStateService.ts          # Homeostasis
│   ├── StyleExamplesService.ts      # Few-shot examples
│   ├── IdentityCoherenceService.ts  # Shard coherence
│   ├── IdentityDataService.ts       # Supabase CRUD
│   ├── IdentityConsolidationService.ts  # Dream consolidation
│   └── index.ts
│
├── builders/
│   ├── CortexStateBuilder.ts   # Build payload from DB
│   └── index.ts
│
├── inference/
│   ├── CortexInference.ts      # LLM calls
│   └── index.ts
│
└── index.ts                    # Main barrel export
```

## Key Components

### 1. CortexState (Main Contract)

```typescript
interface CortexState {
  meta_states: MetaStates;        // energy, confidence, stress
  trait_vector: CortexTraitVector; // personality
  core_identity: CoreIdentity;     // name, values, constraints
  narrative_self: NarrativeSelf;   // self-summary, mood
  identity_shards: IdentityShard[]; // beliefs, preferences
  style_examples: StyleExample[];   // few-shot examples
  memory_context: string[];
  goals: string[];
  interaction_mode: InteractionMode;
  relationship: Relationship;
  user_input: string;
}
```

### 2. Minimal System Prompt

```typescript
const MINIMAL_CORTEX_SYSTEM_PROMPT = `
ROLE: Stateless inference engine.
TASK: Read JSON input, generate JSON output.
RULES:
- You have NO built-in name, persona, identity or values.
- Your behavior MUST be fully determined by the provided data.
- If no identity data is present, act as neutral technical assistant.
- STRICT JSON output only.
`;
```

### 3. Feature Flags

```typescript
FEATURE_FLAGS = {
  USE_MINIMAL_CORTEX_PROMPT: false,      // Main toggle
  USE_CORTEX_STATE_BUILDER: false,
  USE_META_STATE_HOMEOSTASIS: false,
  USE_IDENTITY_COHERENCE_CHECK: false,
  USE_STYLE_EXAMPLES: false
}
```

## Database Schema

New tables (run `database/migrations/002_persona_less_cortex.sql`):

- `core_identity` - Stable identity (name, values)
- `narrative_self` - Dynamic self-image
- `identity_shards` - Atomic beliefs/preferences
- `agent_relationships` - Trust tracking

Extended `memories` table with:
- `emotional_valence`
- `arousal_level`
- `style_rating`
- `interaction_context`

## Usage

### Building CortexState

```typescript
import { buildCortexState } from '@/core/builders';

const state = await buildCortexState({
  agentId: 'uuid',
  userId: 'uuid',
  metaStates: { energy: 70, confidence: 60, stress: 20 },
  memoryContext: ['...'],
  goals: ['...'],
  userInput: 'Hello'
});
```

### Generating Response

```typescript
import { generateFromCortexState } from '@/core/inference';

const output = await generateFromCortexState(state);
// { internal_thought, speech_content, mood_shift }
```

### Updating Meta-States

```typescript
import { updateMetaStates } from '@/core/services';

const newStates = updateMetaStates(
  currentStates,
  output.mood_shift
);
// Applies EMA smoothing + homeostasis
```

## Activation

1. Run SQL migration in Supabase
2. Set `USE_MINIMAL_CORTEX_PROMPT = true` in `featureFlags.ts`
3. Integrate `buildCortexState` + `generateFromCortexState` in CortexSystem

## Rollback

Set `USE_MINIMAL_CORTEX_PROMPT = false` → system uses old prompts.

## Tests

```bash
npm test -- --grep "MetaStateService"
npm test -- --grep "CortexStateBuilder"
npm test -- --grep "IdentityCoherenceService"
npm test -- --grep "FeatureFlags"
```

All tests passing: ✅ 86/86

---

## 🗺️ Roadmap

### ✅ v0.1 - MVP (CURRENT)
- [x] Core types (11 plików)
- [x] MinimalCortexStateBuilder (zero DB)
- [x] Cache z TTL 5 min
- [x] Feature flags
- [x] Database migration
- [x] Unit tests
- **Tokeny:** ~250/request

### 🔜 v0.2 - Core Shards
- [ ] Top 3 identity_shards (is_core=true)
- [ ] Ładowanie przy starcie sesji do cache
- **Tokeny:** ~350/request

### 🔜 v0.3 - Style Examples
- [ ] 1-2 style_examples z memories
- [ ] Filtrowanie po style_rating > 7
- **Tokeny:** ~500/request

### 🔜 v0.4 - Contextual Shards
- [ ] Vector search dla shardów dopasowanych do tematu
- [ ] Top 3 Core + Top 5 Contextual
- [ ] Background prefetch
- **Tokeny:** ~700/request

### 🔜 v1.0 - Full Integration
- [ ] Pełny CortexStateBuilder z DB
- [ ] IdentityCoherenceCheck w DreamConsolidation
- [ ] Probabilistic shard evolution
- **Tokeny:** ~1500/request

---

## ⚠️ Challenges

1. **Latencja** - każde DB query = 20-50ms, vector search = 100-200ms
2. **Koszty tokenów** - pełny payload zjada okno atencji
3. **Sztywność** - zbyt rygorystyczne Core Shards = fanatyk
4. **Cache invalidation** - co jeśli user zmieni agenta?

### Rozwiązania:
- **Hot/Cold Path Separation** - ciężka logika tylko w śnie
- **Smart Retrieval** - Top 3 Core + Top 5 Contextual
- **Probabilistic Coherence** - weaken zamiast reject
- **Cache per agent** - invalidate przy zmianie agenta

---

## 📊 Porównanie Trybów

| Aspekt | LEGACY | MVP | FULL |
|--------|--------|-----|------|
| Feature Flag | `false` | `true` | `true` + `BUILDER` |
| Tokeny/req | ~200 | ~250 | ~1500 |
| DB queries | 0 | 0 | 5+ |
| Latencja | ~500ms | ~550ms | ~800ms |
| Emergentna tożsamość | ❌ | ✅ basic | ✅ full |
| Identity shards | ❌ | ❌ | ✅ |
| Style examples | ❌ | ❌ | ✅ |
| Coherence check | ❌ | ❌ | ✅ |

---

## 🔧 Jak Przełączać Tryby

```typescript
// core/config/featureFlags.ts

// LEGACY (stary system):
USE_MINIMAL_CORTEX_PROMPT: { enabled: false }

// MVP (aktualnie):
USE_MINIMAL_CORTEX_PROMPT: { enabled: true }

// FULL (przyszłość):
USE_MINIMAL_CORTEX_PROMPT: { enabled: true }
USE_CORTEX_STATE_BUILDER: { enabled: true }
```

Podsumowanie: Shards w Cache
Jak to teraz działa:
Przy starcie sesji (1x):
  1. Pobierz core_identity z DB
  2. Pobierz trait_vector z DB  
  3. Pobierz TOP 3 core shards z DB (is_core=true, ORDER BY strength DESC)
  4. Zapisz wszystko do cache (TTL 5 min)

Przy każdym request (0 DB queries):
  1. Weź identity z cache
  2. Weź shards z cache
  3. Zbuduj CortexState
  4. Wyślij do LLM
Koszt tokenów:
Wersja	Shards	Tokeny
v0.1 (było)	0	~250
v0.2 (teraz)	3 core z cache	~350
v1.0 FULL	10 (3 core + 7 contextual)	~1500
Jak używać:
typescript
import { setCachedIdentity } from '@/core/builders';
import { fetchIdentityShards } from '@/core/services';

// Przy starcie sesji / wyborze agenta:
const coreShards = await fetchIdentityShards(agentId, 10);
const topCoreShards = coreShards
  .filter(s => s.is_core)
  .sort((a, b) => b.strength - a.strength)
  .slice(0, 3);

setCachedIdentity(
  agentId,
  { name: agent.name, core_values: [...], constitutional_constraints: [...] },
  agent.trait_vector,
  topCoreShards  // ← NEW
);
Korzyści:
Zero DB w hot path - shards z cache
~350 tokenów - tylko +100 vs v0.1
Core shards zawsze obecne - agent wie kim jest
Soft Plasticity działa - shards ewoluują podczas snu