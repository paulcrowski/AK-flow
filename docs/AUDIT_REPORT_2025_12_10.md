# AUDYT ARCHITEKTONICZNY - 2025-12-10

## NAPRAWIONE PROBLEMY

### 1. ✅ DUPLIKACJA WAKE LOGIC (KRYTYCZNE)
**Problem**: Wake logic była w 3 miejscach:
- `useCognitiveKernel.ts:402-430` (force wake)
- `useCognitiveKernel.ts:691-740` (auto wake)
- Każde miejsce tworzyło `new TraitEvolutionEngine()` - tracąc sygnały!

**Rozwiązanie**: Stworzono `WakeService.ts` - Single Source of Truth
- Jedna funkcja `executeWakeProcess()`
- Singleton `TraitEvolutionEngine` (zachowuje sygnały)
- Obie ścieżki (force/auto) używają tego samego serwisu

### 2. ✅ DUPLIKACJA DREAM CONSOLIDATION
**Problem**: Dwie różne funkcje:
- `dreamConsolidation()` - prosta wersja (legacy)
- `DreamConsolidationService.consolidate()` - pełna wersja

**Rozwiązanie**: Usunięto legacy `dreamConsolidation()`, zastąpiono `runDreamConsolidation()` która wywołuje pełny serwis.

### 3. ✅ JSON PARSING PROMPTS
**Problem**: AI zwracał tekst zamiast JSON w `IdentityConsolidationService`.

**Rozwiązanie**: Wzmocniono prompty z `CRITICAL: You MUST respond with ONLY a valid JSON object` + użyto `extractJSON` zamiast `JSON.parse`.

---

## ARCHITEKTURA PO REFAKTORZE

```
┌─────────────────────────────────────────────────────────────────┐
│                    WAKE PROCESS (DRY)                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  useCognitiveKernel.ts                                          │
│  ├── toggleSleep (force wake) ──┐                               │
│  │                              │                               │
│  └── cognitiveCycle (auto wake)─┼──► WakeService.ts             │
│                                 │    └── executeWakeProcess()   │
│                                 │        ├── TraitEvolution     │
│                                 │        │   (singleton)        │
│                                 │        └── DreamConsolidation │
│                                 │                               │
└─────────────────────────────────────────────────────────────────┘
```

---

## POZOSTAŁE OBSERWACJE (NIE-KRYTYCZNE)

### Magic Numbers
- `0.5` używane jako domyślne wartości - OK, sensowne defaults
- `Math.random() > 0.5` dla REM consolidation - OK, 50% chance

### Deprecated Code
- `TraitEvolutionEngine.evaluateEvolution()` - oznaczone @deprecated
- Używane tylko w testach legacy behavior
- **Rekomendacja**: Usunąć po pełnej migracji do homeostasis

### Clamp Functions
- `clamp01()` w ExpressionPolicy (0-1)
- `clampNeuro()` w NeurotransmitterSystem (0-100)
- **Status**: OK - różne domeny, różne zakresy

---

## PLIKI ZMIENIONE

1. **NOWY**: `core/services/WakeService.ts` - Single Source of Truth dla wake
2. **ZMIENIONY**: `hooks/useCognitiveKernel.ts` - usunięto duplikację
3. **ZMIENIONY**: `core/services/IdentityConsolidationService.ts` - lepsze prompty JSON

---

## METRYKI

| Metryka | Przed | Po |
|---------|-------|-----|
| Miejsca z wake logic | 3 | 1 |
| Instancje TraitEvolutionEngine | N (per wake) | 1 (singleton) |
| Funkcje dreamConsolidation | 2 | 1 |
| Build status | ✅ | ✅ |

---

## DODATKOWE NAPRAWY (Sesja 2)

### 4. ✅ AI zwracał tekst zamiast JSON w IdentityConsolidation
**Problem**: `structuredDialogue` ma hardcoded schema, nie pasuje do identity.

**Rozwiązanie**: Dodano `CortexService.generateJSON<T>(prompt, schema, default)` z `responseMimeType: 'application/json'` - Gemini API gwarantuje JSON.

### 5. ✅ TraitEvolutionEngine tworzony przy każdym wake (HMR)
**Problem**: Moduł był przeładowywany przez HMR, resetując singleton.

**Rozwiązanie**: Użyto `window.__TRAIT_ENGINE__` jako storage który przetrwa HMR.

### 6. ✅ LimbicConfessionListener inicjalizowany wielokrotnie
**Problem**: `useEffect` z dependency na `injectStateOverride` + brak cleanup.

**Rozwiązanie**: 
- Dodano `isInitialized` guard w listenerze
- Zwracana funkcja cleanup z `unsubscribe()`
- Pusta dependency array `[]` w useEffect

---

## REKOMENDACJE NA PRZYSZŁOŚĆ

1. **Dodać testy** dla `WakeService`
2. **Usunąć** `evaluateEvolution()` po pełnej migracji
3. **Rozważyć** wydzielenie `SleepService` analogicznie do `WakeService`
