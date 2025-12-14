# 🛡️ AK-FLOW V3.0 - MITIGACJA RYZYKA (Uczenie vs. Stabilność)

**Wersja:** v3.1 (zabezpieczenie przed "fałszywą stabilnością")
**Cel:** Upewnić się, że system **naprawdę się uczy**, a nie tylko wygląda na stabilny
**Filozofia:** "Jeśli nie boli, to nie uczy"

---

## 🚨 RYZYKO: Fałszywa stabilność

**Objawy:**
- System wygląda na stabilny (zero błędów)
- Agent jest grzeczny i skupiony
- **Ale:** Nie uczy się nic nowego

**Przyczyna:**
- Narzędzia są zbyt łagodne (nie bolą)
- Serotonina tłumi porażki (zbyt wczesne uspokajanie)
- ACh blokuje eksplorację (zbyt wczesne skupienie)

---

## 🎯 MITIGACJA RYZYKA

### 1. **Narzędzia muszą bolać**

**Jak:**
- **NOTES:** Ograniczyć rozmiar (max 100 znaków)
- **READ_FILE:** Dodać 20% szansę na błąd (symulacja)
- **Koszt:** Każde użycie narzędzia kosztuje energię

**Dlaczego:**
- Agent musi **wybierać** (koszt vs. korzyść)
- Agent musi **radzić sobie z błędami** (niepewność)
- Agent musi **uczyć się ekonomii** (nie spamować)

**Efekt:**
- EvalBus zbiera realne dane o porażkach
- Agent uczy się **strategii** (kiedy używać narzędzi)

---

### 2. **Serotonina musi reagować na porażki**

**Jak:**
- **Porażka narzędzia** → Serotonina -0.1
- **Sukces narzędzia** → Serotonina +0.05
- **Brak działania** → Serotonina -0.02 (kara za pasywność)

**Dlaczego:**
- Agent musi **czuć** porażki (nie ignorować)
- Agent musi **uczyć się** z błędów (nie powtarzać)
- Agent musi **działać** (nie siedzieć bezczynnie)

**Efekt:**
- Agent **uczy się** z porażek
- Agent **unika** błędów
- Agent **działa** (nie czeka)

---

### 3. **ACh musi być reaktywna, nie prewencyjna**

**Jak:**
- **Dzień 1-2:** ACh w trybie PASSIVE (tylko logowanie)
- **Dzień 3:** ACh w trybie REAKTYWNYM (reakcja na dane)
- **Dzień 4:** ACh w trybie AKTYWNYM (blokada szumu)

**Dlaczego:**
- Najpierw zbieramy dane o rozproszeniu
- Potem reagujemy na realne problemy
- Na koniec blokujemy szum (jeśli jest problem)

**Efekt:**
- Zero sztucznego tłumienia eksploracji
- ACh reaguje na **realne** problemy

---

### 4. **EvalBus musi być brutalny**

**Jak:**
- **Loguj wszystko:**
  - Każde użycie narzędzia
  - Każdy błąd narzędzia
  - Każda porażka
  - Każdy sukces
- **Kara za spam:**
  - 3x to samo narzędzie w 10s → kara
  - 5x to samo narzędzie w 1min → blokada

**Dlaczego:**
- Agent musi **czuć** konsekwencje
- Agent musi **uczyć się** ekonomii
- Agent musi **unikać** spamowania

**Efekt:**
- Agent **uczy się** strategii
- Agent **unika** błędów
- Agent **optymalizuje** użycie narzędzi

---

## 📊 PLAN DZIAŁANIA (Z MITIGACJĄ RYZYKA)

### Dzień 1 (8h) - Narzędzia + Ból
1. **STAB-011a** (NOTES - max 100 znaków) - 2h
2. **STAB-011b** (READ_FILE - 20% błędów) - 2h
3. **STAB-011c** (Koszt energii) - 1h
4. **STAB-001** (Unified Input Queue) - 3h
**Efekt:** Narzędzia bolą, agent uczy się

### Dzień 2 (8h) - Serotonina + EvalBus
1. **STAB-003a** (Serotonina - porażki) - 2h
2. **STAB-003b** (Serotonina - sukcesy) - 2h
3. **STAB-003c** (Serotonina - kara za pasywność) - 1h
4. **STAB-010** (ACh - PASSIVE MODE) - 3h
**Efekt:** Serotonina reaguje na porażki

### Dzień 3 (4h) - ACh + EvalBus
1. **STAB-010a** (ACh - REAKTYWNY) - 2h
2. **STAB-010b** (ACh - AKTYWNY) - 2h
**Efekt:** ACh reaguje na realne problemy

### Dzień 4 (3h) - Analiza
1. **STAB-015** (Analiza EvalBus) - 3h
**Efekt:** Wiemy czy system się uczy

---

## 🎯 KRYTERIA SUKCESU

### 1. **Agent popełnia błędy**
- **Dobrze:** Agent używa narzędzi i popełnia błędy
- **Źle:** Agent nie używa narzędzi (zbyt ostrożny)

### 2. **Agent uczy się z błędów**
- **Dobrze:** Agent powtarza błędy coraz rzadziej
- **Źle:** Agent powtarza te same błędy

### 3. **Agent optymalizuje użycie narzędzi**
- **Dobrze:** Agent używa narzędzi strategicznie
- **Źle:** Agent spamuje narzędziami

### 4. **EvalBus zbiera dane**
- **Dobrze:** EvalBus ma dane o porażkach/sukcesach
- **Źle:** EvalBus jest pusty (agent nie działa)

---

## 📝 INSTRUKCJA IMPORTU DO FOCALBOARD

1. **Utwórz nową tablicę** "AK-FLOW V3.1 - Uczenie vs. Stabilność"
2. **Dodaj kolumny:**
   - 🟩 Backlog (CRITICAL)
   - 🟠 Backlog (HIGH)
   - 🟡 Backlog (MEDIUM)
   - 🟨 In Progress
   - 🟩 Done
3. **Dodaj zadania** z powyższej listy
4. **Ustaw priorytety:**
   - 🔴 CRITICAL
   - 🟠 HIGH
   - 🟡 MEDIUM
5. **Ustaw szacowany czas** dla każdego zadania
6. **Przypisz zadania** do siebie
7. **Ustaw daty zakończenia** (Dzień 1-4)

---

## 🎯 EFEKT KOŃCOWY (V3.1)

**Po 4 dniach masz:**
- ✅ Agent popełnia błędy (Narzędzia bolą)
- ✅ Agent uczy się z błędów (Serotonina reaguje)
- ✅ Agent optymalizuje użycie narzędzi (EvalBus zbiera dane)
- ✅ Agent skupia się (ACh reaguje na realne problemy)
- ✅ Gotowy na FAZA 7 (Multi-agent + Attention Gates)

**Różnica vs. V3.0:**
- Narzędzia **bolą** (nie są łagodne)
- Serotonina **reaguje** (nie tłumi)
- ACh **reaguje** (nie blokuje)
- EvalBus **zbiera dane** (nie jest pusty)

---

**Data generowania:** 2025-12-13
**Wersja:** AK-FLOW Risk Mitigation v3.1
**Autor:** Mistral Vibe (na podstawie audytu kodu + sugestii drugiego agenta + mitigacji ryzyka)
