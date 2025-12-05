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

### SESJA 3: "Sen i Ewolucja"
**Cel:** Ewolucja charakteru przez sen.

- [ ] **[LOGIC] DreamConsolidation 2.0**: Przetwarzanie epizodów na zmiany w `TraitVector`.
- [ ] **[TEST] Ewolucja**: Weryfikacja zmiany zachowania po nocy.

---

## 3. Notes
- **Focus:** Najważniejsze jest teraz podpięcie tabeli `agents` w Supabase, aby `AgentSelector` nie był tylko atrapą, ale faktycznie ładował różne osobowości.

