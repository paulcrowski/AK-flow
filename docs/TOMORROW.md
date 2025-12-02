# 🎯 Plan na Dziś: 2025-12-02

> **Cel:** Osiągnąć **9.0/10** poprzez Quick Wins (modularność 10/10, code quality 9.5/10)  
> **Czas:** ~4 godziny  
> **Status:** Stabilizacja po Poetic Regulation

---

## ✅ QUICK WINS (4 godziny) - UKOŃCZONE

### 1. Modularność 10/10 (15 min) - DONE ✅
**Problem:** `AUTONOMOUS_LIMIT_PER_MINUTE` jest globalną stałą w `gemini.ts`, powinien być częścią kontekstu.

**Akcja:**
- [x] Przenieś `AUTONOMOUS_LIMIT_PER_MINUTE` do `LoopContext` w `EventLoop.ts`
- [x] Usuń globalną stałą z `gemini.ts`
- [x] Przekaż przez parametry zamiast importu

**Oczekiwany wynik:** Modularność 9/10 → 10/10

---

### 2. Type Guards (30 min) - DONE ✅
**Problem:** `cleanJSON()` w `gemini.ts` nie ma walidacji typów - może zwrócić cokolwiek.

**Akcja:**
- [x] Dodano generic type guard `isValidResponse`
- [x] Zaktualizowano `cleanJSON` o walidację runtime
- [x] Dodano logowanie błędów parsowania do EventBus

**Oczekiwany wynik:** Code Quality +0.5

---

### 3. Error Boundaries (1h) - DONE ✅
**Problem:** Jeśli LLM zwróci błędny JSON, cała pętla autonomii crashuje.

**Akcja:**
- [x] Stworzono `ComponentErrorBoundary.tsx`
- [x] Opakowano `NeuroMonitor` w `App.tsx`
- [x] Zabezpieczono UI przed crashem

**Oczekiwany wynik:** Stabilność +1.0

---

### 4. Unit Tests (2h) - DONE ✅
**Problem:** Zero testów jednostkowych - nie wiemy, czy refaktoring coś zepsuł.

**Akcja:** Stwórz `__tests__/` folder z 10 podstawowymi testami:
- [x] Zainstalowano `vitest`
- [x] Stworzono `EventLoop.test.ts`
- [x] Przetestowano `checkBudget` (limit autonomii)
- [x] Przetestowano `runSingleStep` (przetwarzanie inputu)
- [x] Weryfikacja: Testy przechodzą

**Oczekiwany wynik:** Code Quality 9.5/10, Confidence +2.0

---

## 🎁 BONUS (jeśli zostanie czas)

### Semantic Intent Detection (1h)
**Problem:** Poetic Mode używa keyword matching (`includes("poetic")`), co daje false positives.

**Akcja:**
```typescript
// Zamiast:
if (lowerInput.includes("poetic")) ctx.poeticMode = true;

// Użyj LLM:
const intent = await CortexService.assessInput(input, {
  task: "detect_style_preference",
  options: ["simple", "poetic", "technical"]
});
if (intent.preference === "poetic") ctx.poeticMode = true;
```

**Oczekiwany wynik:** Biologiczny Realizm 8/10 → 9/10

---

## 📊 Oczekiwany Wynik Końcowy

| Kategoria | Przed | Po | Zmiana |
|-----------|-------|----|----|
| Modularność | 9/10 | 10/10 | +1.0 |
| Code Quality | 8/10 | 9.5/10 | +1.5 |
| Bezpieczeństwo | 10/10 | 10/10 | 0 |
| Biologiczny Realizm | 8/10 | 8/10 | 0 |
| **OVERALL** | **8.2/10** | **9.0/10** | **+0.8** |

---

## 🔮 Wizja na Przyszłość (nie dziś!)

### Medium Effort (weekend)
- **NeurotransmitterSystem** - dopamina, serotonina, norepinefryna
- **Adaptive Poetry Detector** - uczenie się słów zamiast hard-coded keywords

### Long-Term (research-level)
- **Goal Formation** - agent tworzy własne cele
- **Multi-Step Reasoning** - chain-of-thought dla złożonych problemów
- **Self-Modification** - agent może zmieniać własny kod (z approval)

---

## 🚀 Workflow na Dziś

1. **Rano (teraz):** Przeczytaj ten plik
2. **10:00-12:00:** Quick Wins 1-2 (modularność + type guards)
3. **12:00-13:00:** Przerwa
4. **13:00-15:00:** Quick Wins 3-4 (error boundaries + testy)
5. **15:00-16:00:** Bonus (semantic intent) lub odpoczynek
6. **Wieczorem:** Zaktualizuj `CHALLENGES.md` + stwórz nowy `TOMORROW.md` na 2025-12-03

---

**Motto dnia:** *"Stabilizacja przed innowacją. Testy przed refaktorem. Działający kod przed idealnym kodem."*
