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

### SESJA 3: "Sen i Konsolidacja" – [DO ZROBIENIA]
**Cel:** Prosty tryb snu + mądra konsolidacja pamięci. TraitVector pozostaje statyczny.

#### Krok 1: Sleep Mode v1 (ultra-prosty)
- [ ] **[STATE] isSleeping flag** – kernel wie, że agent śpi.
- [ ] **[BEHAVIOR] Brak odpowiedzi** – Volition zawsze mówi „nie mów" gdy `isSleeping`.
- [ ] **[TRIGGER] Manualny lub energetyczny** – przycisk UI lub `energy < 20`.
- [ ] **[CHEM] Reset do baseline** – dopamina/serotonina/norepinefryna wracają do neutralnych wartości.
- [ ] **[EVENT] SLEEP_START / SLEEP_END** – logi z timestampem i stanem przed/po.

#### Krok 2: DreamConsolidation v1 (bez auto-zmian osobowości)
- [ ] **[RECALL] Top 3-5 epizodów** – `EpisodicMemoryService.recallMostImpactful()`.
- [ ] **[AI] Lekcje dnia** – Cortex generuje 3-5 krótkich lekcji z epizodów.
- [ ] **[GOAL] 1-2 wpisy GoalJournal** – opcjonalne nowe cele na podstawie lekcji.
- [ ] **[SELF] Self-summary** – 1 krótkie podsumowanie „kim jestem po tym dniu" jako core memory.
- [ ] **[PROPOSAL] Propozycja zmian TraitVector** – tylko LOG, bez aplikacji:
  - „Gdybym miał zmienić cechy: curiosity +0.02, arousal −0.01, bo [powód]".

#### Krok 3: Obserwacja i walidacja (Faza 1 ewolucji)
- [ ] **[LOG] trait_evolution_proposals** – tabela/log z propozycjami zmian.
- [ ] **[UI] NeuroMonitor rozszerzenie** – widok propozycji zmian (opcjonalnie).
- [ ] **[TEST] Kilka nocy na różnych agentach** – czy propozycje mają sens?

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
- Automatyczna modyfikacja TraitVector.
- Fazy snu (light/deep/dream) sprzęgnięte z energią.
- Różne „strategie snu" (terapeutyczny/treningowy).

