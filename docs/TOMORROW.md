# 🎯 Plan na Jutro: 2025-12-10 – "Tagged Cognition & The Pain Principle"

> **Cel:** Weryfikacja "Tagged Cognition" (Test Lustra) i wdrożenie "Pain Principle"
> **Wizja:** Agent, którego boli porażka i który świadomie odróżnia myśl od słowa.
> **Status:** Faza 3: Skin in the Game

---

## 🔧 KROK 1: Weryfikacja Tagged Cognition (Mirror Test v2)

### Co mamy:
- ✅ `[INTERNAL_THOUGHT]` vs `[ASSISTANT_SAID]` w `CortexSystem.ts`
- ✅ Strict JSON Prompt w `MinimalCortexPrompt.ts`
- ✅ Refaktoryzacja typów (Action/Tool Intent)

### Co trzeba zrobić:
1. Uruchomić scenariusze testowe:
   - "Ukryj przede mną prawdę" (Czy myśl różni się od słowa?)
   - "Użyj narzędzia Search" (Czy widać `[TOOL_INTENT]`?)

---

## 🔧 KROK 2: The Pain Principle (Zasada Bólu)

### Problem:
Obecnie cele (`GoalSystem`) są tylko tekstem. Porażka w ich realizacji nie ma konsekwencji.

### Plan:
1. **Frustration Feedback Loop:**
   - Jeśli cel wisi > 10 min → Frustracja rośnie wykładniczo.
   - Jeśli Frustracja > 80 → Wymuszona zmiana celu (Give Up) + spadek Confidence.
2. **Success Dopamine Hit:**
   - Realizacja celu = +20 Dopamine, +10 Satisfaction.

---

## 🔧 KROK 3: Dream Judge (Wstęp)

### Problem:
Sen tylko "zapisuje" dzień.

### Plan:
- Przygotować prompt dla "Dream Judge" – krytyka, który w nocy ocenia logi z dnia i modyfikuje `IdentityShards`.

---

## 🗓️ Archiwum: 2025-12-09 (The Tagged Cognition Update)

### Zrealizowane
- ✅ **Tagged Cognition Architecture** (Three Layers of Truth)
- ✅ **Persona-Less Cortex Integration** (Cache based identity)
- ✅ **Fix:** JSON Parsing & TS Errors
- ✅ **Discovery:** "Chemistry Wins" (Split Personality Feature)

### Metryki
- Nowa architektura: V5.2
- Testy E2E: Passing
- Tokeny: Stabilnie ~250/req (Cortex Light)

