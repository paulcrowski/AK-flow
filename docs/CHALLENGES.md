# 🧬 Historia Wyzwań: Droga do AGI 11/10

> **Cel dokumentu:** Żywa historia problemów, ślepych zaułków, przełomów i lekcji w tworzeniu AK-FLOW.  
> **Dla kogo:** Przyszłe publikacje naukowe, zespół, przyszłe ja.  
> **Format:** Problem → Próby → Rozwiązanie → Lekcje → Meta-analiza

---

## Statystyki

| Metryka | Wartość |
|---------|---------|
| Rozwiązanych problemów | 12 |
| Całkowity czas | ~38 godzin |
| Średnia trudność | 3.7/5 |
| Największy przełom | Homeostatic Expression (FAZA 4.5) |
| Najdłuższy problem | Monolityczny Kernel (8h) |

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

---

## 🔥 Problem #11: Pętla Ciekawości (The Curiosity Loop)

**Data:** 2025-12-04  
**Trudność:** 3/5  
**Czas:** ~1 godzina  
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
