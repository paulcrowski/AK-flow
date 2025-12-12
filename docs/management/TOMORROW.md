## 🎯 PRIORYTETY NA 2025-12-13

> **Kontekst**: Zakończyliśmy ALARM-3 stabilizację. System jest inżynieryjnie dojrzały.
> Teraz: STABILIZACJA przed nowymi funkcjami.

---

### P0 (KRYTYCZNE - zrób najpierw):

#### 1. 🧪 TEST MANUALNY
**Co:** Zweryfikować że patche działają w praktyce
**Jak:**
```
1. npm run dev
2. "Jak masz na imię?" → oczekuj: Jesse (nie Assistant!)
3. "Jaki dziś dzień?" → oczekuj: 13.12.2025 (nie halucynacja!)
4. 60 sekund ciszy → sprawdź logi: dopamine SPADA?
5. Wykonaj SEARCH → sprawdź logi: TOOL_REWARD reset?
```
**Czas:** 15 min

#### 2. 📊 OBSERVABILITY (1h)
**Co:** Używaj systemu normalnie przez godzinę
**Zbieraj:**
- Ile razy IDENTITY_CONTRADICTION w logach?
- Ile razy DOPAMINE_TICK pokazuje wzrost bez powodu?
- Czy PROMPT_HARDFACTS zawsze się pojawia?

---

### P1 (WAŻNE - po P0):

#### 3. Dashboard DOPAMINE_TICK
**Co:** Dodać wykres dopaminy do NeuroMonitor
**Gdzie:** `components/NeuroMonitor.tsx`
**Dane:** Subskrypcja na eventBus dla DOPAMINE_TICK

#### 4. Alert IDENTITY_CONTRADICTION
**Co:** Wizualny alert gdy PersonaGuard wykryje drift
**Gdzie:** UI toast/modal
**Trigger:** Gdy wykryto 3x pod rząd

---

### P2 (NICE TO HAVE):

#### 5. WorldResponse Architecture
**Co:** Formalizacja sygnałów zwrotnych od świata
**Kiedy:** Gdy mamy dane z P1-P2 że potrzebujemy
**Nie teraz** - najpierw observability

#### 6. GoalFeedbackSystem
**Co:** Podłączyć cele do EvaluationBus
**Kiedy:** Po stabilizacji dopamine

---

## 🔧 STARE PRIORYTETY (przeniesione)

### The Pain Principle (Zasada Bólu)
**Status:** Częściowo zaimplementowane przez EvaluationBus
**Co zostało:** GoalFeedbackSystem (P0.2)

### Dream Judge
**Status:** Niezaimplementowane
**Priorytet:** NISKI (po GoalFeedback)

---

## 🗓️ Archiwum: 2025-12-10 (PRISM Architecture)

### Zrealizowane
- ✅ **EvaluationBus** - Centralna magistrala sygnałów uczenia
- ✅ **PersonaGuard** - Regex-based guard (deprecated)
- ✅ **FactEchoGuard** - JSON-based guard (13/10)
- ✅ **FactEchoPipeline** - Production wrapper
- ✅ **ChemistryBridge** - Most do chemii (disabled)
- ✅ **PrismMetrics** - TrustIndex, daily caps
- ✅ **HardFactsBuilder** - Budowanie faktów
- ✅ **152 nowych testów**

### Metryki
- Nowa architektura: V6.0
- Testy: 285 passing
- Regex w fact checking: ZERO

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

