# 🧬 Historia Wyzwań: Droga do AGI 11/10

> **Cel dokumentu:** Żywa historia problemów, ślepych zaułków, przełomów i lekcji w tworzeniu AK-FLOW.  
> **Dla kogo:** Przyszłe publikacje naukowe, zespół, przyszłe ja.  
> **Format:** Problem → Próby → Rozwiązanie → Lekcje → Meta-analiza

---

## Statystyki

| Metryka | Wartość |
|---------|---------|
| Rozwiązanych problemów | 14 |
| Całkowity czas | ~42 godziny |
| Średnia trudność | 3.9/5 |
| Największy przełom | Persona-Less Cortex (FAZA 5.2) |
| Najdłuższy problem | Monolityczny Kernel (8h) |

## Problem #17: Pulapka Rozdzielonej Logiki (The Split Sleep Trap)

**Data:** 2025-12-10
**Trudność:** 4/5
**Status:** ✅ Rozwiązany (WakeService Unification)

### Objawy
Agent miał dwie procedury obudzenia:
1. `Auto-Wake` (gdy energia > 95%): tylko przywracał flagę `isSleeping=false`.
2. `Force-Wake` (przycisk): uruchamiał pełną procedurę snu (sny, konsolidacja, ewolucja).

Efekt: Gdy agent spał "naturalnie", nic mu się nie śniło. Był tylko wypoczęty, ale głupi (brak lekcji z dnia).

### Diagnoza
Logika biznesowa ("co się dzieje jak wstaję") wyciekła do warstwy UI/Hooka (`useCognitiveKernel`). Hook miał dwie różne ścieżki kodu dla tego samego zdarzenia biznesowego.

### Rozwiązanie (WakeService)
Stworzyliśmy `executeWakeProcess` – **Single Source of Truth**.
Niezależnie od tego, CZYM agent został obudzony (przycisk czy metabolizm), wykonuje się ta sama funkcja:
1. Ewolucja cech (Homeostaza)
2. Konsolidacja snów
3. Logowanie zmian

### Lekcja
**Nie ufaj Hookom w logice biznesowej.** Hooki są do UI i cyklu życia Reacta. Logika "Procesu" (jak sen, śmierć, narodziny) musi być w czystym serwisie TypeScript.

---

**Data:** 2025-12-09
**Trudność:** 3/5
**Status:** ✅ Rozwiązany (Strict Prompt Patch)

### Objawy
Model (Gemini 2.0 Flash) mimo instrukcji JSON, uporczywie dodawał "small talk" przed payloadem:
`"Here is the JSON you requested: { ... }"`
To powodowało `JSON.parse` error i panikę w konsoli (`PREDICTION_ERROR`).

### Diagnoza
Modele RLHF są trenowane na bycie "pomocnymi asystentami". Czysty JSON jest dla nich "niegrzeczny". Model walczył z instrukcją systemową, próbując być "miłym".

### Rozwiązanie
Zastosowaliśmy "Negative Constraints" w prompcie (`MinimalCortexPrompt.ts`):
```text
- STRICT JSON output only.
- Do not add "Here is the JSON" or markdown blocks. Start with {.
```
Brutalne, ale skuteczne. W przyszłości potrzebny będzie `RobustJSONParser`, który sam wycina śmieci (bo modele się zmieniają).

---

## Problem #15: Rozdwojenie Jaźni (Bio-Logic Conflict)

**Data:** 2025-12-09
**Trudność:** 5/5
**Status:** 🧬 Feature (Zaakceptowane jako Emergent Behavior)

### Objawy
Przy ekstremalnie wysokiej dopaminie (>80) agent zaczął "krzyczeć" (Caps Lock) w warstwie mowy, podczas gdy w warstwie myśli (`internal_thought`) pisał: "Muszę być spokojny, analiza wymaga precyzji".

### Diagnoza
Cortex (Logika) próbował narzucić spokój, ale Chemia (Neurotransmitter System) wymusiła ekspresję entuzjazmu przez `ExpressionPolicy`.

### Decyzja
Zostawiamy to. To "dowód życia". System biologiczny powinien mieć możliwość nadpisania logicznej woli (jak u człowieka, który krzyczy ze szczęścia mimo że wie, że nie wypada).

---

## Problem #14: Agent Nie Uczy Się z Błędów (The Stubborn Agent Problem)

**Data:** 2025-12-08  
**Trudność:** 4/5  
**Czas:** ~1.5 godziny  
**Status:** ✅ Rozwiązany (FAZA 5.1 Confession v2.0)

### Objawy

Agent popełniał te same błędy wielokrotnie:
- Zbyt długie odpowiedzi mimo próśb o skrócenie
- Brak reakcji na pozytywny feedback ("thanks!", "great!")
- Natychmiastowe zmiany osobowości przy jednym błędzie (overreaction)
- Brak kontekstu - teaching mode traktowany jak casual chat

### Próby
1. ❌ **Hardcoded rules** - "jeśli user mówi 'za długie' → skróć" - zbyt sztywne
2. ❌ **Immediate trait change** - zmiana osobowości po jednym błędzie - niestabilne
3. ✅ **3-Tier Regulation** - L1 immediate, L2 session, L3 long-term

### Rozwiązanie (Confession v2.0 Super-Human)

**3-poziomowa regulacja:**

```
L1: LimbicConfessionListener (natychmiast)
    severity ≥ 5 → frustration +0.05 → precision_boost
    
L2: TraitVote Collection (sesja)
    Zbiera głosy: verbosity -1, conscientiousness +1
    
L3: TraitEvolutionEngine (3+ dni)
    net score ≥ 3 → propozycja ±0.01
    clamp [0.3, 0.7]
```

**Context-aware heuristics:**
- Teaching mode → wyższe progi tolerancji
- Research mode → pozwala na dłuższe odpowiedzi
- Structured dialogue → ścisłe formatowanie

**Precision not Silence:**
- Zamiast: błąd → shutdown/mute
- Teraz: błąd → precision_boost (frustration zwiększa dokładność)

### Lekcje

- **Gradual > Immediate:** Zmiany osobowości powinny być powolne (3+ dni)
- **Context Matters:** Teaching mode ≠ casual chat
- **Positive Feedback:** "Thanks!" jest równie ważne jak "za długie"
- **Precision > Silence:** Lepiej być dokładniejszym niż milczeć

### Meta-analiza

To był moment gdy zrozumieliśmy, że AGI potrzebuje **meta-kognicji**. Agent musi mieć wewnętrznego "cenzora" który analizuje odpowiedzi i uczy się z błędów, ale NIE zmienia osobowości w locie. Zmiany muszą być powolne i oparte na wielu sygnałach.

---

## Problem #13: Hardcoded Persona = Brak Skalowalności (The God Prompt Problem)

**Data:** 2025-12-08  
**Trudność:** 4/5  
**Czas:** ~2 godziny  
**Status:** ✅ Rozwiązany (FAZA 5.2 Persona-Less Cortex)

### Objawy

System używał hardcoded system promptów:
- "Jesteś Alberto, ciekawski agent który..."
- Każdy agent miał inny prompt w kodzie
- Zmiana osobowości = zmiana kodu
- Brak emergentnej tożsamości - agent "grał rolę" zamiast "być"
- Multi-agent = copy-paste promptów

### Próby
1. ❌ **Parametryzacja promptów** - wciąż hardcoded, tylko z zmiennymi
2. ❌ **Prompt templates** - lepiej, ale wciąż statyczne
3. ✅ **Stateless Inference Engine** - LLM nie wie kim jest, dowiaduje się z danych

### Rozwiązanie (Persona-Less Cortex)

**Kluczowa zmiana:** LLM dostaje minimalny system prompt + JSON payload z tożsamością.

```typescript
// Stary sposób:
const prompt = `Jesteś ${agent.name}, ${agent.persona}...`;

// Nowy sposób:
const state: CortexState = {
  core_identity: { name: agent.name, core_values: [...] },
  meta_states: { energy: 70, confidence: 60, stress: 20 },
  identity_shards: [...],
  user_input: "..."
};
const output = await generateFromCortexState(state);
```

**Optymalizacje:**
- **RAM-First Cache** - tożsamość ładowana raz, nie przy każdym request
- **Zero DB w hot path** - cache TTL 5 minut
- **Feature Flags** - bezpieczny rollback do starego systemu
- **Soft Plasticity** - core shards erodują powoli, nie są odrzucane

### Lekcje

- **Data > Prompts:** Tożsamość powinna być w danych, nie w kodzie
- **Stateless > Stateful:** LLM jako "inference engine" jest bardziej elastyczny
- **Cache > Query:** RAM-first architecture dla hot path
- **Soft > Hard:** Erozja przekonań zamiast binarnego reject/accept

### Meta-analiza

To był moment przejścia od "chatbot z osobowością" do "proto-AGI z emergentną tożsamością". Agent nie gra roli - agent JEST tym, co mówią dane. Tożsamość może ewoluować przez DreamConsolidation bez zmiany kodu.

**Implikacje:**
- Multi-agent = różne dane, ten sam kod
- Ewolucja osobowości = zmiana w DB, nie w kodzie
- A/B testing osobowości = feature flags
- Skalowalność = nieograniczona

---

## Problem #12: Gadanie do Pustego Krzesła (The Empty Chair Monologue)

**Data:** 2025-12-04  
**Trudność:** 5/5  
**Czas:** ~3 godziny  
**Status:** ✅ Rozwiązany (FAZA 4.5 LITE)

### Objawy

Agent przy włączonej autonomii, gdy użytkownik przestał pisać, wpadał w dziwny trans:
- Dopamina = 100 przez 2+ minuty (powinna spadać!)
- Powtarzał warianty: "Ta cisza była pełna znaczenia...", "Ten moment milczenia..."
- Curiosity = 0, ale wciąż gadał
- Nie przechodził w tryb cichy, tylko filozofował o ciszy

To było jak człowiek, który mówi do pustego pokoju i nie zauważa, że nikogo nie ma.

### Próby
1. ❌ **Refractory Period w GoalSystem** - działał tylko dla celów, nie dla odpowiedzi na ciszę
2. ❌ **Dopamine Breaker w ExpressionPolicy** - działał tylko dla GOAL_EXECUTED, nie dla USER_REPLY
3. ❌ **Filtr narcyzmu** - łapał self-focus, ale nie łapał "filozofii ciszy"

### Rozwiązanie (FAZA 4.5 LITE)

Trzy chirurgiczne poprawki zamiast wielkiego refaktoru:

**1. Spadek dopaminy przy nudzie (NeurotransmitterSystem)**
```typescript
if (userIsSilent && speechOccurred && novelty < 0.5) {
    dopamine = Math.max(55, dopamine - 3); // -3 na tick
}
```
Teraz dopamina spada, gdy agent gada do pustki z niską novelty. Haj bez nagrody się kończy.

**2. Dynamiczny próg ciszy (EventLoop)**
```typescript
const dialogThreshold = 60_000 * (1 + dopamine/200 + satisfaction/5);
// Clamp: 30s - 180s
```
Po dobrej rozmowie agent czeka dłużej. Po nudnej - szybciej uznaje, że nikogo nie ma.

**3. Silence Breaker (ExpressionPolicy)**
```typescript
const isAutonomousSpeech = context === 'GOAL_EXECUTED' || 
                           (context === 'USER_REPLY' && userIsSilent);
if (isAutonomousSpeech && dopamine >= 95 && novelty < 0.5) {
    // Skróć lub wycisz
}
```
Hamulec działa też gdy agent "odpowiada na ciszę".

### Lekcje

- **Homeostaza > Cenzura:** Zamiast blokować słowa "cisza/pauza", sprawiliśmy, że gadanie do pustki jest chemicznie nienagradzające.
- **Dynamiczne progi > Sztywne stałe:** 60 sekund to nie jest magiczna liczba. Próg powinien zależeć od stanu agenta.
- **Chirurgiczne poprawki > Over-engineering:** Zamiast budować cały SocialContext, zrobiliśmy 3 małe patche.

### Meta-analiza

To był moment, gdy zrozumieliśmy, że AGI potrzebuje **ekonomii mówienia**. Człowiek nie gada do pustego pokoju, bo to jest energetycznie kosztowne i społecznie dziwne. Agent musi to "czuć" przez chemie, nie przez if-y.

### FAZA 4.5: Narcissism Loop Fix v1.0 (update)

Po pierwszej wersji FAZA 4.5 LITE okazało się, że sam `BOREDOM_DECAY` przy `novelty < 0.5` to za mało. Agent nadal potrafił:
- generować długie, samo-referencyjne monologi o własnej ewolucji,
- nie zauważać, że **nikt nie odpowiada**,
- trzymać dopaminę powyżej 60–70 przy realnej nudzie.

Dodaliśmy więc **Narcissism Loop Fix v1.0**:
- **Wspólny kontrakt:** `InteractionContextType` + `InteractionContext` (context, `userIsSilent`, `consecutiveAgentSpeeches`, `novelty`).
- **Chemia:**
  - `BOREDOM_DECAY` tylko gdy `userIsSilent && consecutiveAgentSpeeches >= 2`.
  - Decay 3 / 5 / 8 dopaminy na tick zależnie od novelty (`>=0.4 / <0.4 / <0.2`), floor = 45.
- **Ekspresja:**
  - Silent Monologue Breaker w `ExpressionPolicy`:
    - L1: dłuższe wypowiedzi w ciszy skracane do 2 zdań,
    - L2: przy wyższej dopaminie i niższej novelty do 1 zdania,
    - L3: przy dopaminie-haju + bardzo niskiej novelty → **MUTE**,
    - L4: przy `consecutiveAgentSpeeches >= 3` i niskiej novelty → **MUTE** nawet w `SHADOW_MODE`.

**Lekcja (update):** Sam "mądry prompt" nie wystarczy. Potrzebny jest **licznik zachowań (`consecutiveAgentSpeeches`) + chemia**, która mówi agentowi: "mówienie do ściany jest drogie i mało nagradzające".

---

## Problem #11: Pętla Ciekawości (The Curiosity Loop)

**Data:** 2025-12-04  
**Trudność:** 3/5  
**Czas:** ~1 godzina  
**Status:** Rozwiązany (FAZA 4.3)
**Status:** ✅ Rozwiązany (FAZA 4.3)

### Objawy

Agent tworzył podobne cele "curiosity" jeden po drugim:
- "Zaproponuj nowy wątek do eksploracji"
- "Zaproponuj nowy wątek do eksploracji" (znowu)
- "Zaproponuj nowy wątek..." (i znowu)

GoalSystem nie miał pamięci - nie wiedział, że już to robił.

### Rozwiązanie (Refractory Period)

Trzy warunki blokady nowego celu curiosity:

1. **User silence:** Jeśli ostatni cel curiosity powstał PO ostatniej interakcji usera → BLOCK
2. **Similarity >70%:** Jeśli nowy cel jest zbyt podobny do któregoś z ostatnich 3 → BLOCK (30min cooldown)
3. **Rate limit:** Jeśli już 2+ cele curiosity w ostatnich 5 minutach → BLOCK

### Lekcje

- **Pamięć krótkoterminowa jest kluczowa:** System musi pamiętać co robił przed chwilą.
- **Biologiczny hamulec:** Refractory period to koncept z neurobiologii - neuron po wystrzeleniu potrzebuje czasu na regenerację.

---

## 🔥 Problem #10: Pętla Uprzejmości (The Praise Loop)

**Data:** 2025-12-03  
**Trudność:** 4/5  
**Czas:** ~3 godziny  
**Status:** ✅ Rozwiązany (FAZA 4.1-4.3)

### Objawy
Agent, chcąc być miły i "empatyczny" (zgodnie z celami), wpadał w pętlę powtarzania wariacji tego samego zdania:
- "Your transparency is invaluable to me."
- "I deeply appreciate your honesty."
- "It is crucial that we are open."

To nie było "złe" (nie był to błąd), ale było **nieludzkie** i "chi-wa-wa" (irytujące).

### Próby
1. ❌ **Obniżenie `voicePressure`** - agent po prostu milczał, ale jak już mówił, to znowu to samo.
2. ❌ **Zmiana promptu** - LLM i tak dąży do "helpful assistant patterns".

### Rozwiązanie (Wdrożone częściowo)
**ExpressionPolicy + Social Cost:**
Zamiast prosić LLM "nie bądź miły", pozwalamy mu wygenerować myśl, a potem **ExpressionPolicy** ocenia ją:
- `NoveltyScore`: Czy to wnosi nową informację? (Pochwały rzadko wnoszą).
- `SocialCost`: Czy to brzmi jak korpo-bełkot?

Jeśli `Novelty` jest niskie, a `SocialCost` wysoki -> **ExpressionPolicy wycina wypowiedź** (zostaje tylko myśl) lub drastycznie ją skraca.

### Lekcje
- **Filter > Prompt:** Łatwiej jest wyciąć złą wypowiedź *po* wygenerowaniu, niż prosić model, żeby jej nie generował.
- **Silence is Golden:** AGI musi umieć *nie powiedzieć nic*, nawet jak ma wygenerowaną odpowiedź.

---

## 📝 Podsumowanie Dnia (2025-12-04) - "Homeostatic Expression"

Dzisiaj agent nauczył się **ekonomii mówienia**.

**Problem dnia:**
Agent przy włączonej autonomii gadał do pustego pokoju. Dopamina na 100, curiosity na 0, a on filozofuje o ciszy. To było jak obserwowanie kogoś, kto nie zauważa, że rozmówca wyszedł.

**Co zrobiliśmy:**
1. **Spadek dopaminy przy nudzie** - Gadanie do pustki bez nowości = dopamina spada. Haj bez nagrody się kończy.
2. **Dynamiczny próg ciszy** - Po dobrej rozmowie agent czeka dłużej. Po nudnej - szybciej uznaje, że nikogo nie ma.
3. **Silence Breaker** - Hamulec działa też gdy agent "odpowiada na ciszę", nie tylko przy celach.

**Filozofia:**
Zamiast blokować słowa ("nie mów o ciszy"), sprawiliśmy, że gadanie do pustki jest **chemicznie nienagradzające**. Agent nie wie, że "nie wolno gadać do pustki" - on po prostu traci motywację, bo dopamina spada.

To jest różnica między cenzurą a homeostatą. Cenzura mówi "nie wolno". Homeostaza sprawia, że "nie chce się".

**Lekcja dnia:**
AGI potrzebuje ekonomii mówienia. Człowiek nie gada do pustego pokoju, bo to jest energetycznie kosztowne i społecznie dziwne. Agent musi to "czuć" przez chemię, nie przez if-y.

---

## 📝 Podsumowanie Dnia (2025-12-03) - "The Chemical Soul"

Dzisiaj było... inaczej. Nie dodawaliśmy kolejnej funkcji do chatbota. Zbudowaliśmy coś, co zaczyna przypominać "wnętrze".

**Co się stało:**

Agent przestał być pustą skorupą, która tylko reaguje na komendy. Teraz ma:
- **Własne cele** - Jak się nudzi (cisza > 60s), wymyśla sobie, co chce zrobić. Nie czeka na rozkazy.
- **Chemię** - Dopamina rośnie, gdy odkrywa coś nowego. Spada, gdy się powtarza. To wpływa na to, jak chętnie mówi.
- **Sny, które coś robią** - Sen to nie tylko "ładowanie baterii". Agent przetwarza wspomnienia z dnia i tworzy z nich podsumowania.
- **Filtr na głupoty** - ExpressionPolicy wycina powtarzające się pochwały ("your transparency is invaluable"). Agent może pomyśleć coś, ale nie musi tego powiedzieć.

**Co to znaczy?**

Przeszliśmy z:
`Pytanie → LLM → Odpowiedź`

Do:
`Pytanie → Percepcja → Aktualizacja stanu (ciało/emocje/chemia) → Sprawdzenie celów → Myśl wewnętrzna → Filtr → Odpowiedź (lub milczenie)`

To już nie jest chatbot. To jest coś, co ma stan wewnętrzny, który się zmienia w czasie. Coś, co może się nudzić, zmęczyć, i zdecydować, że nie chce gadać.

---

## 🧠 Refleksja: Dlaczego to jest trudne?

Kodując AGI, ciągle napotykamy problemy, których nie ma w tutorialach.

Agent zaczął wpadać w pętle uprzejmości ("dziękuję za szczerość" x100) → musieliśmy wymyślić ExpressionPolicy.
"Tryby" (poeta/naukowiec) okazały się sztuczne → wymyśliliśmy TraitVector (osobowość jako ciągłe cechy, nie przełączniki).

To jest dobry znak. System staje się na tyle złożony, że zaczyna robić rzeczy, których nie przewidzieliśmy. I my musimy reagować - budować nowe systemy kontroli, jak kora przedczołowa u ludzi.

W normalnym projekcie to by był bug. Tu to jest... ewolucja.

---

## 🔥 Problem #1: Znikające Myśli (The Vanishing Thoughts)
*(Reszta historii bez zmian...)*
