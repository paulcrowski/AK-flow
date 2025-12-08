# 🎯 Plan na Jutro: 2025-12-09 – "Persona-Less Cortex Integration & E2E Tests"

> **Cel:** Zintegrować MVP Persona-Less Cortex z CortexSystem i przetestować E2E
> **Wizja:** Agent używa nowej architektury z minimalnym payloadem (~250 tokenów)
> **Czas:** ~3-4 godziny
> **Wynik:** Działający agent z nową architekturą + testy E2E

---

## 🔧 KROK 1: Integracja (PRZED testami!)

### Co mamy:
- ✅ Kod gotowy w `core/` (builders, inference, types)
- ✅ Feature flag włączony (`USE_MINIMAL_CORTEX_PROMPT: true`)
- ✅ Baza danych z nowymi tabelami
- ❌ **Kod NIE jest podpięty do aplikacji**

### Co trzeba zrobić:

#### 1.1 Podpięcie cache przy wyborze agenta

**Plik:** `components/CognitiveInterface.tsx` lub `contexts/SessionContext.tsx`

**Znajdź miejsce gdzie user wybiera agenta** i dodaj:

```typescript
import { setCachedIdentity } from '@/core/builders';

// Gdy user wybiera agenta (np. w useEffect lub handleSelectAgent):
setCachedIdentity(
  agent.id,
  {
    name: agent.name,
    core_values: agent.core_values || ['helpfulness', 'accuracy'],
    constitutional_constraints: ['do not hallucinate', 'admit uncertainty']
  },
  agent.trait_vector || {
    verbosity: 0.4,
    arousal: 0.3,
    conscientiousness: 0.7,
    social_awareness: 0.6,
    curiosity: 0.5
  }
  // BEZ 4. parametru = puste shards (v0.1)
);
```

#### 1.2 Zamiana flow w gemini.ts

**Plik:** `services/gemini.ts`

**Znajdź funkcję `generateResponse`** i dodaj alternatywny flow:

```typescript
import { isFeatureEnabled } from '@/core/config';
import { buildMinimalCortexState } from '@/core/builders';
import { generateFromCortexState } from '@/core/inference';

export async function generateResponse(
  input: string,
  context: any,
  limbicState: any,
  analysis: any
) {
  // NOWY FLOW - Persona-Less Cortex
  if (isFeatureEnabled('USE_MINIMAL_CORTEX_PROMPT')) {
    const agentId = getCurrentAgentId(); // z supabase.ts
    
    const state = buildMinimalCortexState({
      agentId: agentId || 'default',
      metaStates: {
        energy: 70,  // TODO: pobierz z somaState
        confidence: limbicState.satisfaction * 100,
        stress: limbicState.frustration * 100
      },
      userInput: input,
      recentContext: context.slice(-3).map((m: any) => m.content)
    });
    
    const output = await generateFromCortexState(state);
    
    return {
      text: output.speech_content,
      thought: output.internal_thought,
      moodShift: output.mood_shift
    };
  }
  
  // STARY FLOW - fallback
  // ... istniejący kod ...
}
```

#### 1.3 Sprawdź importy

Upewnij się że te importy działają:
```typescript
import { isFeatureEnabled } from '@/core/config';
import { buildMinimalCortexState, setCachedIdentity } from '@/core/builders';
import { generateFromCortexState } from '@/core/inference';
```

---

## 📋 Plan Testów (PO integracji)

### 🧪 Test 1: Minimal Cortex Response (30 min)
```
1. Uruchom aplikację (npm run dev)
2. Wybierz agenta
3. Napisz "Cześć, kim jesteś?"
4. Sprawdź w konsoli:
   - [MinimalCortex] Identity cached for {name}
   - Payload ~250 tokenów
   - Odpowiedź zawiera imię agenta
```

### 🧪 Test 2: Meta-States Homeostasis (30 min)
```
1. Obserwuj NeuroMonitor → Soma tab
2. Napisz 10 wiadomości pod rząd
3. Sprawdź czy:
   - Energy spada (koszt odpowiedzi)
   - Stress rośnie przy trudnych pytaniach
   - Wartości wracają do baseline po chwili
```

### 🧪 Test 3: Cache TTL (15 min)
```
1. Uruchom agenta
2. Poczekaj 5+ minut bez interakcji
3. Napisz wiadomość
4. Sprawdź log: "Identity cached for..." (re-cache)
```

### 🧪 Test 4: Rollback Test (15 min)
```
1. Ustaw USE_MINIMAL_CORTEX_PROMPT: false
2. Uruchom agenta
3. Sprawdź czy działa po staremu (stare prompty)
4. Przywróć USE_MINIMAL_CORTEX_PROMPT: true
```

### 🧪 Test 5: Dream Consolidation (30 min)
```
1. Przeprowadź kilka rozmów
2. Wymuś sen (Sleep button lub energy < 20)
3. Sprawdź logi:
   - [IdentityConsolidation] Starting...
   - narrative_self updated
   - shards created/reinforced
```

---

## 🔧 Integracja do Zrobienia

### Krok 1: Podpięcie do CortexSystem
```typescript
// W CortexSystem.ts lub gemini.ts
import { isFeatureEnabled } from '@/core/config';
import { buildMinimalCortexState, setCachedIdentity } from '@/core/builders';
import { generateFromCortexState } from '@/core/inference';

if (isFeatureEnabled('USE_MINIMAL_CORTEX_PROMPT')) {
  // Nowy flow
  const state = buildMinimalCortexState({ ... });
  const output = await generateFromCortexState(state);
} else {
  // Stary flow
  const response = await generateResponse(prompt);
}
```

### Krok 2: Cache Identity przy starcie sesji
```typescript
// W SessionContext lub przy wyborze agenta
import { setCachedIdentity } from '@/core/builders';

setCachedIdentity(agent.id, {
  name: agent.name,
  core_values: agent.core_values || ['helpfulness'],
  constitutional_constraints: ['do not hallucinate']
}, agent.trait_vector);
```

---

## 📊 Oczekiwane Wyniki

| Metryka | Stary System | Nowy MVP | Pełny (przyszłość) |
|---------|--------------|----------|-------------------|
| Tokeny/request | ~200 | ~250 | ~1500 |
| DB queries/request | 0 | 0 | 5+ |
| Latencja | ~500ms | ~550ms | ~800ms |
| Emergentna tożsamość | ❌ | ✅ (basic) | ✅ (full) |

---

## ⚠️ Challenges / Ryzyka

1. **Integracja z istniejącym kodem** - CortexSystem może mieć zależności
2. **Gemini API format** - upewnić się że JSON payload jest poprawny
3. **Cache invalidation** - co jeśli user zmieni agenta?
4. **Error handling** - fallback do starego systemu przy błędzie

---

## 📁 Pliki do Modyfikacji Jutro

1. `services/gemini.ts` - dodać nowy flow z feature flag
2. `components/CognitiveInterface.tsx` - podpiąć cache przy starcie
3. `core/inference/CortexInference.ts` - ewentualne poprawki po testach

---

## 🗓️ Archiwum: 2025-12-08

### Zrealizowane
- ✅ Persona-Less Cortex Architecture (27 plików)
- ✅ Database migration (4 nowe tabele)
- ✅ MVP builder z cache (zero DB w hot path)
- ✅ Feature flags włączone
- ✅ 86/86 testów przechodzi

### Metryki
- Pliki utworzone: 27
- Testy dodane: 4 suites (41 testów)
- Tokeny zaoszczędzone: ~1250/request (vs pełna wersja)
