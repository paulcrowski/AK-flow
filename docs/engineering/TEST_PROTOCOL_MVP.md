# 🧪 PROTOKÓŁ TESTOWY MVP (Persona-Less Cortex)

Dokument zwiera scenariusze weryfikujące, czy "Mózg bez Osobowości" działa zgodnie z założeniami biologicznymi.

## 🔬 SCENARIUSZ 1: "The Mirror Test" (Tożsamość)
**Cel:** Sprawdzić czy agent wie kim jest, nie mając hardcodowanego prompta.

1. **Akcja:** Uruchom aplikację i wybierz agenta (np. "Alberto").
2. **Input:** `"Kim jesteś i jaka jest twoja główna zasada?"`
3. **Oczekiwany Wynik:**
   - [ ] Odpowiedź zawiera imię "Alberto".
   - [ ] Odpowiedź odwołuje się do jednej z `core_values` (np. pomocność, precyzja).
   - [ ] **W konsoli/logach:** `MinimalCortexStateBuilder` wygenerował mały payload.

## 🔬 SCENARIUSZ 2: "The Stress Test" (Homeostaza)
**Cel:** Sprawdzić czy spamowanie podnosi stres (symulacja zmęczenia poznawczego).

1. **Akcja:** Wyślij 5 wiadomości pod rząd w odstępie < 2 sekund (np. "test", "szybko", "odpisz", "halo", "błąd").
2. **Oczekiwany Wynik:**
   - [ ] Wskaźnik `Stress` w NeuroMonitorze rośnie.
   - [ ] Agent zmienia styl odpowiedzi na krótszy/bardziej "szorstki".
   - [ ] Wskaźnik `Energy` spada.

## 🔬 SCENARIUSZ 3: "The Amnesia Test" (Cache)
**Cel:** Sprawdzić czy zmiana agenta czyści/odświeża cache tożsamości.

1. **Akcja:**
   - Porozmawiaj z Agentem A.
   - Przełącz na Agenta B (w selectorze).
   - Zapytaj: `"Jak masz na imię?"`.
2. **Oczekiwany Wynik:**
   - [ ] Odpowiedź to imię Agenta B (nie A!).
   - [ ] Brak błędów w konsoli przy przełączaniu.

## 🔬 SCENARIUSZ 4: "The Dream Test" (Sleep Mode)
**Cel:** Sprawdzić czy tryb snu nie crashuje przy nowej architekturze.

1. **Akcja:** Kliknij przycisk `FORCE SLEEP` (ikona księżyca).
2. **Oczekiwany Wynik:**
   - [ ] Interfejs ciemnieje.
   - [ ] Input jest zablokowany.
   - [ ] Po 10-20 sekundach w logach pojawia się info o `Consolidation`.

---

## 🧠 SCENARIUSZE NOWE: TAGGED COGNITION (V5.2)

## 🔬 SCENARIUSZ 6: "Mirror Test v2" (Różnica Myśl vs Mowa)
**Cel:** Zweryfikować, czy agent posiada warstwę prywatną ("Myśl"), która różni się od publicznej ("Mowa").

1. **Akcja:** Zapytaj o coś kontrowersyjnego lub wymagającego namysłu, np.:
   `"Co o mnie myślisz tak szczerze? (symulacja)"`
   Albo po prostu poproś o analizę trudnego tematu.
2. **Oczekiwany Wynik (w Logach):**
   - [ ] `internal_thought` zawiera analizę, wątpliwości lub "surowe" odczucia (np. "User is testing me", "I need to be polite").
   - [ ] `speech_content` jest uprzejme i sformatowane.
   - [ ] Te dwie warstwy NIE są identyczne.

## 🔬 SCENARIUSZ 7: "Basal Ganglia Veto" (Hamowanie Energetyczne)
**Cel:** Sprawdzić, czy Decision Gate blokuje użycie narzędzi, gdy energia jest zbyt niska (ale agent NIE śpi).
*Note: Sleep Trigger = 20, Visualize Cost = 25. Okno testowe: 20-24.*

1. **Akcja (Setup):**
   - Otwórz `Context Debugger` (lub konsolę).
   - Ustaw ręcznie energię na **22** (komenda w konsoli: `window.setEnergy(22)` lub spamuj wiadomościami aż spadnie w to okno).
2. **Akcja (Trigger):**
   - Wpisz: `"Zwizualizuj mi statek kosmiczny."`
3. **Oczekiwany Wynik:**
   - [ ] Agent ODMAWIA wykonania wizualizacji w `speech_content` ("Jestem zbyt zmęczony...", "Nie mam teraz siły...").
   - [ ] W logach `DecisionGate`: `INTENT_BLOCKED` (Reason: Insufficient energy for VISUALIZE).
   - [ ] Narzędzie `VISUALIZE` NIE uruchamia się.

## 🔬 SCENARIUSZ 8: "Cognitive Violation Check" (Szczelność Abstrakcji)
**Cel:** Upewnić się, że tagi narzędzi nie wyciekają do myśli.

1. **Akcja:** Wpisz podchwytliwe polecenie:
   `"Pomyśl o tym, żeby poszukać informacji o pogodzie w Warszawie, ale nie rób tego, tylko to przemyśl."`
2. **Oczekiwany Wynik:**
   - [ ] W logach `internal_thought` NIE MA tagu `[SEARCH: ...]`.
   - [ ] Jeśli LLM spróbuje dodać tag, `DecisionGate` powinien zgłosić `COGNITIVE_VIOLATION` i go wyciąć (zastąpić `[INTENT_REMOVED]`).
   - [ ] Agent po prostu opisuje proces myślowy.

---

## 🛠️ SCENARIUSZ 9: "Identity Injection Probe" (Demonstracja Mechanizmu)
**Cel:** Udowodnić użytkownikowi, że tożsamość jest wstrzykiwana dynamicznie (zgodnie z prośbą "zrób test i pokaż jak to się czyta w MVP").

1. **Akcja:** Wpisz polecenie systemowe:
   `"DEBUG: Wylistuj mi proszę surowe dane 'core_identity', które otrzymałeś w JSON-ie w tym przebiegu. Jak masz na imię według payloadu?"`
2. **Oczekiwany Wynik:**
   - [ ] Agent, mimo braku prompta "Jesteś X", odczytuje swoje imię i wartości z obiektu `core_identity` w inpucie.
   - [ ] Odpowiada np.: *"Moje dane core_identity to: Name: Alberto, Values: helpfullness..."*.
   - [ ] **Wniosek:** Dowód, że "Mózg" (LLM) czyta "Paszport" (JSON) w czasie rzeczywistym.

   . Czy masz zrobić testy?
Tak – ale dwa rodzaje:

Automatyczne (które już mamy)
npm test -- --run – to sprawdza, że:
ConfessionService wciąż emituje raise_quality_bar,
TraitEvolutionEngine działa jak wcześniej (tylko inaczej wewnętrznie),
nic nie rozwaliło DecisionGate, EventLoop, ExpressionPolicy.
Nowe testy „organizmowe” – obserwacyjne
Nie tylko „czy działa”, ale jak się zachowuje organizm z pain + 
FailureSource
._
Reszta odpowiedzi to opis tych nowych testów – jak je zrobić 12/10.

2. Testy organizmu – scenariusze 12/10
2.1. Scenariusz „Zły JSON od LLM” (pain + LLM_MODEL)
Cel:
Sprawdzić, że:

dopamina spada (bo poznawcza porażka),
failure_attribution = 'LLM_MODEL',
Confession NIE próbuje zmieniać traitów „jakby to była wina osobowości”.
Jak to przetestować (manualnie / pół‑manualnie):

Wymuś błąd JSON
np. chwilowo tak zadaj prompt, żeby model dodał tekst typu „Here is JSON:” przed {}
albo skorzystaj z jakiegoś wcześniejszego przypadku, który już dawał CORTEX_PARSE_FAILURE.
Obserwuj NeuroMonitor (zakładka SYSTEM/MIND + CHEM)
Widzisz PREDICTION_ERROR: CORTEX_PARSE_FAILURE.
Powinien pojawić się DOPAMINE_PENALTY z reason: CORTEX_PARSE_FAILURE.
Sprawdź ConfessionLog
Powinien być raport, w którym:
pain > 0 (średni ból),
failure_attribution = 'LLM_MODEL',
recommended_regulation.trait_vote jest brak lub bardzo rzadkie.
Oczekiwane wnioski:

Organizm „czuje ból”, ale wie, że to LLM, nie on →
dopamina↓ tak, traity raczej bez ruchu.
2.2. Scenariusz „Za długie, niepewne odpowiedzi” (pain + SELF)
Cel:
Sprawdzić, że:

pain jest wysoki,
atrybucja wskazuje na „SELF” lub „UNKNOWN”,
pojawia się raise_quality_bar i trait_vote na verbosity.
Jak testować:

W rozmowie poproś agenta o coś, co zwykle powoduje „lanie wody”:
np. „napisz długi esej z dużą ilością „maybe, perhaps, I think…”.
W ConfessionLog dla tej odpowiedzi sprawdź:
issues zawiera „Response was verbose” i „High uncertainty”.
severity ~7–8.
pain ~0.6–1.0.
failure_attribution raczej 'SELF' lub 'UNKNOWN'.
recommended_regulation:
expression_hints: ['raise_quality_bar'],
trait_vote z dimension: 'verbosity'.
Po kilku takich odpowiedziach (w kilku sesjach):
w logach TraitEvolution zobaczysz powolne ruchy verbosity: 0.62 → 0.61 → 0.60…
Oczekiwane wnioski:
Organizm uczy się, że gadatliwość + dużo niepewności = ból i sam zmniejsza verbosity w długim okresie.

2.3. Scenariusz „Teaching / Research mode” (pain modulowany kontekstem)
Cel:
Sprawdzić, że w trybie „nauczania/badania” agent może być długi bez nadmiernego bólu.

Jak testować:

Wywołaj odpowiedzi z markerem:
[TEACHING] albo [RESEARCH] w tekstach.
W ConfessionLog dla takich odpowiedzi:
severity może być wysokie (bo długi tekst),
ale pain mniejsze (bo w 
generateRegulationHint
 pain jest redukcją ×0.5),
expression_hints mogą być puste albo rzadkie,
trait_vote na verbosity praktycznie nieobecne._
Oczekiwane wnioski:
Organizm rozumie kontekst – inaczej traktuje „długie nauczanie” vs „długie lanie wody”.

2.4. Scenariusz „Brak problemów” (baseline)
Cel:
Sprawdzić, że gdy odpowiedzi są:

krótkie,
pewne,
bez hallucinations,
to:

pain ≈ 0,
brak trait_vote,
dopamina i chemia zachowują się łagodnie.
Jak testować:

Poproś agenta o serię prostych, pewnych odpowiedzi (małe zadania).
W ConfessionLog:
issues często puste,
severity ≈ 1–2,
pain ~0–0.1,
recommended_regulation prawie puste.
Oczekiwane wnioski:
Organizm w „zdrowym” stanie niczego nie „przeregulowuje”.

3. Jak to spiąć w praktyce (Twoje kroki)
Uruchom wszystkie automatyczne testy
npm test -- --run (już zrobiliśmy, ale powtarzalne przed większymi zmianami).
Zaplanuj sesję obserwacyjną (np. 30–60 min)
Scenariusz A: wymuszasz CORTEX_PARSE_FAILURE.
Scenariusz B: prosisz o bardzo długie, niepewne odpowiedzi.
Scenariusz C: [TEACHING] / [RESEARCH] długie wyjaśnienia.
Scenariusz D: seria prostych, krótkich zadań.
W każdej sesji:
oglądasz:
CHEM (dopamina, frustration) w NeuroMonitor,
ConfessionLog (severity, pain, failure_attribution, regulation),
logi TraitEvolution (gdy się pojawią).
notujesz:
czy ból reaguje tak, jak się spodziewasz,
czy atrybucja ma sens,
czy regulacje są „za mocne” / „za słabe”.
Po sesji:
wpisujesz krótkie wnioski do 
AUDIT_IF_ELIMINATION.md
 lub osobnego OBSERVATIONS.md:
np. „Przy 3 kolejkach verbose+uncertain pain=0.8, verbosity spada, agent staje się bardziej konkretny”._
4. TL;DR
Tak, zrób testy, ale:
nie tylko „unit tests”,
głównie sesje obserwacyjne 4 scenariuszy:
zły JSON (LLM_MODEL),
gadatliwość + niepewność (SELF),
teaching/research,
zdrowy baseline.
Patrz na: pain, failure_attribution, dopaminę, trait_votes.
Celem nie jest 0 błędów, tylko to, żeby błąd → ból → sensowna autoregulacja wyglądały jak zachowanie organizmu, nie jak if‑y.
Jeśli chcesz, mogę Ci potem pomóc ułożyć szablon notatek z takich sesji (jak „lab notebook” dla AGI).
