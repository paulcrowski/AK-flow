# AK-FLOW AGI Roadmap - Fazy Rozwoju

> **Wizja**: System poznawczy z prawdziwą chemią, wolą i autonomią.
> **Styl**: Karpathy-level engineering - minimalne, testowalne, obserwowalne.

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

## FAZA 2: Goal Feedback Loop (Ten Tydzień)

### Problem
Agent nie dostaje nagrody za osiągnięcie celu ani kary za porażkę.
Dopamina jest "płaska" - brak związku z rzeczywistym sukcesem.

### Rozwiązanie: GoalFeedbackSystem

**Nowy plik**: `core/systems/GoalFeedbackSystem.ts`

```typescript
interface GoalOutcome {
  goalId: string;
  success: boolean;
  completionTime: number;
  userSatisfaction?: number; // 0-1, z analizy reakcji usera
}

export function processGoalOutcome(outcome: GoalOutcome, neuro: NeurotransmitterState): NeurotransmitterState {
  let dopamineDelta = 0;
  let serotoninDelta = 0;

  if (outcome.success) {
    // NAGRODA: proporcjonalna do trudności (czas) i satysfakcji usera
    dopamineDelta = 10 + (outcome.userSatisfaction ?? 0.5) * 10;
    serotoninDelta = 5;
    
    console.log(`[GoalFeedback] SUCCESS: +${dopamineDelta} dopamine`);
  } else {
    // KARA: umiarkowana, żeby nie wbić w depresję
    dopamineDelta = -5;
    
    console.log(`[GoalFeedback] FAILURE: ${dopamineDelta} dopamine`);
  }

  return {
    dopamine: clampNeuro(neuro.dopamine + dopamineDelta),
    serotonin: clampNeuro(neuro.serotonin + serotoninDelta),
    norepinephrine: neuro.norepinephrine
  };
}
```

### Integracja z EventLoop

```typescript
// W EventLoop, po zakończeniu celu:
eventBus.subscribe(PacketType.GOAL_COMPLETED, (packet) => {
  ctx.neuro = processGoalOutcome(packet.payload, ctx.neuro);
});
```

---

## FAZA 3: Executive Control (Przyszły Tydzień)

### Problem
Cortex nie ma kontroli nad niższymi systemami.
Limbic i Neurochem działają autonomicznie bez top-down modulation.

### Rozwiązanie: ExecutiveControl Module

**Nowy plik**: `core/systems/ExecutiveControl.ts`

```typescript
interface ExecutiveDirective {
  type: 'SUPPRESS_EMOTION' | 'BOOST_FOCUS' | 'OVERRIDE_IMPULSE';
  target: 'limbic' | 'neurochem';
  intensity: number; // 0-1
  duration: number;  // ms
  reason: string;
}

// Cortex może wydać dyrektywę:
// "Czuję strach, ale muszę działać - tłumię go na 30 sekund"
export function applyExecutiveControl(
  directive: ExecutiveDirective,
  limbic: LimbicState,
  neuro: NeurotransmitterState
): { limbic: LimbicState; neuro: NeurotransmitterState } {
  
  if (directive.type === 'SUPPRESS_EMOTION' && directive.target === 'limbic') {
    // Tłumienie emocji kosztuje energię i norepinefrynę
    return {
      limbic: {
        ...limbic,
        fear: limbic.fear * (1 - directive.intensity * 0.5),
        anger: limbic.anger * (1 - directive.intensity * 0.5)
      },
      neuro: {
        ...neuro,
        norepinephrine: clampNeuro(neuro.norepinephrine + 10 * directive.intensity)
      }
    };
  }
  
  // ... inne dyrektywy
}
```

---

## FAZA 4: Nowe Narzędzia (Następny Sprint)

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

## FAZA 5: Confession & Self-Reflection (Miesiąc)

### Problem
Agent nie ma mechanizmu autorefleksji.
Nie wie, że popełnia błędy (JSON_PARSE_FAILURE) ani dlaczego.

### Rozwiązanie: ConfessionSystem Enhancement

```typescript
// Rozszerzenie istniejącego ConfessionSystem
interface EnhancedConfession {
  // Istniejące
  type: 'CONFESSION_REPORT';
  
  // Nowe
  selfDiagnosis: {
    recentErrors: string[];
    emotionalPattern: string;
    suggestedFix?: string;
  };
  
  // Agent sam proponuje jak się naprawić
  selfCorrection?: {
    behavior: string;
    reason: string;
  };
}
```

---

## Metryki Sukcesu

| Faza | Metryka | Cel |
|------|---------|-----|
| 1 | Dopamine variance | σ > 10 (nie płaska linia) |
| 2 | Goal completion rate | > 60% |
| 3 | Fear suppression success | Agent działa mimo strachu |
| 4 | Tool usage diversity | Wszystkie narzędzia użyte |
| 5 | Self-correction rate | Agent sam naprawia błędy |

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
- [ ] FAZA 2: Nie rozpoczęta
- [ ] FAZA 3: Nie rozpoczęta
- [ ] FAZA 4: Nie rozpoczęta
- [ ] FAZA 5: ConfessionSystem istnieje, wymaga rozszerzenia

---

*Ostatnia aktualizacja: 2024-12-09*
*Autor: AK-FLOW Engineering Team*
