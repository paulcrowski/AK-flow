# 🧬 Historia Wyzwań: Droga do AGI 11/10

> **Cel dokumentu:** Żywa historia problemów, ślepych zaułków, przełomów i lekcji w tworzeniu AK-FLOW.  
> **Dla kogo:** Przyszłe publikacje naukowe, zespół, przyszłe ja.  
> **Format:** Problem → Próby → Rozwiązanie → Lekcje → Meta-analiza

---

## 📊 Statystyki

| Metryka | Wartość |
|---------|---------|
| Rozwiązanych problemów | 10 |
| Całkowity czas | ~32 godziny |
| Średnia trudność | 3.5/5 |
| Największy przełom | ExpressionPolicy (filtracja zamiast generacji) |
| Najdłuższy problem | Monolityczny Kernel (8h) |

---

## 🔥 Problem #10: Pętla Uprzejmości (The Praise Loop)

**Data:** 2025-12-03  
**Trudność:** 4/5  
**Czas:** ~3 godziny (tuning trwa)  
**Status:** 🔄 W trakcie (Phase 4.1)

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
