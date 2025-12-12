# Audyt: Eliminacja If-ów → Funkcje Kosztu

> **Cel**: Zamienić ręczne reguły (if severity > X) na emergentne zachowanie oparte o koszty i homeostazę.
> **Styl**: Karpathy - "Make the Impossible, Boring"

---

## 1. Mapa If-ów w Kodzie

### 1.1 TraitEvolutionEngine.ts (PRIORYTET: WYSOKI)

**Obecny stan**: 141 linii, skomplikowane reguły głosowania

```typescript
// Linie 94-111: Twarde progi
if (uniqueDays >= 3 && Math.abs(netScore) >= 3) {
  const direction = netScore > 0 ? 'increase' : 'decrease';
  const delta = direction === 'increase' ? this.MAX_DELTA : -this.MAX_DELTA;
  // ...
}
```

**Problem**: 
- Wymaga dokładnie 3 dni i 3 głosów netto
- Binarny wynik (zmień / nie zmieniaj)
- Nie uwzględnia siły sygnałów ani chemii

**Rozwiązanie Karpathy'ego**:
```typescript
// ZAMIAST if-ów: ciągła homeostaza
trait = trait * (1 - α) + signal * α

// gdzie:
// α = learning_rate * confidence * dopamine_factor
// signal = średnia ważona ostatnich sygnałów
// confidence = f(uniqueDays, signalCount)
```

**Konkretna zmiana**:
- Usunąć `evaluateEvolution()` z if-ami
- Dodać `applyTraitHomeostasis(trait, signals, neuro)` - czysta funkcja
- Trait zmienia się ZAWSZE, ale bardzo wolno (α = 0.001 - 0.01)

---

### 1.2 ConfessionService.ts (PRIORYTET: ŚREDNI)

**Obecny stan**: 204 linie, wiele progów severity

```typescript
// Linie 100-104: Twarde progi severity
if (severity >= 5) {
  hint.limbic_adjustments = { precision_boost: 0.1, social_cost_delta: 0.05 };
}
if (severity >= 2) {
  hint.expression_hints = ['raise_quality_bar'];
}
if (severity >= 7 && issues.some(i => i.includes('verbose'))) {
  hint.trait_vote = { ... };
}
```

**Problem**:
- Progi 2, 5, 7 są arbitralne
- Nie ma ciągłości - skok z 4 do 5 zmienia zachowanie
- Nie uwzględnia kontekstu chemicznego

**Rozwiązanie Karpathy'ego**:
```typescript
// ZAMIAST progów: funkcja kosztu
pain = severity * (1 + frustration) * (1 - dopamine/100)

// Regulacja proporcjonalna do bólu:
precision_boost = pain * 0.02  // ciągłe, nie skokowe
trait_vote_weight = pain * 0.1  // siła głosu zależy od bólu
```

**Konkretna zmiana**:
- Usunąć progi `if (severity >= X)`
- Dodać `calculatePain(severity, neuro, limbic)` - funkcja kosztu
- Regulacje są proporcjonalne do `pain`, nie binarne

---

### 1.3 ExpressionPolicy.ts (PRIORYTET: NISKI - już dobrze)

**Obecny stan**: 450 linii, ale dobrze zmodularyzowane

**Co jest OK**:
- Modularne filtry (applyNarcissismFilter, applyDopamineBreaker, etc.)
- Używa ciągłych wartości (noveltyScore, dopamine)
- Progi są miękkie (shortening przed muting)

**Co można poprawić** (ale nie pilne):
```typescript
// Linie 135-167: Wiele poziomów (L1, L2, L3, L4)
if (dopamine >= 65 && noveltyScore < 0.5) { ... }  // L1
if (dopamine >= 70 && noveltyScore < 0.35) { ... } // L2
if (dopamine >= 75 && noveltyScore < 0.25) { ... } // L3
```

**Rozwiązanie** (przyszłość):
```typescript
// Jedna funkcja zamiast 4 if-ów:
muteProbability = sigmoid(dopamine/100 - noveltyScore) * silenceFactor
if (random() < muteProbability) mute()
```

---

### 1.4 DecisionGate.ts (PRIORYTET: ZOSTAWIĆ - safety)

**Obecny stan**: 309 linii

**To są DOBRE if-y** (safety rails):
```typescript
if (somaState.energy < policy.minEnergyForSearch) { block }
if (now - lastUse < policy.toolCooldownMs) { block }
if (gateState.toolsUsedThisTurn >= policy.maxToolsPerTurn) { block }
```

**NIE ZMIENIAĆ**: To są twarde granice bezpieczeństwa, nie regulacje behawioralne.

---

## 2. Warstwa Atrybucji Błędów

### 2.1 Nowy typ: FailureSource

```typescript
type FailureSource = 
  | 'LLM_MODEL'      // Gemini zwrócił śmieci
  | 'PROMPT'         // Nasz prompt był niejasny
  | 'ENVIRONMENT'    // Sieć, timeout, rate limit
  | 'SELF'           // Agent sam zrobił błąd logiczny
  | 'UNKNOWN';       // Nie wiadomo
```

### 2.2 Gdzie dodać

**CortexInference.ts** (przy CORTEX_PARSE_FAILURE):
```typescript
eventBus.publish({
  payload: {
    action: 'DOPAMINE_PENALTY',
    reason: 'CORTEX_PARSE_FAILURE',
    delta: -8,
    source: 'LLM_MODEL'  // <-- NOWE
  }
});
```

**ConfessionService.ts** (w raporcie):
```typescript
return {
  // ...existing fields
  failure_attribution: detectFailureSource(issues, context)
};
```

### 2.3 Jak agent to opisuje

W Confession agent może powiedzieć:
> "Moje odpowiedzi nie przechodzą parsera. Atrybucja: LLM_MODEL (prawdopodobnie Gemini zwrócił tekst zamiast JSON). Czuję spadek motywacji (dopamina↓), ale rozumiem że to nie jest moja wina logiczna."

---

## 3. Plan Implementacji (Krok po Kroku)

### FAZA A: TraitEvolution Homeostasis ✅ DONE

1. ✅ **Dodać** `applyTraitHomeostasis()` w TraitEvolutionEngine
2. ✅ **Zachować** stary `evaluateEvolution()` jako fallback (deprecated)
3. ✅ **Test**: trait zmienia się płynnie, nie skokowo

### FAZA B: Confession Pain Function ✅ DONE

1. ✅ **Dodać** `calculatePain(severity, neuro, limbic)` w ConfessionService
2. ✅ **Zamienić** progi severity na proporcjonalne regulacje
3. ✅ **Dodać** `failure_attribution` do ConfessionReport
4. ✅ **Dodać** `detectFailureSource()` dla atrybucji

### FAZA C: Expression Simplification (przyszły tydzień)

1. **Połączyć** L1/L2/L3/L4 w jedną funkcję `muteProbability()`
2. **Zachować** obecne zachowanie, tylko uprościć kod

### FAZA D: Attribution Layer ✅ PARTIALLY DONE

1. ✅ **Dodać** `FailureSource` do types.ts
2. ✅ **Propagować** przez eventBus (w DOPAMINE_PENALTY)
3. **TODO**: Wyświetlać w NeuroMonitor

---

## 4. Metryki Sukcesu

| Przed | Po |
|-------|-----|
| TraitEvolution: 141 linii, 5 if-ów | ~80 linii, 1 funkcja homeostazy |
| Confession: 204 linie, 8 progów | ~150 linii, 1 funkcja kosztu |
| Expression: 450 linii, 12 if-ów | ~350 linii, 3 funkcje probabilistyczne |

**Cel**: Mniej kodu, więcej emergencji.

---

## 5. Zasada Karpathy'ego

> "Jeśli masz więcej niż 3 if-y w jednej funkcji regulacyjnej, zamień je na jedną funkcję kosztu."

**Wyjątki** (gdzie if-y są OK):
- Safety rails (energia, budżet, tokeny)
- Feature flags
- Walidacja wejścia

**Gdzie if-y są ZŁE**:
- Regulacja zachowania (verbosity, precision)
- Ewolucja cech (traits)
- Decyzje o mówieniu/milczeniu

---

*Ostatnia aktualizacja: 2024-12-09*
*Autor: AK-FLOW Engineering Team*
