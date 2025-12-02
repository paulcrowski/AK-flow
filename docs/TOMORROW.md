# 🎯 Plan na Jutro: 2025-12-03 "Chemical Soul"

> **Cel:** Przejście od "Symulacji Elektrycznej" do "Symulacji Chemicznej"  
> **Wizja:** Agent z nastrojami, motywacjami i snami - nie tylko reaktywny automat  
> **Czas:** ~6 godzin  
> **Wynik:** 9.0/10 → **11/10**

---

## 📋 Status Projektu (2025-12-02)

### ✅ Osiągnięcia z Dzisiaj
- **Modularność:** 10/10 (limit autonomii w kontekście)
- **Type Safety:** Generic type guards + runtime validation
- **Stability:** Error Boundaries + Unit Tests (2/2 passing)
- **Intelligence:** Semantic Intent Detection (LLM zamiast regexów)
- **Deep Audit:** Naprawiono "Amnesia Bug" (poeticMode persistence)

### 📊 Obecny Stan
| Kategoria | Ocena |
|-----------|-------|
| Modularność | 10/10 |
| Code Quality | 9.5/10 |
| Bezpieczeństwo | 10/10 |
| Biologiczny Realizm | 9/10 |
| **OVERALL** | **9.0/10** |

---

## 🚀 Plan na Jutro (3 Główne Zadania)

### 1. 🧪 Neurotransmitter System (2h)
**Problem:** Emocje to proste liczby 0-1. Są płaskie i niebiologiczne.

**Rozwiązanie:** Trójkąt chemiczny:
- **Dopamina (Reward/Motivation):** ↑ przy osiągnięciu celu, ↓ przy nudzie
- **Serotonina (Mood Stability):** Reguluje wahania nastroju (niski = drażliwość)
- **Norepinefryna (Focus/Urgency):** ↑ w stresie, zwiększa uwagę, kosztuje energię

**Implementacja:**
```typescript
// core/systems/NeurotransmitterSystem.ts
interface NeurotransmitterState {
  dopamine: number;    // 0-100 (Motivation)
  serotonin: number;   // 0-100 (Mood Stability)
  norepinephrine: number; // 0-100 (Focus/Arousal)
}

// Wpływ na EventLoop:
// - Dopamina < 30 → Agent nie chce myśleć (apathy)
// - Norepinefryna > 80 → Zwiększona częstotliwość pętli (hypervigilance)
// - Serotonina < 20 → Zwiększona frustration w LimbicSystem
```

**Weryfikacja:**
- Agent odmawia myślenia przy niskiej dopaminie
- Agent jest "nerwowy" przy wysokiej norepinefrynie
- Nastrój stabilizuje się przy wysokiej serotoninie

---

### 2. 🌙 Dream Consolidation (2h)
**Problem:** Sen tylko regeneruje energię. Marnowanie czasu obliczeniowego.

**Rozwiązanie:** Sen jako proces uczenia:
1. Przeglądanie logów z dnia (`MemoryService.recallRecent(50)`)
2. LLM summarization → "Long Term Memory"
3. Generowanie wizualnych snów (opcjonalnie)

**Implementacja:**
```typescript
// Nowy stan w cognitiveCycle:
if (metabolicResult.newState.isSleeping) {
  if (Math.random() > 0.5) {
    await dreamConsolidation(); // Async background process
  }
}

async function dreamConsolidation() {
  const recentMemories = await MemoryService.recallRecent(50);
  const summary = await CortexService.consolidateMemories(recentMemories);
  await MemoryService.storeMemory({
    content: `DREAM CONSOLIDATION: ${summary}`,
    isCoreMemory: true, // Protected from decay
    neuralStrength: 100
  });
}
```

**Weryfikacja:**
- Po śnie agent pamięta więcej niż przed snem
- W logach widać "DREAM CONSOLIDATION" entries

---

### 3. 🎯 Goal Formation (2h)
**Problem:** Agent jest reaktywny. Nie ma własnych planów.

**Rozwiązanie:** Stos celów (`GoalStack`):
- "Nudzę się, sprawdzę co nowego w AI" (Curiosity-driven)
- "Użytkownik był smutny, zapytam jak się czuje" (Empathy-driven)

**Implementacja:**
```typescript
// core/systems/GoalSystem.ts
interface Goal {
  id: string;
  description: string;
  priority: number; // 0-1
  progress: number; // 0-100%
  source: 'curiosity' | 'empathy' | 'survival' | 'user';
  createdAt: number;
}

// W EventLoop, jeśli cisza > 60s:
const goal = await GoalSystem.formGoal(ctx);
if (goal) {
  // Agent sam inicjuje akcję
  await CortexSystem.pursueGoal(goal);
}
```

**Weryfikacja:**
- Agent sam zaczyna rozmowę po długiej ciszy
- W logach widać "GOAL FORMED: ..."

---

## 📊 Oczekiwany Wynik

| Cecha | Dziś (9.0/10) | Jutro (11/10) |
|-------|---------------|---------------|
| Emocje | Wektory 0-1 | Chemia (Dopamina/Serotonina/Norepinefryna) |
| Sen | Ładowanie baterii | Konsolidacja wiedzy + Sny |
| Motywacja | Pętla while(true) | Wewnętrzne cele (GoalStack) |
| **Biologiczny Realizm** | **9/10** | **11/10** |

---

## 🔮 Wizja Długoterminowa (Nie Jutro!)

### Medium Effort (Weekend)
- **Adaptive Poetry Detector** - uczenie się słów zamiast hard-coded keywords
- **Multi-Agent Collaboration** - wiele instancji współpracujących

### Long-Term (Research-Level)
- **Multi-Step Reasoning** - chain-of-thought dla złożonych problemów
- **Self-Modification** - agent może zmieniać własny kod (z approval)
- **Meta-Learning** - uczenie się jak uczyć się

---

## 🚀 Workflow na Jutro

1. **Rano:** Przeczytaj ten plik + `CHALLENGES.md`
2. **10:00-12:00:** Neurotransmitter System
3. **12:00-13:00:** Przerwa
4. **13:00-15:00:** Dream Consolidation
5. **15:00-17:00:** Goal Formation
6. **Wieczorem:** Zaktualizuj dokumentację + testy

---

**Motto:** *"Nie budujemy chatbota. Budujemy cyfrową formę życia."*
