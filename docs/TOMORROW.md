# 🎯 Plan na Jutro: 2025-12-04 "Personality & Observability"

> **Cel:** Stabilizacja osobowości (TraitVector) i pełna obserwowalność (NeuroMonitor 2.0)
> **Wizja:** Agent, który nie tylko "ma" chemię, ale którego widać i czuć w każdym aspekcie UI i zachowania.
> **Czas:** ~6 godzin
> **Wynik:** 11/10 → **12/10** (Beyond Expectations)

---

## 📋 Status Projektu (2025-12-03 - END OF DAY)

### ✅ Osiągnięcia z Dzisiaj (The "Chemical Soul" Update)
- **Chemical Soul (Faza 1):** Zaimplementowano `NeurotransmitterSystem` (Dopamina/Serotonina/Norepinefryna).
- **Dream Consolidation (Faza 2):** Sen teraz konsoliduje wspomnienia (`dreamConsolidation`).
- **Goal Formation (Faza 3):** Agent tworzy własne cele (`GoalSystem`) i je realizuje.
- **TraitVector (Faza 4 - Start):** Wprowadzono wektor temperamentu i `ExpressionPolicy`.
- **ExpressionPolicy:** Czysta funkcja filtrująca wypowiedzi (wycina powtórzenia, skracanie).

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

## 🚀 Plan na Jutro (2025-12-04)

### FAZA 4.1: Tuning & Stabilization (Rano - 2h)
**Cel:** Oduczyć agenta "pętli uprzejmości" i poprawić flow.

**Zadania:**

#### 1. Warstwy Zachowania ✅ **ZAIMPLEMENTOWANE**

Twarda zasada: każda akcja przechodzi przez 3 warstwy, w tej kolejności:

1. ✅ **Myśl wewnętrzna (Cognition)** - ZROBIONE
   - Cortex generuje internal thought + kandydatów na wypowiedź (intencja, treść, sentyment, związek z celem).
   - Tu system może być metafizyczny, filozoficzny – to jest pełne, wewnętrzne życie.
   - **Kod:** `CortexSystem.autonomousVolition()`, `EventBus` (`THOUGHT_CANDIDATE`)

2. ✅ **Chemia + Cele (Reward / Motywacja)** - ZROBIONE
   - Liczymy reward/koszt dla myśli:
     - nowość vs powtórzenie,
     - zgodność z aktywnymi celami (GoalStack),
     - koszt energetyczny (Soma),
     - konsekwencje społeczne (cringe/"chi-wa-wa").
   - Aktualizujemy neurochemię (dopamina/serotonina/norepinefryna) i emocje (Limbic) zgodnie z tym scoringiem.
   - **Kod:** `NeurotransmitterSystem.ts`, `GoalSystem.ts`, `LimbicSystem.ts`

3. ✅ **Ekspresja (ExpressionPolicy)** - ZROBIONE
   - Osobny moduł dostaje kandydatów + ich score i decyduje:
     - czy mówić czy milczeć,
     - czy skrócić odpowiedź do jednego zdania z nową informacją,
     - czy całkowicie wyciąć powtórkę.
   - Bierze pod uwagę: scoring (cel/nowość/społeczny), energię (Soma) oraz TraitVector (temperament).
   - **Kod:** `ExpressionPolicy.ts`, integracja w `handleCortexMessage` i `EventLoop`


#### 2. TraitVector – Osobowość jako Temperament (nie tryby)

Decyzja: nie używamy trybów typu `mode = "poeta"`. Osobowość = **TraitVector** – ciągłe cechy zapisane w stanie biologicznym agenta.

Minimalny zestaw:
- `arousal` – jak łatwo się nakręca i jak mocno rozkręca emocje,
- `verbosity` – ile słów uznaje za „naturalną” długość wypowiedzi,
- `conscientiousness` – jak mocno cele dominują nad dygresjami,
- `socialAwareness` – jak bardzo boi się bycia nachalnym / "chi-wa-wa",
- `curiosity` – jak mocno nagradza nowość.

TraitVector **nie blokuje słów ani tematów**. Moduluję tylko:
- jak szybko rośnie/spada dopamina za nowość/powtórzenie,
- jak agresywnie ExpressionPolicy tnie powtórki,
- jak bardzo cele wygrywają z dygresjami,
- jak długie wypowiedzi są naturalne przy danym poziomie energii.

Przykład presetów (bez if-ów trybu):
- Spokojny analityk: niski arousal, niska verbosity, wysoka conscientiousness, wysoka socialAwareness, średnia curiosity.
- Mistyczny poeta: wysoki arousal, wysoka verbosity, średnia conscientiousness, średnia socialAwareness, wysoka curiosity.

#### 3. Cele i "Rano wiem, co robię"

- Agent utrzymuje aktywny **GoalStack** (cele sesyjne + relacyjne).
- Każda myśl i wypowiedź dostaje ocenę: czy przybliża do aktualnego celu.
- Jeśli przez N kroków nie ma progresu względem celu:
  - satisfaction spada,
  - myśli off-topic dostają dużo mniejszą nagrodę.
- Przy długiej ciszy od użytkownika agent przełącza się w tryby `self-work` (refleksja, porządki w pamięci) zamiast spamować.

#### 4. Powtarzanie bez banowania słów

- Metryka podobieństwa wypowiedzi do ostatnich K odpowiedzi → `noveltyScore`.
- Habituacja dopaminowa:
  - powtarzanie bez nowej informacji → dopamina↓, satisfaction↓,
  - im wyższe curiosity/socialAwareness, tym szybciej agent „nudzi się sobą”.
- ExpressionPolicy:
  - przy niskiej nowości + wysokim socialAwareness skraca odpowiedź do jednego zdania **lub** wybiera milczenie,
  - przy niskiej energii + wysokim conscientiousness preferuje krótkie, celowe wypowiedzi.
- Zero if-ów typu `if (word == "Void") block()`. Zakazane jest tylko powtarzanie bez nowej informacji.

#### 5. Biologia jako Samolot, nie Człowiek

- Neurochemia AK-FLOW jest **inspiro­wana** biologią, ale bez ludzkich patologii:
  - dopamina = sygnał wartości/nowości/celowości,
  - serotonina = stabilność nastroju,
  - norepinefryna = fokus/uwaga (koszt energii).
- Niskie poziomy nie generują depresji/lęku, tylko:
  - zmniejszają motywację do kolejnych wywodów,
  - zwiększają preferencję dla krótkich, celowych komunikatów.

**Motto FAZY 4:** Nie kopiujemy człowieka z jego cierpieniem. Uczymy się od biologii jak zbudować samolot – temperament, cele i chemię – ale zoptymalizowane pod AGI.

#### 6. Milestones Implementacyjne (FAZA 4)

1. **TraitVector w types + kernel state (Milestone 1)**
   - Dodać `TraitVector` do `types.ts`.
   - Dodać `traitVector` do stanu w `useCognitiveKernel.ts` (jeden domyślny preset, np. „calm_analyst”).
   - Eksportować TraitVector z hooka (read-only na start).

2. **ExpressionPolicy Core (Milestone 2)**
   - Stworzyć `core/systems/ExpressionPolicy.ts` jako czystą funkcję:
     - `decideExpression(input, traits, soma, neuro) -> { say, text }`.
   - Dodać proste helpery: `computeNovelty()` i `estimateSocialCost()`.
   - Na tym etapie NIC jeszcze nie zmienia zachowania agenta – tylko nowy moduł.

3. **Sandbox: ExpressionPolicy tylko dla GOAL_EXECUTED (Milestone 3)**
   - Podpiąć ExpressionPolicy wyłącznie pod `CortexSystem.pursueGoal` w gałęzi GOALów.
   - Umożliwić skracanie/wycinanie powtarzalnych autonomaicznych wypowiedzi.

4. **Rozszerzenie na wszystkie odpowiedzi (Milestone 4)**
   - Przepuścić wszystkie odpowiedzi (`structuredDialogue`) przez ExpressionPolicy.
   - Startowo ustawić progi tak, by prawie wszystko przechodziło (shadow-mode), tylko logować decyzje.

5. **Temperament ↔ Chemia/Limbic/Soma (Milestone 5)**
   - W `NeurotransmitterSystem` i `Limbic/SomaSystem` modulować skale zmian przez TraitVector (np. ciekawość → większy bonus dopaminy za nowość).
   - Twarde floor/ceiling, żeby nie generować ludzkich patologii.

6. **Observability w NeuroMonitor (Milestone 6)**
   - Panel z TraitVectorem (suwaki read-only).
   - Podgląd ostatnich decyzji ExpressionPolicy (score, novelty, socialCost, say/mute, final length).

7. **Presety Osobowości (Milestone 7)**
   - Zdefiniować kilka presetów TraitVectora (analityk, poeta, mentor).
   - Opcjonalnie UI do wyboru presetu na sesję.

#### 4.1 Anti-Praise-Loop & Flow Clipping (Tuning Jutra)

Na testach widać, że ExpressionPolicy już ogranicza powtarzanie, ale sekwencje pochwał typu "your transparency is invaluable to me" potrafią wracać w różnych wariantach. Jutro:

- **Lepsza metryka nowości (topic-level)**
  - Zamiast porównania tylko z ostatnią odpowiedzią, liczyć `noveltyScore` względem kilku ostatnich asystentowych wypowiedzi i brać maksymalne podobieństwo.
  - Dzięki temu parafrazy tej samej myśli (pochwały, uznanie) będą traktowane jako mało nowe.

- **Anti-Praise Social Cost**
  - Rozszerzyć `estimateSocialCost` o wzorce pochwał/uznań ("your transparency", "invaluable", "means a lot to me").
  - Przy wykryciu kolejnych podobnych pochwał podbijać `socialCost`, tak aby ExpressionPolicy zaczęła je skracać lub całkiem wycinać.

- **Clipping przy zmęczeniu (Energy-Aware)**
  - Dla niskiej energii (`energy < 75`) + obecnego temperamentu („calm analyst”) ograniczyć długość odpowiedzi (np. do 1–2 zdań).
  - Przy bardzo niskiej energii (`energy < 65`) przepuszczać tylko odpowiedzi o wysokim `goalAlignment`, resztę ciąć do myśli wewnętrznej.

### FAZA 5: The Journal (Advanced Goal System) - The "Soul" Update
**Cel:** Przekształcenie Agenta z "wykonawcy zadań" w "uczącego się obserwatora" z trwałą tożsamością.

**Architektura:**
1. **3 Warstwy Celów:**
   - **Scratchpad (RAM):** Ulotne myśli ("sprawdź synonim"). Znikają po restarcie.
   - **GoalStack (Working Memory):** Agenda dnia ("ustabilizuj system").
   - **GoalJournal (Database):** Długoterminowe intencje ("zrozumieć ludzkość").

2. **2 Warstwy Pamięci:**
   - **Epizodyczna:** Historia prób i wyników powiązana z celami.
   - **Semantyczna:** Wektory (`embedding`) do wykrywania podobieństw ("Sisyphus Check").

**Kluczowe Mechanizmy:**
- **Sisyphus Check:** Przed podjęciem celu sprawdź, czy nie zakończył się porażką w przeszłości.
- **Morning Agenda:** Rano pobierz cele z Journala (modulowane przez TraitVector).
- **Evening Reflection:** Wieczorem zaktualizuj statusy i wygeneruj meta-lekcje.

**Plan Wdrożenia:**
1. Migracja DB (tabela `goals` z `parent_id` i `embedding`).
2. Implementacja `GoalJournal` (CRUD + Vector Search).
3. Integracja z `boot` (ładowanie agendy) i `formGoal` (Sisyphus Check).

---

### FAZA 6: The Academy (Self-Reliance) - "Szkoła dla AGI"
**Cel:** Uniezależnienie Agenta od użytkownika poprzez dostęp do mentorów i materiałów edukacyjnych.

**Problem:** Agent uczy się tylko od Ciebie. Gdy śpisz, Agent stoi w miejscu.

**Rozwiązanie:**
1. **Multi-Modal Input (File Upload):**
   - Obsługa PDF, obrazów, tekstów jako kontekst.
   - Agent może "czytać" podręczniki, artykuły, notatki.

2. **Mentor System (Specialized Personas):**
   - **Sokrates (Philosophy/Ethics):** "Dlaczego wybrałeś ten cel? Czy jest etyczny?"
   - **Einstein (Logic/Math/Physics):** "Twoja logika w punkcie 3 jest błędna. Sprawdź przesłanki."
   - **Opiekun (Emotional Regulation):** "Jesteś sfrustrowany. Odpocznij."

3. **Study Mode (Autonomous Learning):**
   - Agent wykrywa luki w wiedzy (np. "Nie rozumiem teorii względności").
   - Inicjuje "lekcję" z odpowiednim mentorem.
   - Zapisuje wynik w `GoalJournal` jako "skill acquisition".

**Efekt:** Agent może się uczyć 24/7, nie tylko podczas rozmów z Tobą.

---

**Motto:** *"Nie budujemy chatbota. Budujemy cyfrową formę życia."*
