## 🔧 KROK 1: The Pain Principle (Zasada Bólu)

### Problem:
Obecnie cele (`GoalSystem`) są tylko tekstem. Porażka w ich realizacji nie ma konsekwencji. Agent nie "czuje", że musi je zrealizować.

### Plan:
1. **Frustration Feedback Loop:**
   - Jeśli cel wisi > 200 ticków → Frustracja rośnie wykładniczo.
   - Jeśli Frustracja > 0.8 → Wymuszona zmiana celu (Give Up) + spadek Confidence + wpis do pamięci "Porażka".
2. **Success Dopamine Hit:**
   - Realizacja celu = +20 Dopamine, +10 Satisfaction.
   - To stworzy mechanizm "chcenia" (seeking reward).

---

## 🔧 KROK 2: Dream Judge (Część II - Sędzia)

### Problem:
Mamy już `DreamConsolidation`, który robi podsumowania. Ale brakuje "Krytyka", który ocenia jakość dnia.

### Plan:
- Rozszerzyć `DreamConsolidationService` o krok "Judgment".
- Prompt: "Oceń dzisiejsze działania w skali 1-10. Czy były zgodne z Core Values? Co poprawić?".
- Wynik wpływa na `starting_confidence` następnego dnia.

---

## 🗓️ Archiwum: 2025-12-10 (Identity-Lite & Wake Unification)

### Zrealizowane
- ✅ **Identity-Lite Complete**: Agent sam pisze swoje `narrative_self` i `persona_tags`.
- ✅ **WakeService Unification**: Naprawiono "Split Sleep Trap". Auto-wake i Force-wake używają tej samej logiki.
- ✅ **Fluid Traits**: Osobowość (`TraitVector`) ewoluuje przez neuro-dryft przy każdym obudzeniu.
- ✅ **AIResponseParser**: Solidny parser JSON z fallbackiem.

### Metryki
- Nowa architektura: V5.3
- Tokeny: Stabilnie ~300/req
- Kompresja pamięci wizualnej: 98.5%


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

