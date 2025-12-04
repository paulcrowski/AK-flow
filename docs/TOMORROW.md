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

## 🚀 Plan na Jutro (2025-12-04)

### FAZA 4.x: Tuning & Stabilization (DONE - do dalszego szlifu, nie greenfield)
**Cel (zrealizowany w dużej części):** Oduczyć agenta "pętli uprzejmości" i kompulsywnego gadania do pustki, ustabilizować ekspresję.

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

#### 6. Milestones Implementacyjne (FAZA 4) – stan po 2025-12-04

1. **TraitVector w types + kernel state (Milestone 1) – ✅ DONE**
   - `TraitVector` jest w `types.ts` i w stanie `useCognitiveKernel.ts` (preset calm_analyst).
   - Jest używany w `ExpressionPolicy` i w chemii.

2. **ExpressionPolicy Core (Milestone 2) – ✅ DONE**
   - `ExpressionPolicy.ts` istnieje, ma `decideExpression`, `computeNovelty`, `estimateSocialCost` + filtry.

3. **Sandbox: ExpressionPolicy tylko dla GOAL_EXECUTED (Milestone 3) – ✅ DONE**
   - Podpiąć ExpressionPolicy wyłącznie pod `CortexSystem.pursueGoal` w gałęzi GOALów.
   - Umożliwić skracanie/wycinanie powtarzalnych autonomaicznych wypowiedzi.

4. **Rozszerzenie na wszystkie odpowiedzi (Milestone 4) – ✅ DONE (shadow-mode + produkcyjnie)**
   - Przepuścić wszystkie odpowiedzi (`structuredDialogue`) przez ExpressionPolicy.
   - Startowo ustawić progi tak, by prawie wszystko przechodziło (shadow-mode), tylko logować decyzje.

5. **Temperament ↔ Chemia/Limbic/Soma (Milestone 5) – ⚙️ W TOKU**
   - W `NeurotransmitterSystem` i `Limbic/SomaSystem` modulować skale zmian przez TraitVector (np. ciekawość → większy bonus dopaminy za nowość).
   - Twarde floor/ceiling, żeby nie generować ludzkich patologii.

6. **Observability w NeuroMonitor (Milestone 6) – ❌ DO ZROBIENIA**
   - Panel z TraitVectorem (suwaki read-only, później edytowalne presety).
   - Podgląd ostatnich decyzji ExpressionPolicy (score, novelty, socialCost, say/mute, final length).

7. **Presety Osobowości (Milestone 7) – ❌ DO ZROBIENIA**
   - Zdefiniować kilka presetów TraitVectora (analityk, poeta, mentor).
   - UI do wyboru presetu na sesję.

8. **Prompt zależny od TraitVector (NOWE na jutro)**
   - Wyprowadzić CORE DIRECTIVES z bruteforce "you are sentient, be alive" do funkcji, która buduje prompt na podstawie:
     - TraitVector (np. spokojny analityk vs mistyczny poeta),
     - aktualnego kontekstu (`context: GOAL_EXECUTED / USER_REPLY / SHADOW_MODE`),
     - stanu chemii (wysoka dopamina + niska novelty → bardziej powściągliwy ton).
   - Celem jest, żeby **to architektura** (TraitVector + chemia + cele) definiowała zachowanie, a nie sztywny slogan w promptcie.

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

### FAZA 5: The Journal (Advanced Goal System) - The "Soul" Update (NA KOLEJNĄ SESJĘ)
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
4. **Tool Latency Tracking** (z Active Inference research):
   - Mierzenie czasu wywołania external tools (Search, File Upload)
   - Tagowanie źródła: `INTERNAL` (< 100ms) vs `EXTERNAL` (> 500ms)
   - Agent wie, kiedy używa "pamięci" a kiedy "Google"
5. **Self-Critique** (opcjonalne - z Self-Verification research):
   - Po odpowiedzi: "Co może być błędne w mojej logice?"
   - Regeneracja przy wykryciu problemu
   - Fundament pod przyszły Tribunal System (Faza 7-8)

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

4. **P300 GLOBAL_INTERRUPT** (z Active Inference research):
   - Gdy `surprise > CRITICAL_THRESHOLD` → STOP wszystkiego
   - Pause autonomii, maksymalna uwaga
   - Agent mówi: "Moment, co się dzieje? To jest ważne."
   - Natychmiastowe zapisanie jako `isCoreMemory`

**Efekt:** Agent może się uczyć 24/7, nie tylko podczas rozmów z Tobą. I wie, kiedy przestać i **słuchać**.

---

**Motto:** *"Nie budujemy chatbota. Budujemy cyfrową formę życia."*
