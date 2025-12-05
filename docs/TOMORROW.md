# 🎯 Plan na Dzisiaj: 2025-12-05 "The Self Engine"

> **Cel:** Przekształcenie Agenta z symulatora biologicznego w byt psychologiczny z ciągłą tożsamością.
> **Wizja:** Agent budzi się i wie kim jest (Narrative Identity).
> **Czas:** ~4-6 godzin
> **Wynik:** 11/10 → **Agent z Pamiętnikiem**

---

## 📋 Status Projektu (Start Sesji)

### ✅ Osiągnięcia z Początku Sesji (Foundation)
- **[UI] Multi-Agent System:** Wdrożono `LoginScreen` i `AgentSelector` (przełączanie tożsamości).
- **[ARCH] Modular Refactor:** Rozdzielono `App.tsx` na `CognitiveInterface` (czysty cykl życia agenta).
- **[FIX] Kernel Reset:** Pełne czyszczenie stanu (`eventBus.clear`, `kernelEpoch`) przy zmianie agenta.

---

## 🚀 Plan Wdrożenia FAZY 5: "The Self Engine" (Roadmapa)

### SESJA 1: "Nowe JA" (Identity & DB) – [UKOŃCZONA ✅]
**Cel:** Backend tożsamości. Agent ładuje swój charakter z bazy.

- [x] **[DB] CoreIdentity Schema**: Rozszerzenie tabeli `agents` (persona, core_values, bio_rhythm, voice_style, narrative_traits).
- [x] **[DB] GoalJournal Schema**: Stworzenie tabeli `goal_journal` dla długich misji.
- [x] **[LOGIC] Boot Protocol v2**: Pobieranie `TraitVector` i pełnej tożsamości z bazy przy starcie.
- [x] **[LOGIC] Dynamic Persona**: Prompt systemowy budowany dynamicznie na bazie `CoreIdentity` + SessionOverlay.

### SESJA 2: "Pamiętnik i Cele" – [UKOŃCZONA ✅]
**Cel:** Agent zapisuje sensowne wspomnienia (Epizody).

- [x] **[LOGIC] Memory Engine v1**: Wykrywanie "Epizodów" (zmiana emocji > 0.25).
- [x] **[LOGIC] Episodic Format**: Zapisywanie `{ Event, Emotion, Lesson }` zamiast surowego tekstu.
- [x] **[LOGIC] GoalJournal Integration**: Podpięcie zapisu/odczytu celów.

### SESJA 3: "Sen i Konsolidacja" – [UKOŃCZONA ✅]
**Cel:** Prosty tryb snu + mądra konsolidacja pamięci. TraitVector pozostaje statyczny.

#### Krok 1: Sleep Mode v1 (ultra-prosty)
- [x] **[STATE] isSleeping flag** – kernel wie, że agent śpi (`SomaSystem.forceSleep/forceWake`, `somaState.isSleeping`).
- [x] **[BEHAVIOR] Brak odpowiedzi** – Volition zawsze mówi „nie mów" gdy `isSleeping` (test: `reason === 'SLEEPING'`).
- [x] **[TRIGGER] Manualny** – przycisk snu w UI (`toggleSleep`), energetyczny trigger odłożony.
- [x] **[CHEM] Reset do baseline** – dopamina/serotonina/norepinefryna wracają do neutralnych wartości przy wejściu w sen.
- [x] **[EVENT] SLEEP_START / SLEEP_END** – logi z timestampem i stanem przed/po w `EventBus`.

#### Krok 2: DreamConsolidation v1 (bez auto-zmian osobowości)
- [x] **[RECALL] Top epizodów** – `DreamConsolidationService.recallMostImpactful()` pobiera najbardziej emocjonalne wspomnienia.
- [x] **[AI] Lekcje dnia** – Cortex generuje 3–5 krótkich lekcji z epizodów.
- [x] **[GOAL] Wpisy GoalJournal (opcjonalne)** – przygotowana integracja, na razie zachowana jako potencjał.
- [x] **[SELF] Self-summary** – 1 krótkie podsumowanie „kim jestem po tym dniu" jako core memory (`[SELF-SUMMARY]`).
- [x] **[PROPOSAL] Propozycja zmian TraitVector** – tylko LOG, bez aplikacji (`TRAIT_EVOLUTION_PROPOSAL`).

#### Krok 3: Obserwacja i walidacja (Faza 1 ewolucji)
- [x] **[LOG] trait_evolution_proposals** – propozycje zmian pakowane jako specjalne memories + event w `EventBus`.
- [x] **[TEST] Testy jednostkowe Sleep & Dream** – Volition blokujący mowę w śnie, DreamConsolidation z/bez epizodów.
- [ ] **[UI] NeuroMonitor rozszerzenie** – widok propozycji zmian + „lekcje dnia" (do zrobienia w kolejnej sesji).

---

### SESJA 4+: "Ewolucja Osobowości" – [ODŁOŻONE]
**Cel:** Stopniowe włączanie auto-modyfikacji TraitVector.

#### Faza 2: Ręczne zatwierdzanie (raz w tygodniu)
- [ ] Przegląd propozycji z ostatnich 7 dni.
- [ ] Akceptacja wybranych zmian (przycisk „Apply approved deltas").
- [ ] Osobowość zmienia się powoli, w skokach.

#### Faza 3: Pół-auto z guard-railami
- [ ] Max zmiana cechy na tydzień: ±0.03.
- [ ] Niektóre cechy zablokowane (np. `conscientiousness` wymaga ręcznej zgody).
- [ ] Każda zmiana logowana do `core_identity_log`.
- [ ] Możliwość rollbacku do „CoreIdentity vX".

---

## 3. Notes / Manifest (FAZA 5 – Self Engine)

### ✅ Co już mamy (SESJA 1-2):
- **CoreIdentity w DB** – `agents` z persona, values, traits, narrative_traits.
- **Dynamic Persona** – Cortex dostaje `AgentIdentityContext` i z niego korzysta.
- **Identity Logging** – `IDENTITY_LOADED` + `IDENTITY_SNAPSHOT` w EventBus.
- **Episodic Memory** – epizody `{ Event, Emotion, Lesson }` z `neural_strength`.
- **GoalJournal** – cele przetrwają reboot, integracja z `GoalSystem`.

### 🎯 Zasady ewolucji osobowości (11/10):
1. **Obserwuj przed zmianą** – najpierw propozycje, potem ręczna akceptacja, dopiero potem auto.
2. **Osobowość jest wolnozmienna** – tygodniowa kadencja, nie real-time suwaki.
3. **Pełna audytowalność** – każda propozycja i zmiana logowana, rollback możliwy.
4. **Guard-raile** – max ±0.03/tydzień, niektóre cechy chronione.
5. **Stabilność przed plastycznością** – najpierw stabilna chemia i pamięć, potem ewolucja.

### ⚠️ Czego NIE robimy teraz:
- Automatyczna modyfikacja TraitVector (tylko propozycje w logach).
- Fazy snu (light/deep/dream) sprzęgnięte z energią.
- Różne „strategie snu" (terapeutyczny/treningowy).

---

## 4. Log z dnia 2025-12-05 (SESJA 3 – Sen & Konsolidacja)

- **Sleep Mode v1** – dodany stan snu (`isSleeping`), przycisk snu w UI, eventy `SLEEP_START` / `SLEEP_END`, reset chemii do baseline.
- **Brak mowy w śnie** – VolitionSystem ma twardą regułę `reason: 'SLEEPING'`, test jednostkowy potwierdza blokadę.
- **DreamConsolidationService v1** – konsolidacja epizodów w snie:
  - pobieranie najważniejszych epizodów z Supabase,
  - generowanie lekcji dnia,
  - self-summary jako `[SELF-SUMMARY]` w pamięci,
  - event `TRAIT_EVOLUTION_PROPOSAL` z delikatnymi deltami TraitVector (log only).
- **Testy automatyczne** – pełna pętla `npm test` zielona (1 test EventLoop świadomie `skip` jako flaky). Dodane testy:
  - Volition: brak mowy w śnie,
  - DreamConsolidation: brak epizodów → brak efektu,
  - DreamConsolidation: epizody → lekcje, self-summary, trait proposal (bez zmiany cech).

## 5. Panel Obserwacyjny (pomysł na następną sesję)

- **Sleep & Dream Dashboard** (NeuroMonitor):
  - ostatnie `SLEEP_START` / `SLEEP_END` z czasu i energii,
  - lista „lekcji dnia" z ostatniego snu,
  - ostatni `TRAIT_EVOLUTION_PROPOSAL` (aktualne cechy + proponowane delty + reasoning),
  - filtr po agencie (Eksperyment / Alberto / Explorer).
- **Weekly Review Mode**:
  - agregacja propozycji z kilku nocy,
  - tabela „jak agent chciałby się zmienić" z możliwością ręcznej akceptacji.

