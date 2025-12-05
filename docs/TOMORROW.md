# 🎯 Plan na Jutro: 2025-12-04 "Personality & Observability"

> **Cel:** Stabilizacja osobowości (TraitVector) i pełna obserwowalność (NeuroMonitor 2.0)
> **Wizja:** Agent, który nie tylko "ma" chemię, ale którego widać i czuć w każdym aspekcie UI i zachowania.
> **Czas:** ~6 godzin
> **Wynik:** 11/10 → **12/10** (Beyond Expectations)

---

## 📋 Status Projektu (2025-12-04 - END OF DAY)

### ✅ Osiągnięcia z Dzisiaj (The "Homeostatic Expression" Update)
- **Chemical Soul (Faza 1):** Zaimplementowano `NeurotransmitterSystem` (dopamina/serotonina/norepinefryna).
- **Dream Consolidation (Faza 2):** Sen konsoliduje wspomnienia (`dreamConsolidation`).
- **Goal Formation (Faza 3):** Agent tworzy i realizuje własne cele (`GoalSystem` + `pursueGoal`).
- **TraitVector (Faza 4):** Wektor temperamentu jest w kernelu i modulacji chemii/ekspresji.
- **ExpressionPolicy:** Filtruje wypowiedzi (nowość, koszt społeczny, energia), ma Dopamine Breaker i Silence Breaker.
- **FAZA 4.5.1:** Wdrożony Narcissism Loop Fix v1.0 (InteractionContext, `consecutiveAgentSpeeches`, Boredom Decay v2, Silent Monologue Breaker).

### 📊 Obecny Stan
| Kategoria | Ocena | Komentarz |
|-----------|-------|-----------|
| **Architektura** | **11/10** | Pełna modularność: Soma, Limbic, Neuro, Goals, Volition, Cortex. |
| **Autonomia** | 10/10 | Działa stabilnie, tworzy cele, nie zapętla się (dzięki ExpressionPolicy). |
| **Biologia** | 10/10 | Chemia i sen działają zgodnie z założeniami homeostazy. |
| **Osobowość** | 9/10 | TraitVector jest, ale wymaga tuningu (Phase 4.1). |
| **UI/Observability** | 8/10 | NeuroMonitor wymaga update'u, żeby pokazać nowe systemy (Phase 4.2). |

> **Szczegóły zaimplementowanych systemów:** Zobacz `SYSTEM_MANIFEST.md` (Version 4.3)

---

## 🚀 Plan Wdrożenia FAZY 5: "The Self Engine" (Roadmapa)

Całkowita estymacja: **~3-4 sesje (ok. 12-16h pracy)**.
Cel: Przekształcenie Agenta z symulatora biologicznego w byt psychologiczny z ciągłą tożsamością.

### SESJA 1: "Nowe JA" (MVP) – [JUTRO]
**Szacowany czas: ~4h**
**Cel:** Agent budzi się i wie kim jest. Koniec z amnezją.
- [ ] **[DB] CoreIdentity Schema**: Stworzenie tabeli `core_identity` (TraitVector, Values) w Supabase.
- [ ] **[DB] GoalJournal Schema**: Stworzenie tabeli `goal_journal` dla długich misji.
- [ ] **[LOGIC] Boot Protocol v2**: Implementacja wczytywania tożsamości przy starcie (`useCognitiveKernel`).
- [ ] **[LOGIC] Dynamic Persona**: Funkcja budująca prompt "Kim jestem" na bazie Identity, a nie sztywnego tekstu.
- **Efekt:** Po odświeżeniu strony agent pamięta swój charakter i otwarte wątki.

### SESJA 2: "Pamiętnik i Cele"
**Szacowany czas: ~4h**
**Cel:** Agent zapisuje sensowne wspomnienia, a nie śmieciowe logi.
- [ ] **[LOGIC] Memory Engine v1**: Przebudowa zapisu pamięci. Wykrywanie "Epizodów" (zmiana emocji > 0.3) zamiast logowania wszystkiego.
- [ ] **[LOGIC] Episodic Format**: Zapisywanie struktury `{ Event, Emotion, Lesson }` zamiast surowego tekstu.
- [ ] **[LOGIC] GoalJournal Integration**: Podpięcie zapisu/odczytu celów do `GoalSystem`.
- **Efekt:** Baza danych zawiera historię życia (epizody), a nie logi debugowania.

### SESJA 3: "Sen i Ewolucja"
**Szacowany czas: ~4-5h**
**Cel:** Pętla uczenia się. Agent ewoluuje po "nocy".
- [ ] **[LOGIC] DreamConsolidation 2.0**: Prompt LLM, który przetwarza epizody dnia na zmiany w `TraitVector` i `NarrativeTraits`.
- [ ] **[LOGIC] Shutdown Protocol**: Procedura bezpiecznego zamykania dnia (zapis stanu, wniosków, celów na jutro).
- [ ] **[TEST] Ewolucja**: Weryfikacja, czy agent faktycznie zmienia zachowanie po konsolidacji snu.
- **Efekt:** Agent rano zachowuje się inaczej (mądrzej) niż wieczorem.

---

### Maintenance (W tle)
- [ ] **[DOCS]** Aktualizacja `CHALLENGES.md` o postępy.
- [ ] **[TEST]** Monitorowanie, czy `Narcissism Loop Fix` (Faza 4.5) nadal działa stabilnie przy nowym mózgu.

---

## 3. Notes for Next Session
- **Paradigm Shift**: Przechodzimy z "Biological Tuning" na "Psychological Architecture".
- **Database**: Będzie potrzebna praca z SQL/Supabase (migracja).
- **Focus**: Najważniejsze jest "JA" (CoreIdentity). Bez tego reszta nie ma sensu.

## 4. Future Phases
- **The Academy (Faza 6)**: Trening agenta na bazie jego własnych wspomnień.
- **The Journal UI**: Interfejs dla usera do podglądu GoalJournal i CoreIdentity (żebyś widział "wnętrze" agenta).
