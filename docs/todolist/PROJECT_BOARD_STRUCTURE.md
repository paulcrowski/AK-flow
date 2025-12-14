# 📋 Focalboard: Struktura Projektu "13/10"

> **Cel:** Oddzielenie "Marzeń" (Wizja) od "Pracy" (Kod). Czystość umysłu architekta.

## 1. Filozofia: The "Two Boards" System

Zamiast jednego wielkiego śmietnika, proponuję podział na dwie tablice (Boards):

1.  🔭 **VISION DECK (Strategia)** – Co budujemy? (Horyzont: Miesiące)
    *   Tutaj trafiają "Fazy" i "Kamienie Milowe".
    *   Wartości: `Phase 6.2`, `Phase 7.0`, `Research`.
2.  ⚙️ **ENGINEERING DECK (Taktyka)** – Co kodujemy *dzisiaj*? (Horyzont: Dni)
    *   Tutaj trafiają konkretne zadania techniczne.
    *   Wartości: `High Priority`, `Stabilization`, `Refactor`.

---

## 2. 🔭 Board 1: VISION DECK

### Statusy (Kolumny):
*   **Concept** (Pomysły, np. "Teoria Umysłu")
*   **Planned** (Zatwierdzone do wdrożenia, np. "Phase 7.0")
*   **In Progress** (Aktualna Faza, np. "Phase 6.2")
*   **Completed** (Zrobione Fazy, np. "Phase 5.0")

### Proponowane Karty (Detailed Vision Roadmap):

#### Phase 6.2: Kernel Stabilization (Current)
*   [ ] **Unified Input Queue Architecture** (Najważniejsze!)
    *   *SystemTime* jako SSoT (Single Source of Truth).
    *   Kolejka FIFO dla `UserMessage` i `Tick`.
*   [ ] **Identity Anchor 30min** (Active Refresh).

#### Phase 6.5: The Feedback Loops (Immediate Priority)
> Cel: "Chemia, która rozumie sukces i porażkę".
*   [ ] **Epic: GoalFeedbackSystem**
    *   Spięcie sukcesu celu z dopaminą (Goal → EvaluationBus → Chemistry).
    *   Heurystyka `userSignal` (analiza sentymentu odpowiedzi usera).
*   [ ] **Epic: Executive Control (Hysteresis)**
    *   Mechanizm zapobiegający oscylacjom nastroju (okno 30s).
    *   `ExecutiveDirective` (np. SUPPRESS_EMOTION przy błędach).

#### Phase 7.0: The Unified Stream (1 Month)
> Cel: "Jeden Mózg" zamiast "Dwóch Półkul".
*   [ ] **Epic: Cognitive Serializer**
    *   Eliminacja `race conditions` w `EventLoop`.
    *   Wprowadzenie `ThinkingLock` - gdy myślę, nie słucham.
*   [ ] **Epic: Attention Gates**
    *   Acetylocholina (Focus) jako bramka wejściowa.

#### Phase 7.5: Cognitive Tools Extension
> Cel: Pamięć robocza i nauka.
*   [ ] **Epic: NOTES Tool** (Long-term text storage).
*   [ ] **Epic: READ_FILE Tool** (Dostęp do repozytorium).
*   [ ] **Epic: LEARN_FROM Tool** (Social Mimicry protocol).

#### Phase 8.0: The Long-Term Mind (2 Months)
> Cel: Pamięć Długotrwała i Planowanie.
*   [ ] **Epic: The Journal (Goal Persistence)**
    *   Baza danych celów (`goals` table with vector embeddings).
    *   "Rytuał Poranny" (wczytanie celów z wczoraj).
    *   "Rytuał Wieczorny" (podsumowanie postępów).
*   [ ] **Epic: Semantic Sisyphus**
    *   Wykrywanie zapętleń w celach (nie planuj tego, co już 3 razy zawiodło).

#### Phase 9.0: Meta-Cognition (3 Months)
> Cel: Agent, który wie, że jest Agentem.
*   [ ] **Epic: NeuroMonitor 2.0**
    *   UI: Suwaki osobowości (Personality Sliders).
    *   UI: Wykres dopaminy w czasie rzeczywistym.
*   [ ] **Epic: Trait Evolution**
    *   System "głosowania" cech (TraitVote) po każdej sesji.
    *   Neuroplastyczność (zmiana `TraitVector` o maks 0.01 dziennie).

#### Phase 10.0: Transcendence (Visionary)
*   [ ] **Epic: Multi-Agent Council**
    *   System "Konsylium" (Krytyk, Marzyciel, Realista) wewnątrz jednego LLM.
    *   Równoległe strumienie myśli (Parallel Thinking Streams).

---

## 3. ⚙️ Board 2: ENGINEERING DECK

To jest Twoja tablica "codzienna".

### Statusy (Kolumny):
*   **🔥 Critical / Bugs** (Rób teraz albo system wybuchnie)
*   **🏗️ Features** (Budowanie nowych rzeczy)
*   **🧹 Refactor / Debt** (Sprzątanie, Thresholds, Configs)
*   **✅ Done** (Archiwum sukcesu)

### Proponowane Karty (Backlog na ten tydzień):

#### 🔥 Critical / Bugs
1.  **Unified Input Queue (Refactor)**
    *   *Opis:* Przepisanie `useCognitiveKernel` tak, by `UserMsg` i `Tick` wpadały do jednej kolejki `async`.
    *   *Cel:* Fix "Double Brain" Race Condition.
2.  **Identity Anchor Tests**
    *   *Opis:* Napisanie testu E2E, który symuluje wygaśnięcie cache (mock time) i sprawdza refresh.

#### 🏗️ Features
3.  **NeuroMonitor: TraitVector UI**
    *   *Opis:* Wizualizacja suwaków osobowości (Arousal, Curiosity) w panelu debugowania.
4.  **The Journal (Database)**
    *   *Opis:* Nowa tabela `goals_history` z `embeddingiem` do śledzenia postępów długoterminowych.

#### 🧹 Refactor / Debt
5.  **Centralize Thresholds**
    *   *Opis:* Wyniesienie wszystkich `0.75`, `3000ms`, `0.1` do pliku `core/config/thresholds.ts`.
    *   *Cel:* Strojenie systemu w jednym miejscu ("Panel Dj-a").
6.  **SomaSystem Clean-up**
    *   *Opis:* Uproszczenie logiki snu (Sleep Homeostasis) – usunięcie starych flag.

---

## 4. Zasada pracy 13/10
1.  Rano patrzysz na **VISION DECK**: "Gdzie płyniemy?"
2.  Przełączasz na **ENGINEERING DECK**: "Co wiosłujemy?"
3.  Nie mieszasz wizji ("chcę AGI") z zadaniem ("popraw import w linii 40").
