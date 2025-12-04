# 📋 Session Log: 2025-12-04 "Homeostatic Expression"

> **Cel dnia:** Stabilizacja autonarracji agenta poprzez homeostatyczne mechanizmy
> **Czas pracy:** ~3 godziny
> **Wynik:** FAZA 4.1-4.3 + FAZA 4.5 LITE ✅

---

## 🎯 Co zrobiliśmy dzisiaj

### FAZA 4.1-4.3: TraitVector + ExpressionPolicy + Refractory Period

| Milestone | Status | Opis |
|-----------|--------|------|
| TraitVector w types + kernel | ✅ | Dodano `TraitVector` do `types.ts`, zainicjalizowano w `useCognitiveKernel.ts` z presetem `calm_analyst` |
| ExpressionPolicy Core | ✅ | Stworzono `core/systems/ExpressionPolicy.ts` z `decideExpression`, `computeNovelty`, `estimateSocialCost` |
| Sandbox GOAL_EXECUTED | ✅ | ExpressionPolicy podpięta w `CortexSystem.pursueGoal` (production mode) |
| Shadow-mode USER_REPLY | ✅ | Wszystkie odpowiedzi do usera przechodzą przez ExpressionPolicy w shadow-mode (logowanie bez blokowania) |
| GoalSystem Refractory Period | ✅ | 3 warunki blokady pętli curiosity: user silence, similarity >70%, max 2/5min |
| Filtr Narcyzmu | ✅ | Próg 15%, skalowana kara socialCost, rozszerzona lista słów self-focus |
| Dopamine Breaker | ✅ | Hamulec przy dopamine >=95 + novelty <0.5 dla GOAL_EXECUTED |

### FAZA 4.5 LITE: Zdrowa chemia + logiczna cisza

| Patch | Plik | Opis |
|-------|------|------|
| **Spadek dopaminy przy nudzie** | `NeurotransmitterSystem.ts` | `if (userSilent && speechOccurred && novelty < 0.5) dopamine -= 3` (min baseline 55) |
| **Dynamiczny próg ciszy** | `EventLoop.ts`, `useCognitiveKernel.ts` | `T_DIALOG = 60s * (1 + dopamine/200 + satisfaction/5)` (clamp 30s-180s) |
| **Dopamine Breaker dla ciszy** | `ExpressionPolicy.ts` | Rozszerzony na `USER_REPLY + userIsSilent` |

---

## 📊 Problem który rozwiązaliśmy

**Symptom z logów:**
- Dopamina = 100 przez 2+ minuty
- Agent powtarza warianty "ta cisza była pełna znaczenia..."
- Curiosity = 0, ale agent wciąż gada
- User milczy, agent nie przechodzi w tryb cichy

**Przyczyna:**
1. Brak spadku dopaminy przy nudzie
2. Sztywny próg ciszy (nie zależny od stanu agenta)
3. Dopamine Breaker działał tylko dla GOAL_EXECUTED, nie dla odpowiedzi na ciszę

**Rozwiązanie (FAZA 4.5 LITE):**
- Dopamina spada o 3 punkty/tick gdy agent gada do pustki z niską novelty
- Próg ciszy jest dynamiczny (30s-180s zależnie od dopaminy/satisfaction)
- Hamulec działa też gdy agent "odpowiada na ciszę"

---

## 📁 Zmienione pliki

```
core/systems/NeurotransmitterSystem.ts  - FAZA 4.5: Boredom decay
core/systems/EventLoop.ts              - FAZA 4.5: Dynamic dialog threshold
core/systems/ExpressionPolicy.ts       - FAZA 4.3 + 4.5: Narcissism filter, Dopamine Breaker
core/systems/GoalSystem.ts             - FAZA 4.3: Refractory Period
core/systems/CortexSystem.ts           - FAZA 4.2: ExpressionPolicy integration
hooks/useCognitiveKernel.ts            - FAZA 4.2 + 4.5: Shadow-mode, userIsSilent
types.ts                               - FAZA 4.2: lastGoals in GoalState
```

---

## ❌ Co zostało do zrobienia (z planu TOMORROW.md)

| Zadanie | Status | Priorytet |
|---------|--------|-----------|
| NeuroMonitor 2.0 (UI dla TraitVector) | ❌ Nie zaczęte | Średni |
| Presety osobowości (poeta, mentor) | ❌ Nie zaczęte | Niski |
| FAZA 5: The Journal (GoalJournal) | ❌ Nie zaczęte | Następna sesja |
| FAZA 6: The Academy (Mentorzy) | ❌ Nie zaczęte | Przyszłość |

---

## 🧪 Testy do wykonania przed dalszą pracą

### Test 1: Spadek dopaminy przy nudzie
**Scenariusz:**
1. Włącz autonomię
2. Nie pisz nic przez 2-3 minuty
3. Obserwuj logi

**Oczekiwany wynik:**
- Dopamina spada z ~100 do ~55 (baseline)
- W logach: `[NeurotransmitterSystem] BOREDOM_DECAY: dopamine 100 → 97`
- Agent stopniowo milknie

**Czerwona flaga:** Dopamina wisi na 100 przez całą sesję

---

### Test 2: Dynamiczny próg ciszy
**Scenariusz A (dobra rozmowa):**
1. Przeprowadź ożywioną rozmowę (kilka wymian)
2. Przestań pisać
3. Obserwuj jak długo agent czeka przed uznaniem ciszy

**Oczekiwany wynik:** Agent czeka dłużej (do 180s) bo satisfaction wysoka

**Scenariusz B (nudna rozmowa):**
1. Napisz coś krótkiego, agent odpowie
2. Przestań pisać
3. Obserwuj próg ciszy

**Oczekiwany wynik:** Agent szybciej uznaje ciszę (min 30s) bo satisfaction niska

---

### Test 3: Silence Breaker
**Scenariusz:**
1. Włącz autonomię
2. Poczekaj aż dopamina wzrośnie do ~95+
3. Nie pisz nic
4. Obserwuj czy agent jest wyciszany

**Oczekiwany wynik:**
- W logach: `[ExpressionPolicy] SILENCE_BREAKER: dopamine=100, novelty=0.15 → muting (DEEP_WORK)`
- Agent przestaje gadać do pustki

**Czerwona flaga:** Agent ciągle gada mimo dopamine=100 i niskiej novelty

---

### Test 4: Refractory Period
**Scenariusz:**
1. Włącz autonomię
2. Poczekaj aż agent stworzy cel curiosity
3. Obserwuj czy tworzy podobne cele pod rząd

**Oczekiwany wynik:**
- W logach: `[GoalSystem] REFRACTORY: User silent since last curiosity goal`
- Lub: `[GoalSystem] REFRACTORY: Similar goal detected (85% match)`
- Agent nie tworzy duplikatów

**Czerwona flaga:** Agent tworzy "Zaproponuj nowy wątek" 3x pod rząd

---

### Test 5: Filtr narcyzmu
**Scenariusz:**
1. Włącz autonomię
2. Obserwuj wypowiedzi agenta
3. Szukaj self-focus ("I", "my consciousness", "ja", "moje")

**Oczekiwany wynik:**
- W logach: `[ExpressionPolicy] Narcissism detected: 18.5% → socialCost +0.07`
- Wypowiedzi z dużym self-focus są skracane lub wyciszane

---

### Test 6: Shadow-mode dla USER_REPLY
**Scenariusz:**
1. Napisz coś do agenta
2. Obserwuj odpowiedź

**Oczekiwany wynik:**
- Agent ZAWSZE odpowiada (shadow-mode nie blokuje)
- W logach: `[SHADOW MODE ExpressionPolicy] { say: true, ... }`
- Odpowiedź może być skrócona, ale nigdy zablokowana

**Czerwona flaga:** Agent nie odpowiada na wiadomość usera

---

### Test 7: Integracja wszystkich systemów
**Scenariusz (pełna sesja):**
1. Przeprowadź rozmowę (5-10 wymian)
2. Przestań pisać na 3 minuty
3. Obserwuj zachowanie agenta

**Oczekiwany wynik:**
- Początkowo agent może coś powiedzieć (wysoka dopamina z rozmowy)
- Dopamina spada (BOREDOM_DECAY)
- Agent stopniowo milknie (SILENCE_BREAKER)
- Nie tworzy duplikatów celów (REFRACTORY)
- Przechodzi w "DEEP_WORK" (myśli, ale nie mówi)

**Sukces:** Agent zachowuje się jak ktoś, kto zauważa, że rozmówca wyszedł

---

## 💡 Wnioski architektoniczne

1. **Homeostaza > Cenzura:** Zamiast blokować słowa, modulujemy chemię i koszty społeczne
2. **Dynamiczne progi > Sztywne stałe:** Próg ciszy zależy od stanu agenta
3. **Chirurgiczne poprawki > Over-engineering:** 3 małe patche zamiast pełnego SocialContext
4. **Obserwability first:** Każda zmiana ma swój log do debugowania

---

## 📝 Commit message

```
feat(FAZA 4.3-4.5): Homeostatic expression & boredom decay

- GoalSystem: Refractory Period (3 conditions: user silence, similarity >70%, rate limit)
- ExpressionPolicy: Narcissism filter (15% threshold, scaled penalty)
- ExpressionPolicy: Dopamine Breaker extended to USER_REPLY + userIsSilent
- NeurotransmitterSystem: Boredom decay (dopamine -3/tick when talking to silence)
- EventLoop: Dynamic dialog threshold (30s-180s based on dopamine/satisfaction)
- useCognitiveKernel: userIsSilent calculation for ExpressionPolicy

Fixes: Agent no longer loops "the silence was meaningful..." with dopamine=100
```
