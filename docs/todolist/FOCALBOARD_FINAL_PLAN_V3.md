# 🚀 AK-FLOW - FINALNY PLAN STABILIZACYJNY V3 (Z KOREKTĄ KOLEJNOŚCI)

**Wersja:** v3.0 (z korektą kolejności - działanie przed regulacją)
**Filozofia:** Narzędzia → Porażki → Regulacja (ACh + Serotonina)
**Czas:** 23h (4 dni)
**Efekt:** Agent działa, popełnia błędy, uczy się, dopiero potem regulacja

---

## 🎯 CEL: Działanie → Porażki → Regulacja

**Nowa oś:**
1. **Jedna brama wejścia** (Unified Input Queue)
2. **Narzędzia + błędy** (NOTES, READ_FILE)
3. **Dane z EvalBus** (sukces/porażka)
4. **Dopiero wtedy regulacja** (ACh + Serotonina)

**Dlaczego:**
- Bez realnych działań, regulacja jest sztuczna
- Agent musi popełniać błędy, zanim go regulujemy
- EvalBus musi mieć realne sygnały, nie symulacje

---

## 🟩 BACKLOG - Zadania do zrobienia (Korekta kolejności)

### 🔴 CRITICAL (Musi być zrobione)

#### STAB-001: Unified Input Queue (Bez ACh na razie)
**Opis:** Zlikwidować podwójną ścieżkę `processUserInput` + `EventLoop.tick`
**Dlaczego:**
- Eliminuje race condition (agent odpowiada 2x)
- Tworzy jedną bramę dla ACh (później)
**Szacowany czas:** 4h
**Efekt:** Zero race condition, jedna brama

---

#### STAB-011: Narzędzia Testowe (P0) - PRZENIESIONE NA GÓRĘ
**Opis:** Minimalne narzędzia: NOTES + READ_FILE
**Dlaczego:**
- Generują realne EvaluationEvent
- Dają dane o porażkach/sukcesach
- Testują EvalBus w praktyce
**Szacowany czas:** 4h
**Efekt:** Agent działa, popełnia błędy, uczy się

---

#### STAB-002: Hemisphere Tracking (Dokończenie 70% → 100%)
**Opis:** Dokończyć śledzenie aktywności półkul w ExecutiveGate
**Dlaczego:** Pełna widoczność przepływu decyzyjnego
**Szacowany czas:** 2h
**Efekt:** Wiemy która półkula decyduje

---

### 🟠 HIGH (Wysoki priorytet - po narzędziach)

#### STAB-010: Acetylocholina (ACh) - Attention Gate (PASSIVE MODE)
**Opis:**
1. Zaimplementuj ACh technicznie
2. **Uruchom w trybie PASSIVE (logging-only)**
3. Nie blokuj autonomous thoughts (tylko loguj)
**Dlaczego:**
- Najpierw zbieramy dane o rozproszeniu
- Dopiero potem włączamy regulację
- Unikamy sztucznego ADHD suppression
**Szacowany czas:** 3h
**Efekt:** Dane o skupieniu, zero regulacji

---

#### STAB-003: Serotonin Reactions (Dokończenie 40% → 100%)
**Opis:** Dokończyć reakcje serotoninowe w ChemistryBridge
**Dlaczego:**
- Stabilizujemy emocje PO porażkach narzędzi
- Agent uczy się radzić sobie z błędami
**Szacowany czas:** 4h
**Efekt:** Stabilna chemia PO realnych porażkach

---

#### STAB-004: Centralizacja Thresholds
**Opis:** Przenieść wszystkie progi do `systemConfig.ts`
**Dlaczego:** Łatwiejsze zarządzanie parametrami
**Szacowany czas:** 2h
**Efekt:** Wszystkie progi w jednym miejscu

---

### 🟡 MEDIUM (Średni priorytet)

#### STAB-005: Error Recovery System
**Opis:** Graceful degradation dla krytycznych błędów
**Dlaczego:** Agent nie panikuje przy błędach
**Szacowany czas:** 2h
**Efekt:** Stabilne zachowanie przy błędach

---

#### STAB-006: Performance Monitoring
**Opis:** Logowanie czasu `cognitiveCycle`
**Dlaczego:** Wiemy ile czasu zajmuje każdy tick
**Szacowany czas:** 1h
**Efekt:** Monitoring wydajności

---

#### STAB-007: Dokumentacja Architektury
**Opis:** Zaktualizować `ARCHITECTURE_EXPLAINED.md`
**Dlaczego:** Pełna dokumentacja dla nowych developerów
**Szacowany czas:** 2h
**Efekt:** Dokumentacja gotowa

---

#### STAB-009: Automatyczne testy przed commit
**Opis:** Uruchamianie testów przed każdym commit
**Dlaczego:** Zapobiega regressjom
**Szacowany czas:** 1h
**Efekt:** Zero regressji

---

## 🟨 IN PROGRESS (W trakcie)

#### STAB-008: ExecutiveGate Tests
**Opis:** Upewnić się że wszystkie testy przechodzą
**Dlaczego:** 100% stabilne testy
**Szacowany czas:** 1h
**Efekt:** Pełne pokrycie testami

---

## 🟩 DONE (Zrobione)

#### STAB-012: ExecutiveGate Core
**Efekt:** Zero race condition, stabilne odpowiedzi

#### STAB-013: EmotionEngine
**Efekt:** Stabilne emocje, brak losowości

#### STAB-014: Identity Cache Fix
**Efekt:** Stabilna tożsamość przez całą sesję

---

## 📊 NOWY PLAN DZIAŁANIA (4 dni - korekta kolejności)

### Dzień 1 (8h) - Jedna brama + narzędzia
1. **STAB-001** (Unified Input Queue) - 4h
2. **STAB-011** (Narzędzia testowe) - 4h
**Efekt:** Agent działa, popełnia błędy, generuje dane

### Dzień 2 (8h) - Śledzenie + ACh (passive)
1. **STAB-002** (Hemisphere Tracking) - 2h
2. **STAB-010** (ACh - PASSIVE MODE) - 3h
3. **STAB-008** (ExecutiveGate Tests) - 1h
4. **STAB-004** (Centralizacja Thresholds) - 2h
**Efekt:** Dane o skupieniu, zero regulacji

### Dzień 3 (4h) - Serotonina + Error Handling
1. **STAB-003** (Serotonin) - 4h
**Efekt:** Stabilna chemia PO realnych porażkach

### Dzień 4 (3h) - Monitoring + Analiza
1. **STAB-005** (Error Recovery) - 2h
2. **STAB-006** (Performance Monitoring) - 1h
3. **STAB-007** (Dokumentacja) - 2h
4. **STAB-009** (Automatyczne testy) - 1h
**Efekt:** Pełna stabilność + dane do FAZA 7

---

## 🎯 KLUCZOWE ZMIANY VS. V2.0

### 1. **Narzędzia przed regulacją**
- **V2.0:** ACh + Serotonina → Narzędzia
- **V3.0:** Narzędzia → ACh (passive) → Serotonina

### 2. **ACh w trybie PASSIVE**
- **V2.0:** ACh blokuje autonomous thoughts
- **V3.0:** ACh tylko loguje (zero blokady)

### 3. **Serotonina po porażkach**
- **V2.0:** Serotonina przed narzędziami
- **V3.0:** Serotonina po narzędziach (realne porażki)

---

## 📝 INSTRUKCJA IMPORTU DO FOCALBOARD

1. **Utwórz nową tablicę** "AK-FLOW V3 - Działanie → Regulacja"
2. **Dodaj kolumny:**
   - 🟩 Backlog (CRITICAL)
   - 🟠 Backlog (HIGH)
   - 🟡 Backlog (MEDIUM)
   - 🟨 In Progress
   - 🟩 Done
3. **Dodaj zadania** z powyższej listy (z nową kolejnością)
4. **Ustaw priorytety:**
   - 🔴 CRITICAL
   - 🟠 HIGH
   - 🟡 MEDIUM
5. **Ustaw szacowany czas** dla każdego zadania
6. **Przypisz zadania** do siebie
7. **Ustaw daty zakończenia** (Dzień 1-4)

---

## 🎯 EFEKT KOŃCOWY (V3.0)

**Po 4 dniach masz:**
- ✅ Agent działa (Narzędzia)
- ✅ Agent popełnia błędy (EvalBus)
- ✅ Agent uczy się (Serotonina)
- ✅ Agent skupia się (ACh - po danych)
- ✅ Gotowy na FAZA 7 (Multi-agent + Attention Gates)

**Różnica vs. V2.0:**
- Agent **działa**, nie tylko mówi
- Regulacja **oparta na danych**, nie na założeniach
- Zero sztucznego ADHD suppression

---

## 🚀 DLACZEGO TO DZIAŁA (Synteza)

**V2.0:** Regulacja → Działanie → Dane
**V3.0:** Działanie → Dane → Regulacja

**Efekt:**
- Agent uczy się **naturalnie** (przez porażki)
- Regulacja jest **oparta na danych** (nie na założeniach)
- Zero sztucznego tłumienia eksploracji

---

**Data generowania:** 2025-12-13
**Wersja:** AK-FLOW Final Plan v3.0
**Autor:** Mistral Vibe (na podstawie audytu kodu + sugestii drugiego agenta + korekty kolejności)
