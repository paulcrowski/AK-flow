# AK-FLOW AGI Roadmap v2.1 - Fazy Rozwoju

> **Wizja**: System poznawczy z prawdziwą chemią, wolą i autonomią.
> **Styl**: Karpathy-level engineering - minimalne, testowalne, obserwowalne.
> **Zasada**: Najpierw obserwuj, potem reaguj. Najpierw logi, potem chemia.

---

## FAZA 1: Napraw Chemię (Dziś) ✅ PARTIALLY DONE

### Problem
Dopamina utrzymuje się na poziomie 95-100 mimo braku zewnętrznych nagród.
Homeostaza (5% pull do baseline 55) jest za słaba przy wysokich wartościach.

### Rozwiązanie: Agresywniejszy Decay

**Plik**: `core/systems/NeurotransmitterSystem.ts`

```typescript
// PRZED: rate = 0.05 (5%)
// Przy dopamine=100, baseline=55: delta = (55-100)*0.05 = -2.25/tick

// PO: Asymetryczny decay - szybszy spadek gdy powyżej baseline
export const applyHomeostasis = (value: number, target = 50, rate = 0.05): number => {
  const distance = target - value;
  // Asymetria: 3x szybszy decay gdy powyżej baseline
  const effectiveRate = value > target ? rate * 3 : rate;
  const delta = distance * effectiveRate;
  return clampNeuro(value + delta);
};
```

**Efekt**: Przy dopamine=100 → delta = -6.75/tick zamiast -2.25

### Rozwiązanie: Kara za JSON_PARSE_FAILURE

**Plik**: `core/inference/CortexInference.ts` (w `parseResponse`)

```typescript
// Przy błędzie parsowania:
eventBus.publish({
  source: AgentType.NEUROCHEM,
  type: PacketType.FIELD_UPDATE,
  payload: {
    action: 'DOPAMINE_PENALTY',
    reason: 'JSON_PARSE_FAILURE',
    delta: -8  // znacząca kara
  }
});
```

---

## FAZA 2: Goal Feedback + EvaluationBus (Ten Tydzień) ✅ IMPLEMENTED

### Problem
Sukcesy/porażki celów nie są spięte z chemią ani z meta-oceną.
Confession, GoalFeedback i błędy systemowe dawałyby trzy różne źródła ocen – bez spójnego formatu.

### ✅ ZAIMPLEMENTOWANO (2025-12-10)

**Phase 1 - Observation:**
- `core/systems/EvaluationBus.ts` - Unified learning signal system
- `core/systems/PersonaGuard.ts` - Fact & Persona integrity guard
- `__tests__/EvaluationBus.test.ts` - 25 testów
- `__tests__/PersonaGuard.test.ts` - 25 testów

**Phase 2 - Integration (2025-12-10):**
- `core/systems/HardFactsBuilder.ts` - Builds HardFacts/SoftState from system state
- `core/systems/PrismIntegration.ts` - Integrates PersonaGuard into LLM pipeline
- `__tests__/HardFactsBuilder.test.ts` - 15 testów
- `__tests__/PrismIntegration.test.ts` - 12 testów

**Phase 3 - Production (2025-12-10):**
- `core/systems/PrismPipeline.ts` - Production wrapper for LLM inference
- `services/gemini.ts` - Minimal change: import + 1 guard call
- `__tests__/PrismPipeline.test.ts` - 10 testów

**Phase 4 - Chemistry Bridge (2025-12-10):**
- `core/systems/ChemistryBridge.ts` - Connects EvaluationBus to NeurotransmitterSystem
- `__tests__/ChemistryBridge.test.ts` - 18 testów
- Feature flag: `CHEMISTRY_BRIDGE_CONFIG.ENABLED` (default: false)

**Phase 5 - FactEcho + Metrics (2025-12-10):**
- `core/types/CortexOutput.ts` - Added `FactEcho` interface
- `core/systems/FactEchoGuard.ts` - JSON-based fact validation (NO REGEX!)
- `core/systems/PrismMetrics.ts` - TrustIndex, daily penalty caps, architecture issues
- `core/prompts/MinimalCortexPrompt.ts` - FACT ECHO ARCHITECTURE section
- `core/inference/CortexInference.ts` - fact_echo in response schema
- `__tests__/FactEchoGuard.test.ts` - 22 testów
- `__tests__/PrismMetrics.test.ts` - 12 testów

**Phase 6 - FactEcho Pipeline (2025-12-10):**
- `core/systems/FactEchoPipeline.ts` - Production pipeline with JSON guard
- `services/gemini.ts` - Switched to FactEcho as primary guard
- `__tests__/FactEchoPipeline.test.ts` - 13 testów
- Feature: `factStrictMode` - control whether all facts must be echoed

**Nowe typy w `types.ts`:**
- `EvaluationEvent` - z polem `stage` (13/10 upgrade)
- `EvaluationSource`, `EvaluationStage`, `EvaluationTag`
- `VerifiedFact`, `FactSnapshot`, `HardFacts`, `SoftState`
- `PrismContext`, `GuardResult`, `GuardIssue`

---

### 2.1 EvaluationBus – Zamrożone API v1.1 (13/10 Upgrade)

> **KRYTYCZNE**: Ten interfejs jest ZAMROŻONY. Nie dodawaj pól bez wyraźnej potrzeby.
> **UPGRADE 13/10**: Dodano pole `stage` dla stage-aware punishment.

```typescript
// types.ts - ZAIMPLEMENTOWANE
interface EvaluationEvent {
  id: string;
  timestamp: number;
  source: 'GOAL' | 'CONFESSION' | 'PARSER' | 'GUARD' | 'USER';
  stage: 'TOOL' | 'ROUTER' | 'PRISM' | 'GUARD' | 'USER';  // 13/10: WHERE in pipeline
  severity: number;      // 0–1 (jak poważne)
  valence: 'positive' | 'negative';  // kierunek
  tags: EvaluationTag[];  // zamknięta lista
  confidence: number;    // 0–1 (jak bardzo ufamy tej ocenie)
  attribution?: FailureSource;  // opcjonalne: kto zawinił
  context?: { input?: string; output?: string; hardFacts?: Record<string, unknown> };
}
```

**Stage-aware punishment weights:**
```typescript
STAGE_WEIGHTS = {
  'TOOL': 0.02,    // Tool error = minimal agent punishment
  'ROUTER': 0.03,  // Router conflict = low punishment
  'PRISM': 0.10,   // LLM changed fact = normal punishment
  'GUARD': 0.05,   // Persona drift = medium punishment
  'USER': 0.15     // User unhappy = high punishment
}
```

**Zasady tagów** (zamknięta lista na start):
- `verbosity` – za długo
- `uncertainty` – za dużo "maybe/perhaps"
- `offtopic` – nie na temat
- `hallucination` – możliwa konfabulacja
- `identity_leak` – "as an AI"
- `fact_mutation` – HARD_FACT został zmieniony (13/10)
- `fact_approximation` – HARD_FACT przybliżony bez literału (13/10)
- `fact_conflict` – źródła się kłócą (13/10)
- `persona_drift` – złamanie charakteru
- `goal_success` – cel osiągnięty
- `goal_failure` – cel nieosiągnięty
- `goal_timeout` – cel wygasł
- `parse_error` – błąd JSON
- `retry_triggered` – Guard wywołał retry
- `soft_fail` – Guard poddał się po max retries

---

### 2.2 GoalFeedbackSystem

**Nowy plik**: `core/systems/GoalFeedbackSystem.ts`

```typescript
interface GoalOutcome {
  goalId: string;
  goalType: 'INSTRUCTION' | 'CURIOSITY' | 'MAINTENANCE';
  success: boolean;
  difficulty: number; // 0-1
  userSignal?: {
    type: 'EXPLICIT' | 'IMPLICIT' | 'TIMEOUT';
    value: number; // -1.0 do +1.0
  };
}
```

**Heurystyka userSignal**:
- `EXPLICIT`: user napisał "super", "dzięki", "nie tak" → sentyment ±1.0
- `IMPLICIT`: user kontynuuje rozmowę bez korekty → +0.3
- `TIMEOUT`: brak reakcji > 60s na cel inicjatywy agenta → -0.5

**Konwersja GoalOutcome → EvaluationEvent**:
```typescript
function goalToEvaluation(outcome: GoalOutcome): EvaluationEvent {
  return {
    source: 'GOAL',
    severity: outcome.success ? 0.2 : 0.5,  // sukces = niska "severity"
    valence: outcome.success ? 'positive' : 'negative',
    tags: outcome.success ? ['goal_success'] : ['goal_failure'],
    confidence: outcome.userSignal?.type === 'EXPLICIT' ? 0.9 : 0.5
  };
}
```

---

### 2.3 Confession → EvaluationBus (Kontrakt)

> **WAŻNE**: Confession NIE karze za:
> - tryb teaching/research (już ma redukcję pain ×0.5),
> - długie odpowiedzi na prośbę usera "rozwiń/wyjaśnij".
>
> Confession generuje wysokie severity TYLKO dla:
> - off-topic,
> - ignorowanie poleceń,
> - jawna halucynacja,
> - identity leak.

```typescript
function confessionToEvaluation(report: ConfessionReport): EvaluationEvent | null {
  // Nie emituj dla niskiego pain
  if (report.pain < 0.2) return null;
  
  return {
    source: 'CONFESSION',
    severity: report.pain,
    valence: 'negative',
    tags: report.self_assessment.known_issues
      .map(i => issueToTag(i))  // mapowanie issue → tag
      .filter(Boolean),
    confidence: 0.7,
    attribution: report.failure_attribution
  };
}
```

---

### 2.4 PersonaGuard (13/10) ✅ IMPLEMENTED

**Plik**: `core/systems/PersonaGuard.ts`

PersonaGuard siedzi między LLM output a user-facing response.
Zapewnia:
1. HARD_FACTS są zachowane (nie zmutowane)
2. Persona pozostaje w charakterze (brak "as an AI" leaks)
3. Fakty są literalne, nie przybliżone bez oryginalnej wartości

```typescript
// Konfiguracja
const GUARD_CONFIG = {
  MAX_RETRIES: 2,
  RETRY_TEMPERATURE_DECAY: 0.1,
  IDENTITY_LEAK_PATTERNS: [
    /\bas an? AI\b/i,
    /\bI'?m a language model\b/i,
    // ... więcej wzorców
  ]
};

// Użycie
const result = personaGuard.check(response, hardFacts, 'Jesse');
// result.action: 'PASS' | 'RETRY' | 'SOFT_FAIL' | 'HARD_FAIL'
// result.issues: GuardIssue[]
```

**Zasada FACT vs APPROX:**
- `energy: 23` → "23%" ✅ (literał)
- `energy: 23` → "23% - to mało" ✅ (literał + komentarz)
- `energy: 23` → "mało energii" ❌ (brak literału = MUTATION)

---

### 2.5 Parser → EvaluationBus

```typescript
// W CortexInference.ts przy CORTEX_PARSE_FAILURE
eventBus.publish({
  type: PacketType.EVALUATION_EVENT,
  payload: {
    source: 'PARSER',
    severity: 0.3,  // techniczny błąd, nie "grzech"
    valence: 'negative',
    tags: ['parse_error'],
    confidence: 1.0,  // pewni, że to błąd
    attribution: 'LLM_MODEL'
  }
});
```

---

### 2.5 Reguła Anty-Podwójnego Karania

> **PROBLEM**: Jedno zachowanie może wygenerować 3 eventy (Parser + Confession + Goal).
> Jeśli wszystkie trafią do chemii, dopamina spadnie za mocno.

**Rozwiązanie**: EvaluationAggregator

```typescript
class EvaluationAggregator {
  private window: EvaluationEvent[] = [];
  private readonly WINDOW_MS = 5000;  // 5s okno
  
  ingest(ev: EvaluationEvent) {
    this.window.push(ev);
    this.pruneOld();
  }
  
  // Zwraca JEDEN zagregowany sygnał dla chemii
  getAggregatedSignal(): { dopamineDelta: number; confidence: number } {
    if (this.window.length === 0) return { dopamineDelta: 0, confidence: 0 };
    
    // Ważona średnia severity * valence * confidence
    let sum = 0, totalConf = 0;
    for (const ev of this.window) {
      const sign = ev.valence === 'positive' ? 1 : -1;
      sum += sign * ev.severity * ev.confidence;
      totalConf += ev.confidence;
    }
    
    const avgSignal = sum / this.window.length;
    const avgConf = totalConf / this.window.length;
    
    // Skalowanie: max ±10 dopaminy na okno
    const dopamineDelta = avgSignal * 10;
    
    return { dopamineDelta, confidence: avgConf };
  }
}
```

---

### 2.6 Dwuetapowe Wdrożenie (KRYTYCZNE)

> **ZASADA**: Najpierw obserwuj, potem reaguj.

**Etap A (pierwszy tydzień)**:
- [ ] EvaluationBus emituje eventy
- [ ] Logi + NeuroMonitor pokazują eventy
- [ ] **Chemia NIE reaguje** (tylko obserwacja)
- [ ] Zbieramy dane: ile eventów/min, rozkład severity, najczęstsze tagi

**Etap B (po walidacji)**:
- [ ] Włączamy EvaluationAggregator
- [ ] Chemia reaguje na zagregowany sygnał
- [ ] Feature flag: `EVALUATION_AFFECTS_CHEMISTRY = true`

---

## FAZA 3: Executive Control (Przyszły Tydzień)

### Problem
Cortex nie ma globalnego obrazu ocen systemu.
Bez histerezy i rate-limitu dostaniemy oscylacje (raz gadatliwy, raz lakoniczny).

### Rozwiązanie: ExecutiveControl z Histerezą

**Nowy plik**: `core/systems/ExecutiveControl.ts`

```typescript
interface ExecutiveDirective {
  type: 'SUPPRESS_EMOTION' | 'BOOST_FOCUS' | 'RAISE_EXPRESSION_BAR';
  target: 'limbic' | 'neurochem' | 'expression';
  intensity: number; // 0-1
  duration: number;  // ms
  reason: string;
  trigger: EvaluationEvent[];
}

interface ExecutiveConfig {
  windowMs: number;           // 30000 (30s)
  minEventsToAct: number;     // 3
  maxDeltaPerWindow: number;  // 0.05 (max zmiana progu)
  cooldownMs: number;         // 60000 (1 min między dyrektywami tego samego typu)
}
```

### Zasady Histerezy (KRYTYCZNE)

> **PROBLEM**: Reagowanie na każde 2–3 eventy = oscylacje.

**Rozwiązanie**:

1. **Okno czasowe**: decyzje tylko na podstawie ostatnich 30–60s eventów
2. **Minimum eventów**: nie reaguj na pojedyncze eventy, wymagaj ≥3
3. **Max delta**: RAISE_EXPRESSION_BAR zmienia próg max o ±0.05 na okno
4. **Cooldown**: ta sama dyrektywa nie częściej niż co 60s
5. **Twardy clamp**: globalny próg expression w zakresie [0.3, 0.9]

```typescript
class ExecutiveControl {
  private lastDirectives: Map<string, number> = new Map();  // type → timestamp
  private config: ExecutiveConfig = {
    windowMs: 30000,
    minEventsToAct: 3,
    maxDeltaPerWindow: 0.05,
    cooldownMs: 60000
  };
  
  evaluate(recentEvents: EvaluationEvent[]): ExecutiveDirective | null {
    // Filtruj do okna
    const windowEvents = recentEvents.filter(
      e => Date.now() - e.timestamp < this.config.windowMs
    );
    
    if (windowEvents.length < this.config.minEventsToAct) return null;
    
    // Sprawdź dominujący tag
    const tagCounts = this.countTags(windowEvents);
    
    // Przykład: seria 'verbosity' → RAISE_EXPRESSION_BAR
    if (tagCounts['verbosity'] >= 3) {
      if (this.canIssue('RAISE_EXPRESSION_BAR')) {
        return {
          type: 'RAISE_EXPRESSION_BAR',
          target: 'expression',
          intensity: Math.min(tagCounts['verbosity'] * 0.02, this.config.maxDeltaPerWindow),
          duration: 120000,  // 2 min
          reason: `${tagCounts['verbosity']} verbosity events in window`,
          trigger: windowEvents
        };
      }
    }
    
    return null;
  }
  
  private canIssue(type: string): boolean {
    const last = this.lastDirectives.get(type) || 0;
    return Date.now() - last > this.config.cooldownMs;
  }
}
```

### Przykłady Dyrektyw

| Trigger | Dyrektywa | Efekt |
|---------|-----------|-------|
| 3× `verbosity` w 30s | `RAISE_EXPRESSION_BAR` | ExpressionPolicy +0.05 próg |
| 3× `parse_error` + fear > 0.5 | `SUPPRESS_EMOTION` | fear ×0.7 na 30s, norepinefryna +5 |
| 3× `goal_success` | `BOOST_FOCUS` | curiosity +0.1 na 60s |

---

## FAZA 4: Nowe Narzędzia (Opcjonalny Sprint)

Narzędzia są ważne dla UX i mocy poznawczej, ale nie rozwiązują podstawowych patologii
(brak sprzężenia zwrotnego, brak hamulca). Dlatego mają **niższy priorytet** niż Faza 2-3.

### 4.1 NOTES Tool - Pamięć Robocza

```typescript
interface NotesTool {
  tool: 'NOTES';
  action: 'WRITE' | 'READ' | 'LIST';
  key?: string;
  content?: string;
}

// Agent może zapisywać notatki między sesjami
// Koszt: energia (pisanie wymaga wysiłku)
// Nagroda: dopamina przy późniejszym użyciu notatki
```

### 4.2 READ_FILE Tool - Dostęp do Kontekstu

```typescript
interface ReadFileTool {
  tool: 'READ_FILE';
  path: string;
  reason: string;
}

// Agent może czytać pliki z workspace
// Koszt: czas + energia
// Nagroda: dopamina jeśli znalazł użyteczną informację
```

### 4.3 LEARN_FROM Tool - Nauka od Innych Agentów

```typescript
interface LearnFromTool {
  tool: 'LEARN_FROM';
  agentId: string;
  topic: string;
}

// Agent może "zapytać" innego agenta o wiedzę
// Wymaga: multi-agent architecture
// Nagroda: serotonina (social learning)
```

---

## FAZA 5: Konsolidacja Refleksji (Później)

Confession v2.1 już pełni rolę lekkiego InternalObservera.
Faza 5 to nie nowy system, tylko **spięcie istniejących modułów**:

- Confession (pain + failure_attribution)
- EvaluationBus (historia ocen)
- DreamConsolidation (senna analiza epizodów)

Cel: długoterminowe raporty typu:

- "W ostatnich 7 dniach moje największe źródła bólu to: verbose+uncertain",
- "Obniżyłem `verbosity` z 0.62 do 0.58, pain spadł o 20%".

Ta faza jest bardziej analityczna/raportowa niż infrastrukturalna.

---

## Metryki Sukcesu

| Faza | Metryka | Cel | Jak mierzyć |
|------|---------|-----|-------------|
| 1 / 1.5 | Dopamine variance | σ > 10 | Histogram w NeuroMonitor |
| 2A | EvaluationBus coverage | 100% zdarzeń ma event | Logi: GOAL/CONFESSION/PARSER |
| 2B | Goal-linked dopamine | Korelacja > 0.5 | Po włączeniu chemii |
| 2B | Brak podwójnego karania | Max 1 korekta/5s | EvaluationAggregator logi |
| 3 | Brak oscylacji | Próg expression zmienia się < 3×/min | ExecutiveControl logi |
| 3 | Effective control | Agent działa mimo strachu | Obserwacja behawioralna |
| 4 | Tool ROI | Narzędzia → goal_success | Korelacja tool_use ↔ outcome |
| 5 | Pain trend | Spadek avg pain w 7 dni | ConfessionLog agregat |

---

## Zasady Implementacji

1. **Jeden commit = jedna funkcja** - małe, testowalne zmiany
2. **Feature flags** - każda faza ma flagę ON/OFF
3. **Telemetria** - każda zmiana loguje się do eventBus
4. **Fallback** - jeśli nowa funkcja zawodzi, wracamy do poprzedniej
5. **Obserwacja przed zmianą** - najpierw logi, potem fix

---

## Status

- [x] FAZA 1: ✅ DONE
  - [x] Asymetryczny decay (3x szybszy spadek powyżej baseline)
  - [x] DOPAMINE_PENALTY za JSON_PARSE_FAILURE (-8 dopaminy)
  - [x] Subskrypcja w useCognitiveKernel
- [x] FAZA 1.5: ✅ DONE (Karpathy Refactor)
  - [x] TraitEvolutionEngine v2.0 - homeostaza zamiast if-ów
  - [x] ConfessionService v2.1 - funkcja kosztu (pain) zamiast progów
  - [x] FailureSource type - atrybucja błędów (LLM_MODEL, PROMPT, SELF)
  - [x] Attribution w DOPAMINE_PENALTY events
- [ ] FAZA 2A: EvaluationBus + GoalFeedback (tylko logi, bez chemii)
- [ ] FAZA 2B: Włączenie chemii po walidacji logów
- [ ] FAZA 3: ExecutiveControl z histerezą
- [ ] FAZA 4: Nowe narzędzia (NOTES / READ_FILE / LEARN_FROM)
- [ ] FAZA 5: Konsolidacja Refleksji (Confession + Dreams + Evaluation)

---

*Ostatnia aktualizacja: 2024-12-09 v2.1*
*Autor: AK-FLOW Engineering Team*
