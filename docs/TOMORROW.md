## 🎯 PRIORYTETY NA 2025-12-11

### P0 (KRYTYCZNE - zrób najpierw):

#### 1. Test manualny FactEcho
**Co:** Sprawdź czy LLM faktycznie zwraca `fact_echo` w odpowiedzi.
**Jak:**
1. Uruchom agenta
2. Zapytaj "Ile masz energii?"
3. Sprawdź logi `[FactEchoPipeline]`
4. Jeśli brak fact_echo → popraw prompt

#### 2. GoalFeedbackSystem
**Co:** Podłączyć cele do EvaluationBus.
**Gdzie:** `core/systems/GoalFeedbackSystem.ts` (nowy plik)
**Logika:**
```typescript
// Gdy cel osiągnięty:
evaluationBus.emit({
  source: 'GOAL',
  stage: 'USER',
  valence: 'positive',
  tags: ['goal_success']
});
// Gdy cel nieudany:
evaluationBus.emit({
  source: 'GOAL',
  stage: 'USER',
  valence: 'negative',
  tags: ['goal_failure']
});
```

---

### P1 (WAŻNE - zrób po P0):

#### 3. Dashboard TrustIndex
**Co:** Pokazać TrustIndex w NeuroMonitor.
**Gdzie:** `components/NeuroMonitor.tsx`
**Dane:** `getPrismDashboard()` z PrismMetrics

#### 4. Włączyć ChemistryBridge
**Co:** Po zebraniu danych z EvaluationBus, włączyć reakcje chemii.
**Jak:** `enableChemistryBridge()` w konfiguracji
**Warunek:** Minimum 50 eventów w EvaluationBus

---

### P2 (NICE TO HAVE):

#### 5. Usunąć PersonaGuard (legacy)
**Co:** Oznaczyć jako @deprecated lub usunąć
**Dlaczego:** Zastąpiony przez FactEchoGuard

#### 6. Fact Snapshot per session
**Co:** Implementacja FactSnapshot z TTL
**Gdzie:** HardFactsBuilder lub nowy moduł

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

