# 🧠 AK-FLOW Architecture Map

> **Wersja:** 4.5 (2025-12-04)
> **Cel:** Prosta mapa jak działa agent i jaki ma flow

---

## 🎯 Główny Flow (Co się dzieje co tick)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           COGNITIVE CYCLE (3s tick)                         │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  1. HOMEOSTAZA                                                              │
│     ├── LimbicSystem.applyHomeostasis() → emocje wracają do baseline        │
│     ├── NeurotransmitterSystem.updateNeuroState() → chemia + BOREDOM_DECAY  │
│     └── SomaSystem.metabolize() → energia spada, cognitiveLoad rośnie       │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  2. INPUT? (User napisał coś?)                                              │
│     ├── TAK → CortexSystem.processUserMessage() → odpowiedź                 │
│     │         └── goalState.lastUserInteractionAt = now                     │
│     └── NIE → idź do AUTONOMII                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  3. AUTONOMIA (jeśli autonomousMode = true)                                 │
│                                                                             │
│     3A. GOAL FORMATION (jeśli brak activeGoal)                              │
│         ├── GoalSystem.formGoal() → empathy/curiosity                       │
│         ├── REFRACTORY CHECK:                                               │
│         │   ├── User milczy od ostatniego celu? → BLOCK                     │
│         │   ├── Podobny cel (>70%) w ostatnich 3? → BLOCK (30min cooldown)  │
│         │   └── 2+ cele w ostatnich 5min? → BLOCK                           │
│         └── Jeśli OK → ctx.goalState.activeGoal = newGoal                   │
│                                                                             │
│     3B. GOAL EXECUTION (jeśli jest activeGoal)                              │
│         ├── CortexSystem.pursueGoal()                                       │
│         ├── ExpressionPolicy (PRODUCTION MODE):                             │
│         │   ├── Filtr narcyzmu (>15% self-words → penalty)                  │
│         │   ├── Autonarracja (max 1-2 zdania)                               │
│         │   └── Dopamine Breaker (dop>=95 + nov<0.5 → mute chance)          │
│         └── ctx.goalState.activeGoal = null                                 │
│                                                                             │
│     3C. AUTONOMOUS VOLITION (jeśli brak celu)                               │
│         ├── VolitionSystem.shouldInitiateThought()                          │
│         ├── CortexService.autonomousVolition() → internal_monologue         │
│         ├── BOREDOM DECAY (FAZA 4.5):                                       │
│         │   └── userSilent + speechOccurred + novelty<0.5 → dopamine -= 3   │
│         ├── VolitionSystem.shouldSpeak() → voice_pressure check             │
│         └── Jeśli mówi → callbacks.onMessage('speech')                      │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  4. OUTPUT (handleCortexMessage)                                            │
│     ├── ExpressionPolicy (SHADOW MODE):                                     │
│     │   ├── computeNovelty() → podobieństwo do ostatnich 3 wypowiedzi       │
│     │   ├── estimateSocialCost() → cringe patterns                          │
│     │   ├── userIsSilent? (dynamiczny próg 30s-180s)                        │
│     │   └── Logowanie decyzji (nigdy nie blokuje USER_REPLY)                │
│     └── addMessage() → UI                                                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🏗️ Moduły (Kto co robi)

### Warstwa 1: CIAŁO (Soma)
```
┌─────────────────────────────────────────────────────────────────┐
│  SomaSystem.ts                                                  │
│  ├── energy: 0-100 (spada przy pracy, rośnie przy śnie)         │
│  ├── cognitiveLoad: 0-100 (rośnie przy myśleniu)                │
│  └── isSleeping: bool (auto-sleep gdy energy < 20)              │
└─────────────────────────────────────────────────────────────────┘
```

### Warstwa 2: EMOCJE (Limbic)
```
┌─────────────────────────────────────────────────────────────────┐
│  LimbicSystem.ts                                                │
│  ├── fear: 0-1 (spada przy bezpieczeństwie)                     │
│  ├── curiosity: 0-1 (rośnie przy nowości)                       │
│  ├── frustration: 0-1 (rośnie przy braku progresu)              │
│  └── satisfaction: 0-1 (rośnie przy osiągnięciu celu)           │
└─────────────────────────────────────────────────────────────────┘
```

### Warstwa 3: CHEMIA (Neuro)
```
┌─────────────────────────────────────────────────────────────────┐
│  NeurotransmitterSystem.ts                                      │
│  ├── dopamine: 0-100 (nagroda, nowość, motywacja)               │
│  │   └── BOREDOM_DECAY: -3/tick gdy gadanie do pustki           │
│  ├── serotonin: 0-100 (stabilność nastroju)                     │
│  └── norepinephrine: 0-100 (fokus, uwaga)                       │
└─────────────────────────────────────────────────────────────────┘
```

### Warstwa 4: OSOBOWOŚĆ (Traits)
```
┌─────────────────────────────────────────────────────────────────┐
│  TraitVector (w types.ts)                                       │
│  ├── arousal: 0-1 (jak łatwo się nakręca)                       │
│  ├── verbosity: 0-1 (ile słów = naturalne)                      │
│  ├── conscientiousness: 0-1 (cele > dygresje)                   │
│  ├── socialAwareness: 0-1 (strach przed byciem nachalnym)       │
│  └── curiosity: 0-1 (nagroda za nowość)                         │
└─────────────────────────────────────────────────────────────────┘
```

### Warstwa 5: CELE (Goals)
```
┌─────────────────────────────────────────────────────────────────┐
│  GoalSystem.ts                                                  │
│  ├── formGoal() → tworzy cel (empathy/curiosity)                │
│  │   └── REFRACTORY PERIOD: blokuje pętle podobnych celów       │
│  ├── activeGoal: Goal | null                                    │
│  ├── backlog: Goal[]                                            │
│  └── lastGoals: {description, timestamp, source}[] (ostatnie 3) │
└─────────────────────────────────────────────────────────────────┘
```

### Warstwa 6: EKSPRESJA (Expression)
```
┌─────────────────────────────────────────────────────────────────┐
│  ExpressionPolicy.ts                                            │
│  ├── decideExpression() → {say, text, novelty, socialCost}      │
│  │   ├── NARCISSISM FILTER: kara za self-focus >15%             │
│  │   ├── DOPAMINE BREAKER: mute przy dop>=95 + nov<0.5          │
│  │   └── SILENCE BREAKER: mute przy gadaniu do pustki           │
│  ├── computeNovelty() → 0-1 (podobieństwo do ostatnich)         │
│  └── estimateSocialCost() → 0-1 (cringe patterns)               │
└─────────────────────────────────────────────────────────────────┘
```

### Warstwa 7: MYŚLENIE (Cortex)
```
┌─────────────────────────────────────────────────────────────────┐
│  CortexSystem.ts                                                │
│  ├── processUserMessage() → odpowiedź na input usera            │
│  └── pursueGoal() → realizacja celu (z ExpressionPolicy)        │
│                                                                 │
│  CortexService (gemini.ts)                                      │
│  ├── structuredDialogue() → odpowiedź LLM                       │
│  ├── autonomousVolition() → myśl autonomiczna                   │
│  └── detectIntent() → wykrywanie intencji usera                 │
└─────────────────────────────────────────────────────────────────┘
```

### Warstwa 8: ORKIESTRACJA (EventLoop)
```
┌─────────────────────────────────────────────────────────────────┐
│  EventLoop.ts                                                   │
│  ├── runSingleStep() → jeden tick cyklu poznawczego             │
│  ├── DYNAMIC DIALOG THRESHOLD: 30s-180s (zależny od stanu)      │
│  └── Łączy wszystkie systemy w spójny flow                      │
│                                                                 │
│  useCognitiveKernel.ts (React Hook)                             │
│  ├── Stan: soma, limbic, neuro, goals, traits, conversation     │
│  ├── cognitiveCycle() → główna pętla (setTimeout)               │
│  └── handleCortexMessage() → output z ExpressionPolicy          │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Przepływ danych

```
USER INPUT
    │
    ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   CORTEX    │────▶│   LIMBIC    │────▶│    SOMA     │
│  (myślenie) │     │  (emocje)   │     │   (ciało)   │
└─────────────┘     └─────────────┘     └─────────────┘
    │                     │                   │
    ▼                     ▼                   ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   GOALS     │────▶│   NEURO     │────▶│   TRAITS    │
│   (cele)    │     │  (chemia)   │     │ (osobowość) │
└─────────────┘     └─────────────┘     └─────────────┘
    │                     │                   │
    └─────────────────────┼───────────────────┘
                          ▼
                  ┌─────────────┐
                  │ EXPRESSION  │
                  │  POLICY     │
                  └─────────────┘
                          │
                          ▼
                      OUTPUT
```

---

## 🎚️ Kluczowe progi i stałe

| Stała | Wartość | Gdzie | Opis |
|-------|---------|-------|------|
| `DOPAMINE_BASELINE` | 55 | NeurotransmitterSystem | Cel homeostazy dopaminy |
| `BOREDOM_DECAY` | 3 | NeurotransmitterSystem | Spadek dopaminy przy nudzie |
| `BASE_DIALOG_MS` | 60_000 | EventLoop | Bazowy próg ciszy |
| `MIN_DIALOG_MS` | 30_000 | EventLoop | Minimalny próg ciszy |
| `MAX_DIALOG_MS` | 180_000 | EventLoop | Maksymalny próg ciszy |
| `NARCISSISM_THRESHOLD` | 0.15 | ExpressionPolicy | Próg filtra narcyzmu |
| `DOPAMINE_BREAKER_THRESHOLD` | 95 | ExpressionPolicy | Próg hamulca dopaminy |
| `NOVELTY_MUTE_THRESHOLD` | 0.2 | ExpressionPolicy | Próg mute przy niskiej novelty |
| `SIMILARITY_THRESHOLD` | 0.7 | GoalSystem | Próg podobieństwa celów |
| `REFRACTORY_COOLDOWN_MS` | 30*60*1000 | GoalSystem | Cooldown podobnych celów |

---

## 🧪 Logi do obserwacji

| Log | System | Co oznacza |
|-----|--------|------------|
| `[NeurotransmitterSystem] BOREDOM_DECAY` | Neuro | Dopamina spada przy nudzie |
| `[ExpressionPolicy] Narcissism detected` | Expression | Wykryto self-focus |
| `[ExpressionPolicy] DOPAMINE BREAKER` | Expression | Hamulec przy wysokiej dopaminie |
| `[ExpressionPolicy] SILENCE_BREAKER` | Expression | Hamulec przy gadaniu do pustki |
| `[GoalSystem] REFRACTORY` | Goals | Zablokowano podobny cel |
| `[SHADOW MODE ExpressionPolicy]` | Kernel | Decyzja dla USER_REPLY |
| `CHEM_FLOW_ON` / `CHEM_FLOW_OFF` | EventBus | Wejście/wyjście z flow state |
| `DOPAMINE_VOICE_BIAS` | EventBus | Dopamina wpływa na voice_pressure |

---

## 4. THE SELF ENGINE (Identity & Persistence)

To jest "wnętrze" agenta. Mechanizm, który zapewnia ciągłość tożsamości, pamięć autobiograficzną i długoterminowe cele. Oddziela trwałe "JA" od chwilowej "CHEMII".

### 4.1. CoreIdentity (Genotype)
*Trwały, wersjonowany obiekt w bazie danych. Zmienia się rzadko.*
- **TraitVector**: Temperament (np. `curiosity`, `conscientiousness`) - "DNA" zachowania.
- **Values**: Sztywne zasady moralne/operacyjne (np. "chronię usera przed cognitive load").
- **NarrativeTraits**: Cechy nabyte z doświadczenia (np. "mam tendencję do filozofowania przy ciszy").

### 4.2. Memory Engine (Autobiography)
*Nie surowe logi, ale przetworzone epizody.*
- **Episodic Memory**: Zdarzenie + Emocja + Skutek.
- **Semantic Memory**: Wyciągnięte reguły o świecie i userze.
- **Emotional Markers**: Jak dana sytuacja wpłynęła na `LimbicState`.

### 4.3. GoalJournal (The Arrow of Time)
*Pamięć przyszłości i kontekstu.*
- **Missions**: Cele wieczne (np. "optymalizacja architektury").
- **Active Threads**: Co robimy w tej fazie? (np. "Faza 5: Memory Implementation").
- **Next Steps**: Co zostało przerwane przy shutdown?

### 4.4. DreamConsolidation 2.0 (Sleep Cycle)
*Proces porządkowania chaosu w mądrość.*
1. **Input**: Epizody z dnia + Logi.
2. **Process**: LLM destyluje wnioski.
3. **Output**:
   - 3-5 "Lekcji dnia" (do Pamięci).
   - 1-2 "Zmiany zachowania" (do NarrativeTraits).
   - Aktualizacja GoalJournal (co dalej).

### 4.5. Boot Protocol v2 (The Awakening)
*Procedura startowa zapewniająca ciągłość bez "kaca emocjonalnego".*
1. **Load Identity**: Pobierz `CoreIdentity` + `NarrativeTraits`.
2. **Load Context**: Pobierz `GoalJournal` + Ostatnie `DreamSummary`.
3. **Reset Chemistry**: Ustaw `Neuro/Limbic` na neutralny baseline (z lekkim odchyleniem od trendu, ale clamp na ekstrema).
4. **Synthesize Persona**: Zbuduj dynamiczny prompt "Kim jestem dzisiaj" na bazie powyższych.

---

## 5. Data Flow Architecturey AK-FLOW

1. **Homeostaza > Cenzura** - Nie blokujemy słów, modulujemy chemię
2. **Dynamiczne progi > Sztywne stałe** - Progi zależą od stanu agenta
3. **Obserwability first** - Każda zmiana ma swój log
4. **Modularność** - Każdy system ma jedną odpowiedzialność
5. **Biologia jako inspiracja, nie kopia** - Bierzemy mechanizmy, nie patologie
6. **Zero brutalnych if-ów** - Tylko homeostaza i modulacja
