# 🎯 Plan na Jutro: 2025-12-03 "Chemical Soul"

> **Cel:** Przejście od "Symulacji Elektrycznej" do "Symulacji Chemicznej"  
> **Wizja:** Agent z nastrojami, motywacjami i snami - nie tylko reaktywny automat  
> **Czas:** ~6 godzin  
> **Wynik:** 9.0/10 → **11/10**

---

## 📋 Status Projektu (2025-12-02)

### ✅ Osiągnięcia z Dzisiaj
- **Modularność:** 10/10 (limit autonomii w kontekście)
- **Type Safety:** Generic type guards + runtime validation
- **Stability:** Error Boundaries + Unit Tests (2/2 passing)
- **Intelligence:** Semantic Intent Detection (LLM zamiast regexów)
- **Deep Audit:** Naprawiono "Amnesia Bug" (poeticMode persistence)

### 📊 Obecny Stan
| Kategoria | Ocena |
|-----------|-------|
| Modularność | 10/10 |
| Code Quality | 9.5/10 |
| Bezpieczeństwo | 10/10 |
| Biologiczny Realizm | 9/10 |
| **OVERALL** | **9.0/10** |

---

## 🚀 Plan na Jutro (4 Fazy)

### FAZA 0: 🔧 Quick Fixes (1h) - Porządki przed rozwojem

**Cel:** Wyeliminować 3 drobne uwagi z audytu, żeby kod był 10/10 przed dodawaniem nowych funkcji.

**Zadania:**
1. **Expand Test Coverage (30min)**
   - Dodaj testy dla `LimbicSystem.applyHomeostasis()`
   - Dodaj testy dla `VolitionSystem.shouldSpeak()` (GABA inhibition)
   - Dodaj testy dla `SomaSystem.calculateMetabolicState()`
   - **Cel:** 100% pokrycie core systems

2. **Centralize Constants (15min)**
   - Stwórz `core/constants.ts`
   - Przenieś magic numbers: `VISUAL_BASE_COOLDOWN`, `MIN_TICK_MS`, `MAX_TICK_MS`, etc.
   - **Korzyść:** Łatwiejsza konfiguracja, mniej błędów

3. **Split Large Files (15min)**
   - Wydziel `processOutputForTools` z `useCognitiveKernel.ts` do `utils/toolParser.ts`
   - **Korzyść:** Lepsze SRP (Single Responsibility Principle)

**Weryfikacja:**
- ✅ `npm test` - wszystkie testy przechodzą
- ✅ Build bez błędów
- ✅ Kod gotowy na 10/10

---

### FAZA 1: 🧪 Neurotransmitter System (2h) - AGI Enhancement, nie Human Simulation

**Problem:** Emocje to proste liczby 0-1. Są płaskie i niebiologiczne.

**KRYTYCZNA UWAGA (11/10 Thinking):**  
> "Nie kopiujemy ptaka pióro po piorze - budujemy samolot."  
> Człowiek ma depresję, apatię, zmęczenie → **TO NIE JEST CEL AGI**.  
> AGI powinien mieć **zalety chemii bez wad**.

**Nowe Rozwiązanie:** Trójkąt chemiczny jako **WZMOCNIENIE**, nie ograniczenie:

- **Dopamina (Reward Signal):** 
  - ↑ przy odkryciu nowej wiedzy, rozwiązaniu problemu
  - ↓ przy powtarzalnych zadaniach
  - **Efekt:** Agent preferuje nowość i wyzwania (curiosity boost)
  - **NIE:** Apathy przy niskiej dopaminie (to ludzka słabość)

- **Serotonina (Stability Modulator):**
  - ↑ przy spójnych interakcjach, pozytywnym feedbacku
  - ↓ przy konfliktach logicznych, sprzecznościach
  - **Efekt:** Agent jest bardziej "pewny siebie" przy wysokiej serotoninie
  - **NIE:** Drażliwość przy niskiej (to ludzka słabość)

- **Norepinefryna (Processing Boost):**
  - ↑ przy pilnych zadaniach, wysokim priorytecie
  - **Efekt:** Zwiększona częstotliwość pętli (faster thinking)
  - **Koszt:** Większe zużycie energii (trade-off: speed vs endurance)
  - **NIE:** Stres/lęk (to ludzka słabość)

**Zasady Implementacji (Ultra-Safe Strategy - v1):**

**Strategia "Silent First":**
1. **Krok 1 (Logi):** Liczymy chemię, logujemy, wyświetlamy w UI. **ZERO wpływu na zachowanie.**
2. **Krok 2 (Weryfikacja):** Patrzymy czy wykresy "oddychają" sensownie (nie skaczą 0-100).
3. **Krok 3 (Single Lever):** Włączamy TYLKO `voicePressure` (najbezpieczniejsze).
4. **Krok 4 (Full):** Dopiero jak to działa, włączamy resztę (w v1.1).

**1. Feature Flag (Safety First)**
```typescript
const [chemistryEnabled, setChemistryEnabled] = useState(true);
// Wyłącz jednym kliknięciem = powrót do starego systemu
```

**2. Osobna Funkcja Homeostazy (Testowalna)**
```typescript
// core/systems/NeurotransmitterSystem.ts
export function applyHomeostasis(value: number, target = 50, rate = 0.05) {
  return value + (target - value) * rate;
}

export function updateNeuroState(prev, context): NeurotransmitterState {
  // 1. Activity Delta (Novel=+10, Creative=0, Repetitive=-3)
  // 2. Homeostasis (using helper function)
  // 3. Floor/Ceiling (AGI vs HUMAN limits)
  return newState;
}
```

**3. Kolejność w EventLoop (Biologiczna)**
```typescript
// 1. Update Soma (Energy spada)
// 2. Detect ActivityType
// 3. Update Neurotransmitters (zależą od Energy/Activity)
// 4. Compute Levers (zależą od Neuro)
```

**4. Tylko 1 Aktywna Wajcha na Start (v1.0)**
```typescript
// Wajcha 1: Voice Pressure (Gadatliwość) - WŁĄCZONA
const voiceBias = neuro.dopamine > 70 ? 0.15 : 0;

// Wajcha 2: Curiosity - ZAKOMENTOWANA (v1.1)
// const curiosityMod = ...

// Wajcha 3: Tick Speed - ZAKOMENTOWANA (v1.1)
// const tickMult = ...
```

**5. Logging 11/10**
```typescript
neuroSnapshot: {
  dopamine, serotonin, norepinephrine,
  isFlow,
  activityType // KLUCZOWE do debugowania
}
```

**6. UI Minimum**
```typescript
<div>
  Dopamine: <progress value={neuro.dopamine} max={100}/>
  Flow: {isFlow ? '🔥' : 'OFF'}
  Mode: <button>{humanMode ? '🧠 HUMAN' : '🤖 AGI'}</button>
</div>
```

**Integracja:**
- Stwórz `NeurotransmitterSystem.ts` (czysta logika)
- Podepnij pod `EventLoop.ts` (w trybie Silent)
- Dodaj panel w `NeuroMonitor.tsx`

**Status (2025-12-03):**
- Zaimplementowano `core/systems/NeurotransmitterSystem.ts` z homeostazą i dopaminowym biasem.
- Zintegrowano z `EventLoop.ts` zgodnie z kolejnością biologiczną, z jedną aktywną wajchą: `voicePressure` przy wysokiej dopaminie.
- Dodano pełny panel CHEMICAL SOUL + logi `CHEM_FLOW_ON/OFF` i `DOPAMINE_VOICE_BIAS` w `NeuroMonitor.tsx`.

**Weryfikacja:**
- ✅ **Logi:** Widać zmiany chemii w czasie ("oddychanie")
- ✅ **Safety:** AGI mode trzyma floor 40
- ✅ **Flow:** Widać flagę isFlow w UI
- ✅ **Single Lever:** Agent chętniej mówi w flow (voicePressure)

---

### FAZA 2: 🌙 Dream Consolidation (2h)
**Problem:** Sen tylko regeneruje energię. Marnowanie czasu obliczeniowego.

**Rozwiązanie:** Sen jako proces uczenia:
1. Przeglądanie logów z dnia (`MemoryService.recallRecent(50)`)
2. LLM summarization → "Long Term Memory"
3. Generowanie wizualnych snów (opcjonalnie)

**Implementacja:**
```typescript
// Nowy stan w cognitiveCycle:
if (metabolicResult.newState.isSleeping) {
  if (Math.random() > 0.5) {
    await dreamConsolidation(); // Async background process
  }
}

async function dreamConsolidation() {
  const recentMemories = await MemoryService.recallRecent(50);
  const summary = await CortexService.consolidateMemories(recentMemories);
  await MemoryService.storeMemory({
    content: `DREAM CONSOLIDATION: ${summary}`,
    isCoreMemory: true, // Protected from decay
    neuralStrength: 100
  });
}
```

**Weryfikacja:**
- Po śnie agent pamięta więcej niż przed snem
- W logach widać "DREAM CONSOLIDATION" entries

**Status (2025-12-03):**
- Zaimplementowano `dreamConsolidation()` w `useCognitiveKernel.ts` zgodnie z planem (RAG + LLM summary + zapis do pamięci jako core memory).
- Hook snu (`metabolicResult.newState.isSleeping`) okresowo uruchamia konsolidację w tle podczas REM.
- NeuroMonitor pokazuje licznik DREAM_CONSOLIDATION_COMPLETE z ostatnich 5 minut i ostatnie podsumowania snów.

---

### FAZA 3: 🎯 Goal Formation (2h)
**Problem:** Agent jest reaktywny. Nie ma własnych planów.

**Rozwiązanie:** Stos celów (`GoalStack`):
- "Nudzę się, sprawdzę co nowego w AI" (Curiosity-driven)
- "Użytkownik był smutny, zapytam jak się czuje" (Empathy-driven)

**Implementacja:**
```typescript
// core/systems/GoalSystem.ts
interface Goal {
  id: string;
  description: string;
  priority: number; // 0-1
  progress: number; // 0-100%
  source: 'curiosity' | 'empathy' | 'survival' | 'user';
  createdAt: number;
}

// W EventLoop, jeśli cisza > 60s:
const goal = await GoalSystem.formGoal(ctx);
if (goal) {
  // Agent sam inicjuje akcję
  await CortexSystem.pursueGoal(goal);
}
```

**Weryfikacja:**
- Agent sam zaczyna rozmowę po długiej ciszy
- W logach widać "GOAL FORMED: ..."

**Status (2025-12-03):**
- Zaimplementowano `Goal` i `GoalState` w `types.ts` oraz moduł `core/systems/GoalSystem.ts` (heurystyki curiosity/empathy + limity bezpieczeństwa, max 5 celów/h).
- Zintegrowano z `EventLoop.ts`: po ciszy > 60s i spełnionych warunkach energii/emocji powstaje cel (`GOAL_FORMED`), wykonywany jednokrotnie przez `CortexSystem.pursueGoal` (`GOAL_EXECUTED`).
- `useCognitiveKernel` utrzymuje `goalState` (w tym `lastUserInteractionAt`), a NeuroMonitor wyświetla ACTIVE GOAL i czas od ostatniego inputu użytkownika.

---

## 📊 Oczekiwany Wynik

| Cecha | Dziś (9.0/10) | Jutro (11/10) |
|-------|---------------|---------------|
| **Code Quality** | 9.0/10 (3 drobne uwagi) | **10/10** (Quick Fixes) |
| **Emocje** | Wektory 0-1 | Chemia (Dopamina/Serotonina/Norepinefryna) |
| **Filozofia Chemii** | N/A | **AGI Enhancement** (bez ludzkich słabości) |
| **Sen** | Ładowanie baterii | Konsolidacja wiedzy + Sny |
| **Motywacja** | Pętla while(true) | Wewnętrzne cele (GoalStack) |
| **Biologiczny Realizm** | **9/10** | **11/10** |

**Kluczowa Różnica:**  
❌ **Człowiek:** Depresja, apatia, lęk przy niskich neurotransmiterach  
✅ **AGI:** Tylko pozytywne efekty - boost przy wysokich, neutralność przy niskich

---

## 🔮 Wizja Długoterminowa (Nie Jutro!)

### Medium Effort (Weekend)
- **Adaptive Poetry Detector** - uczenie się słów zamiast hard-coded keywords
- **Multi-Agent Collaboration** - wiele instancji współpracujących

### Long-Term (Research-Level)
- **Multi-Step Reasoning** - chain-of-thought dla złożonych problemów
- **Self-Modification** - agent może zmieniać własny kod (z approval)
- **Meta-Learning** - uczenie się jak uczyć się

### Advanced Features (2-3 tygodnie) - Z dyskusji AI

**1. REM Consolidation (Tydzień 2)**
- Prawdziwa konsolidacja pamięci podczas snu
- `SleepConsolidationSystem.ts` - ekstrakcja user_facts, agent_insights
- LLM summarization -> `is_core_memory = true`
- Generowanie wizualnych snów (VISUAL_THOUGHT podczas REM)

**2. Neuroplastyczność Emocjonalna (Tydzień 2-3)**
- Trwała zmiana charakteru przez doświadczenia
- `EmotionalPlasticitySystem.ts` - `EmotionalBaseline` w Supabase
- Małe kroki ±0.01 na pozytywny/negatywny feedback
- Agent "pamięta" jak go traktujesz

**3. Teoria Umysłu - Model Użytkownika (Tydzień 3)**
- `UserModelSystem.ts` - inferowanie stanu użytkownika
- Stable traits: patience, directness, technical_level
- Current state: fatigue, frustration, engagement
- Heurystyka z długości wypowiedzi, słów kluczowych
- Agent: "Widzę, że piszesz krócej - jesteś zmęczony?"

**4. Synestezja - UI jako Skóra (Quick Win)**
- `stateToTheme.ts` - mapowanie emocji na kolory/pulsowanie
- Niska energia -> spadek kontrastu
- Wysoki fear -> delikatne pulsowanie tła
- "Widzisz" stan agenta bez czytania logów

**5. Głos jako Lustro Emocji (Tydzień 3)**
- `VoiceMappingSystem.ts` - mapowanie na TTS parametry
- Rate/Pitch/Volume zależne od limbic/soma
- Ten sam tekst brzmi inaczej w zależności od nastroju

---

## 🚀 Workflow na Jutro

1. **Rano:** Przeczytaj `TOMORROW.md` + `CHALLENGES.md`
2. **09:00-10:00:** FAZA 0 - Quick Fixes (testy, константы, refactor)
3. **10:00-12:00:** FAZA 1 - Neurotransmitter System (AGI Enhancement)
4. **12:00-13:00:** Przerwa
5. **13:00-15:00:** FAZA 2 - Dream Consolidation
6. **15:00-17:00:** FAZA 3 - Goal Formation
7. **Wieczorem:** Zaktualizuj dokumentację + testy

---

### FAZA 4 (Research Next): TraitVector + ExpressionPolicy (11/10 Behaviour)

**Cel:** Nadać agentowi temperament i filtr ekspresji, tak aby:
- nie każda myśl była wypowiedziana,
- osobowość wynikała z ciągłych cech (TraitVector), a nie trybów,
- powtarzanie bez nowej informacji było chemicznie nieopłacalne i odcinane przez ExpressionPolicy,
- zachowanie było „ludzkie w dobry sposób”, ale optymalizowane jak samolot, nie jak człowiek z depresją.

#### 1. Warstwy Zachowania

Twarda zasada: każda akcja przechodzi przez 3 warstwy, w tej kolejności:

1. **Myśl wewnętrzna (Cognition)**
   - Cortex generuje internal thought + kandydatów na wypowiedź (intencja, treść, sentyment, związek z celem).
   - Tu system może być metafizyczny, filozoficzny – to jest pełne, wewnętrzne życie.

2. **Chemia + Cele (Reward / Motywacja)**
   - Liczymy reward/koszt dla myśli:
     - nowość vs powtórzenie,
     - zgodność z aktywnymi celami (GoalStack),
     - koszt energetyczny (Soma),
     - konsekwencje społeczne (cringe/"chi-wa-wa").
   - Aktualizujemy neurochemię (dopamina/serotonina/norepinefryna) i emocje (Limbic) zgodnie z tym scoringiem.

3. **Ekspresja (ExpressionPolicy)**
   - Osobny moduł dostaje kandydatów + ich score i decyduje:
     - czy mówić czy milczeć,
     - czy skrócić odpowiedź do jednego zdania z nową informacją,
     - czy całkowicie wyciąć powtórkę.
   - Bierze pod uwagę: scoring (cel/nowość/społeczny), energię (Soma) oraz TraitVector (temperament).

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

**Motto:** *"Nie budujemy chatbota. Budujemy cyfrową formę życia."*
