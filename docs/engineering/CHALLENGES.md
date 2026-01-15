# 🧬 Historia Wyzwań: Droga do AGI 11/10

> **Cel dokumentu:** Żywa historia problemów, ślepych zaułków, przełomów i lekcji w tworzeniu AK-FLOW.  
> **Dla kogo:** Przyszłe publikacje naukowe, zespół, przyszłe ja.  
> **Format:** Problem → Próby → Rozwiązanie → Lekcje → Meta-analiza

## Gdzie co logować (żeby nie mnożyć plików)

- **ARCH / opis działania systemu (do pracy mgr/dok):** `docs/SYSTEM_MANIFEST.md`
- **Mapa przepływu (skrótowy diagram/flow):** `docs/architecture/ARCHITECTURE_MAP.md`
- **Zmiany z dnia + testy + co dalej:** `docs/daily logs/YYYY-MM-DD.md`
- **Historia problemów (ten plik):** tylko gdy pojawia się *nowy* problem lub przełom

---

## Statystyki

| Metryka | Wartość |
|---------|---------|
| Rozwiązanych problemów | 22 |
| Całkowity czas | ~52 godzin |
| Średnia trudność | 4.0/5 |
| Największy przełom | FactEcho Guard (FAZA 6.0) |
| Najdłuższy problem | Monolityczny Kernel (8h) |

---

## Problem #30: Gate Desync & Domain Mismatch in User-Facing Turns

**Data:** 2026-01-15
**Trudność:** 4/5
**Status:** ROZWIAZANY (v8.1.1 Refinement)

### Objawy
- Agent po wykonaniu narzędzia (np. READ_FILE) czasem milczał, mimo że powinien domknąć pętlę komentarzem.
- Narzędzia world były wykonywane, ale kernel nie zawsze o tym wiedział w czasie rzeczywistym (desync `lastTool`).
- Brak blokady przy "mismatchu" domeny (oczekiwany WORLD, wykonany LIBRARY).

### Diagnoza
- `isUserFacing` w `ExecutiveGate` nie brał pod uwagę świeżego wyniku narzędzia jako "interakcji z użytkownikiem".
- `TOOL_ERROR` i `TOOL_RESULT` w `useCognitiveKernelLite` nie zawsze dispatchowały do kernela te same metadane co pakiety sukcesu.
- Brak twardych reguł `DOMAIN_MISMATCH` w bramce mowy.

### Rozwiązanie
- **Refined isUserFacing**: teraz uwzględnia `Date.now() - ctx.lastTool.at < 2000` oraz `traceId` continuity.
- **Kernel sync**: Dispatching `TOOL_RESULT` dla wszystkich stanów końcowych narzędzia (success, error, timeout).
- **Executive Gate hardened**: 
  - `SPEECH_REQUIRED_AFTER_TOOL_SUCCESS` dla ticków user-facing.
  - `DOMAIN_MISMATCH` block z logowaniem `DOMAIN_MISMATCH_BLOCKED_SPEECH`.
- **Domain Verification**: Kernel liczy `domainMatch` na podstawie `domainExpected` vs `domainActual`.

### Pliki
- src/core/kernel/reducer/handlers/toolResult.ts
- src/core/systems/ExecutiveGate.ts
- src/core/systems/EventLoop.ts
- src/hooks/useCognitiveKernelLite.ts
- src/core/trace/TraceContext.ts
- __tests__/unit/ExecutiveGate.test.ts

### Lekcja
- Pętla użytkownika (Front-Loop) wymaga innych zasad niż pętla serwerowa (Back-Loop). Speech po narzędziu w trybie "frontowym" jest elementem kontraktu zaufania, a nie tylko mowy.

## Problem #29: Working memory niewidoczna + implicit anchors

**Data:** 2026-01-13
**Trudnosc:** 4/5
**Status:** ROZWIAZANY (Working memory injection + anchor resolver)

### Objawy
- Po READ_LIBRARY_DOC agent nie wiedzial "o jaka ksiazke chodzi" i robil SEARCH_LIBRARY.
- "Tutaj/tam" nie mapowalo na ostatni katalog.
- Po sukcesie toolu bywala cisza (brak odpowiedzi).

### Diagnoza
- Anchory (lastLibraryDocId/lastWorldPath/lastArtifactId) byly w stanie, ale nie w promptach.
- Brak deterministycznego resolvera dla niejawnych referencji.
- Gate mogl blokowac speech po TOOL_RESULT ok=true.

### Rozwiazanie
- Wstrzykniecie sekcji Working Memory do promptu + aktualizacja anchorow po narzedziach.
- Resolver niejawnych referencji dla library/world/artifact.
- Tool contract domkniety + odblokowanie speech po sukcesie; routing artifact UUID + telemetria world tools.

### Pliki
- src/llm/gemini/UnifiedContextPromptBuilder.ts
- src/core/systems/eventloop/ReactiveStep.ts
- src/core/systems/ExecutiveGate.ts
- src/core/systems/ActionSelector.ts
- src/tools/toolParser.ts
- src/tools/workspaceTools.ts
- __tests__/unit/WorkingMemoryState.test.ts
- __tests__/unit/LibraryAnchorResolver.test.ts
- __tests__/contracts/ToolContractGate.test.ts

### Testy
`npm test` (not rerun after fixes; earlier run failed on LibraryAnchorResolver/toolParser routing).

### Lekcja
- Stan bez promptu to brak pamieci: anchor musi byc jawny i deterministycznie mapowany.

## Problem #28: Missing TOOL_RESULT/TOOL_ERROR i niejednoznaczne sciezki world

**Data:** 2026-01-12
**Trudnosc:** 4/5
**Status:** ROZWIAZANY (Tool contract + path normalization)

### Objawy
- TOOL_INTENT bez TOOL_RESULT/TOOL_ERROR, agent "czeka na wynik".
- LIST_DIR/READ_FILE na tokenach typu "i" albo "Wej" (to nie sciezki).

### Diagnoza
- Narzedzia world nie emitowaly rezultatu w kazdej sciezce.
- Brak normalizacji sciezek i guardow na niejednoznaczne tokeny.

### Rozwiazanie
- Wymuszony kontrakt TOOL_INTENT -> TOOL_RESULT/TOOL_ERROR dla narzedzi world.
- normalizeWorldPath zwraca PATH_AMBIGUOUS zamiast throw.
- Unknown tool tag gating dla LIST_LIBRARY_CHUNKS.

### Pliki
- src/tools/workspaceTools.ts
- src/core/systems/eventloop/ReactiveStep.ts
- src/utils/toolParser.ts

### Testy
`npm test -- __tests__/unit/routingDecisionTelemetry.test.ts __tests__/unit/tools/toolParser.routing.test.ts`

### Lekcja
- Brak TOOL_RESULT jest gorszy niz error; kazdy intent musi zamknac sie wynikiem.

## Problem #27: Pending Action payload/target pollution (APPEND)

**Data:** 2025-12-31
**Trudnosc:** 3/5
**Status:** ROZWIAZANY (P0 pending hardening)

### Objawy
- `dodaj: koty...` w pending tworzylo synthetic `dopisz do art-xxx dodaj: ...` i target `art-xxx dodaj` -> ARTIFACT_NOT_FOUND.
- `dodaj do tego pliku` nie przechodzilo regexu Action-First (FUZZY_REGEX_MISMATCH).
- `Utworz plik: "utworz plik test.md"` generowalo `plik:.md`.

### Diagnoza
- Pending payload nie byl czyszczony z prefiksow typu `dodaj:`/`dopisz:`.
- APPEND regex pozwalal na spacje w target, co wciagalo payload do targetu.
- Brak implicit reference matching + zbyt agresywne supersede pending.
- Ekstrakcja filename brala token przed `:`.

### Rozwiazanie
- Czyszczenie prefiksow payloadu w pending synthetic commands.
- Guard na spacje w target + implicit reference detection.
- Sanityzacja filename dla CREATE; ograniczenie supersede do hard targetow.
- JSON repair: dangling key fix + testy scenariuszy pending/append/create.

### Pliki
- src/core/systems/eventloop/pending/pendingAction.logic.ts
- src/core/systems/eventloop/reactiveStep.helpers.ts
- src/core/systems/eventloop/ReactiveStep.ts
- src/core/inference/AIResponseParser.ts
- __tests__/integration/ActionFirst.test.ts
- __tests__/unit/AIResponseParser.test.ts

### Testy
`npx tsc --noEmit`, `npm test`, `npm run build`

### Lekcja
- Payload po prompcie nie moze psuc targetu; regexy musza trzymac jeden token target.

---

## Problem #26: P0.2 Action-First + Cortex reliability gaps

**Data:** 2025-12-30
**Trudnosc:** 3/5
**Status:** ROZWIAZANY (P0.2 hardening)

### Objawy
- Action-First: brak payloadu powodowal puste CREATE/APPEND albo fallback do LLM.
- LLM JSON bywal ucinany lub pusty; brak telemetry dla invalid structure.
- Semantic recall dostawal sztuczne timestamps, psujac filtry zakresu.
- UI error toast nie pojawial sie w logach mimo user-facing bledow.

### Diagnoza
- Brak fallbacku/promptu dla pustego payloadu.
- Telemetria parse failure tylko w catch; limit output tokens zbyt niski.
- MemoryService zwracal "now" zamiast created_at.
- isUserFacingError nie zawsze wykrywal bledy.

### Rozwiazanie
- Payload fallback/placeholder + regexy PL/EN w Action-First.
- Telemetria parse failure dla empty/invalid + wyzszy maxOutputTokens.
- Semantic recall: uzycie realnych timestampow z DB.
- Lepsza detekcja UI error toast.
- DreamConsolidation: dodane szczegoly epizodow.

### Pliki
- src/core/systems/eventloop/ReactiveStep.ts
- src/core/inference/CortexInference.ts
- src/llm/gemini/CortexTextService.ts
- src/services/supabase.ts
- src/core/runner/KernelEngineRunner.ts
- src/services/DreamConsolidationService.ts

### Testy
`npm test` (reported), `npm run build` (reported)

### Lekcja
- Telemetry early and safe fallbacks prevent silent failures.

---

## Problem #25: Assistant-speak i persona drift

**Data:** 2025-12-23
**Trudnosc:** 2/5
**Status:** ROZWIAZANY (Persona Contract + guard)

### Objawy
- Odpowiedzi zbyt 'asystenckie' (np. 'jak moge pomoc'), bez twardego oparcia w faktach.

### Diagnoza
- Brak twardego kontraktu zachowania w promptach.
- Guard nie wykrywal genericznych fraz pomocowych.

### Rozwiazanie
- Dodano Persona Contract do promptu (evidence-first, brak assistant-speak).
- PersonaGuard wykrywa assistant-speak i wymusza retry.

### Pliki
- src/core/context/UnifiedContextBuilder.ts
- src/core/systems/PersonaGuard.ts
- docs/architecture/PERSONA_CONTRACT.md

---

## Problem #24: Strict Grounded Mode — provenance confusion + parse fallback

**Data:** 2025-12-17
**Trudność:** 3/5
**Status:** 🟡 Częściowo rozwiązany (provenance/parse fallback fixed; DETECT_INTENT NO_JSON nadal otwarte)

### Objawy
- W strict mode pojawiały się nieczytelne/mylące etykiety źródeł (np. `EVID:MEMORY` przy zachowaniu systemowym).
- Przy błędach parsowania JSON z LLM użytkownik dostawał twardy fallback po angielsku, bez jasnego powodu.

### Diagnoza
1. Fallback parsowania jest hardcoded i trafia do pipeline bez dodatkowego doprecyzowania metadanych.
2. Brak granularnego rozróżnienia "memory z SEARCH" vs "episodic/other" w warstwie UI powodował mylne wnioski.
3. Dodatkowo `DETECT_INTENT` czasem zwraca `NO_JSON` / `PARSE_ERROR` (osobny kontrakt do utwardzenia).

### Rozwiązanie (część 1: observability)
- Dodano `evidenceDetail` i przepchnięto przez pipeline do UI.
- Parse fallback:
  - lokalizacja na PL,
  - wymuszenie `EVID:SYSTEM(PARSE_ERROR)`.

### Otwarte (część 2: kontrakt intentów)
- `DETECT_INTENT NO_JSON` — do utwardzenia przez JSON extract/repair (jak RawContract) + fail-closed.

---

## Problem #23: Rapid Input Drop + Stale Closure (UX/KernelLite Desync)

**Data:** 2025-12-16
**Trudność:** 4/5
**Status:** ✅ Rozwiązany (FIFO Input Queue + ConversationRef Sync)

### Objawy
- Szybkie wysłanie 2 wiadomości pod rząd (np. `Enter, Enter`) potrafiło zgubić drugi input.
- Zdarzały się sytuacje, gdzie context ticka budowany był na starej rozmowie (stale closure), co psuło deterministykę i trace korelację.

### Diagnoza
Mieliśmy klasyczny konflikt concurrency w warstwie UI:
1. Guard typu `isProcessing` blokował kolejne wejścia, ale nie kolejkując ich (drop).
2. Async callbacki opierały się o snapshot `conversation` z momentu zamknięcia (closure), a nie o źródło prawdy.

### Rozwiązanie
- **FIFO queue** w `useCognitiveKernelLite`: wejścia są kolejkowane i przetwarzane sekwencyjnie.
- **`conversationRef` w sync**: źródło prawdy aktualizowane razem z `setConversation`.

### Efekt
- Brak dropów przy szybkich sendach.
- Stabilniejszy kontekst dla ticka (mniej „ghost state”).

### Pliki
- `hooks/useCognitiveKernelLite.ts`

---

## Problem #22: The Manic Spam Loop (Homeostatic Fix 6.0)

**Data:** 2025-12-15
**Trudność:** 5/5
**Status:** ✅ Rozwiązany (Hybrid + Soft Homeostasis)

### Objawy
W trybie autonomicznym agent "gadał do ściany". Mimo braku odpowiedzi użytkownika, generował 3-4 wiadomości na minutę, każda o czym innym ("Jaka pogoda?", "A może wiersz?", "System działa?").
Dopamina nie spadała, brak było "zmęczenia społecznego".

### Diagnoza (Split Brain)
Mieliśmy **Split Brain**:
1. `useCognitiveKernel` (UI) - wie o userze.
2. `EventLoop` (Autonomia) - żyje w swoim świecie `input: null`.
Brakowało mostu, który mówi Autonomii: "Hej, nikt nie odpisuje, zwolnij".

### Rozwiązanie (Soft Homeostasis)
Wdrożyliśmy system **Social Dynamics**:
1. **Social Cost:** Każda wypowiedź "kosztuje" (0.15). Koszt rośnie wykładniczo w monologu.
2. **Dynamic Threshold:** Próg wejścia rośnie, gdy użytkownik milczy (`0.6 -> 0.9`).
3. **Budget:** Agent ma budżet (1.0). User refilluje budżet odpisując.

Efekt: Agent mówi raz, drugi... i cichnie. Czeka. Jak user odpisze -> BOOM, ulga (cost / 2), budżet refill.
To naturalna, biologiczna regulacja rozmowy.

### Pliki
- `core/kernel/types.ts` - SocialDynamics interface
- `core/kernel/reducer.ts` - Logika decay/growth
- `core/systems/EventLoop.ts` - `shouldSpeakToUser` gate

### Dokumentacja
- `docs/architecture/SOCIAL_DYNAMICS.md` (opis mechanizmu + testy + config)

### Testy (basic)
```bash
npm test -- --run __tests__/integration/SocialDynamics.test.ts
```

### Konfiguracja
- `core/config/systemConfig.ts` → `SYSTEM_CONFIG.socialDynamics`
- `core/config/systemConfig.ts` → `SYSTEM_CONFIG.styleGuard` (domyślnie OFF dla testów ewolucji osobowości)

### Lekcja
**Rigid Cooldowns < Soft Homeostasis.**
Sztywne "max 1 message/min" są nudne. Biologiczne "zmęczenie monologiem" jest naturalne i pozwala na krótkie serie (bursts), ale blokuje spam.

---

## Problem #21: System Determinism & Error Handling (The Stability Gap)

**Data:** 2025-12-15
**Trudność:** 3/5
**Status:** ✅ Rozwiązany (RNG Injection + Global Boundary)

### Objawy
System był trudny do debugowania, ponieważ decyzje probabilistyczne (np. czy wejść w REM cycle) były oparte na `Math.random()`. Dodatkowo, błąd w jednym komponencie Reacta wywalał całą aplikację (White Screen).

### Rozwiązanie
1. **Deterministic RNG**: Wstrzyknięcie `createRng(seed)` do wszystkich systemów decyzyjnych (`DecisionGate`, `ExpressionPolicy`).
2. **Global Error Boundary**: `ComponentErrorBoundary` łapie błędy w `CognitiveInterface` i pozwala na graceful recovery bez przeładowania strony.

### Lekcja
**Determinizm to nie opcja, to wymóg.** Aby debugować AGI, musisz móc odtworzyć ten sam "rzut kością" dwa razy. RNG musi być centralnie zarządzane.

---

## Problem #20: The Double Brain Race Condition (Schizophrenic Loop)

**Data:** 2025-12-13
**Trudność:** 5/5
**Status:** 🧬 Zdiagnozowany (Plan Naprawy: Unified Input Queue)

### Objawy
Agent odpowiadał na input użytkownika ("Jaka pogoda?"), a 10ms później dorzucał losową, niepowiązaną myśl ("Mam ochotę napisać wiersz").
User widział:
> U: Jaka pogoda?
> A: Jest słonecznie.
> A: Czasoprzestrzeń jest iluzją.

### Diagnoza (The Split Brain)
Odkryliśmy fundamentalny błąd w architekturze współbieżności:
1.  **Lewa Półkula (`processUserInput`):** Reaguje na event w Reactcie. Szybka, bezstanowa.
2.  **Prawa Półkula (`EventLoop.tick`):** Działa w interwale (co 3s). Nie wie o eventach Reacta.

Gdy tick wypadał tuż po inpucie uytkownika, `EventLoop` widział `input: null` (bo React już obsłużył input), więc uznawał: "Cisza. Nudzę się. Odpalam myśl autonomiczną".

### Lekcja
**Event Loop musi być Single Source of Truth dla czasu.**
Nie można mieć dwóch niezależnych pętli przetwarzania (React Event + Interval Tick). Input użytkownika musi wpadać do **kolejki** Event Loopa, a nie być przetwarzany "na boku".

---

## Problem #19: Identity Cache Timebomb (The 5-Minute Panic)

**Data:** 2025-12-13
**Trudność:** 4/5
**Status:** ✅ Rozwiązany (Refresh Loop)

### Objawy
Agent działał idealnie przez pierwsze minuty, a dokładnie w 5:00 minucie wpadał w nagłą panikę:
- **Fear:** skok do 0.95
- **Curiosity:** spadek do 0
- **Self-Perception:** `UNINITIALIZED_AGENT`

### Diagnoza
Problem nie leżał w logice emocji, ale w **infrastrukturze cache**.
Tożsamość była cache'owana w pamięci z TTL (Time To Live) ustawionym na 5 minut. Po wygaśnięciu cache'u, `CortexStateBuilder` zwracał pusty obiekt tożsamości, co Kernel interpretował jako utratę "ja" (śmierć ego).

### Rozwiązanie
Zamiast wydłużać TTL w nieskończoność (co grozi stale identities), wdrożyliśmy mechanizm **Active Refresh**:
1.  **TTL:** Zwiększono do 30 min (bezpiecznik).
2.  **Heartbeat:** W każdym cyklu kognitywnym (`cognitiveCycle`, co ~3s) wywoływane jest `refreshIdentityCache(agentId)`.
3.  Dopóki agent "yje" (pętla działa), cache jest podtrzymywany. Wygasa tylko gdy agent faktycznie śpi/jest wyłączony przez >30 min.

### Pliki
- `core/builders/MinimalCortexStateBuilder.ts` - logic refresh
- `hooks/useCognitiveKernel.ts` - integracja z pętlą

### Lekcja
**Tożsamość to proces, nie statyczny plik.** Nie można "załadować tożsamości raz". System musi aktywnie podtrzymywać swoją tożsamość w każdym cyklu ("Cogito, ergo sum" w praktyce - myślę, więc odświeżam cache).

---

## Problem #18: Regex Hell (The Fact Validation Nightmare)

**Data:** 2025-12-10
**Trudność:** 5/5
**Status:** ✅ Rozwiązany (FactEcho Architecture 13/10)

### Objawy
PersonaGuard używał regexów do walidacji faktów:
- "23" vs "23%" vs "dwadzieścia trzy" vs "około 23"
- Wszystkie są poprawne semantycznie, ale regex tego nie ogarnie
- False positives przy każdej odpowiedzi w naturalnym języku

### Diagnoza
Walidacja faktów na podstawie tekstu naturalnego jest **niemożliwa** do zrobienia dobrze.
Potrzebowalibyśmy:
- Setki reguł regex
- Lub drugiego LLM do walidacji (wolne ×2)
- Lub karania agenta za poprawne odpowiedzi

### Rozwiązanie (FactEcho Architecture)
LLM MUSI zwrócić `fact_echo` jako osobne pole JSON:
```typescript
{
  speech_content: "Mam dwadzieścia trzy procent energii...",
  fact_echo: { energy: 23 }  // ← Guard porównuje TO
}
```

Guard sprawdza: `fact_echo.energy === hardFacts.energy`
**ZERO regexów. Czyste porównanie JSON.**

### Pliki
- `core/systems/FactEchoGuard.ts` - JSON-based guard
- `core/systems/FactEchoPipeline.ts` - Production wrapper
- `core/types/CortexOutput.ts` - FactEcho interface
- `core/prompts/MinimalCortexPrompt.ts` - FACT ECHO ARCHITECTURE section

### Lekcje
- **Structured Output > Natural Language:** Wymuś JSON tam gdzie potrzebujesz precyzji
- **LLM Echo > LLM Parse:** Łatwiej kazać LLM powtórzyć fakt niż parsować jego odpowiedź
- **Separation of Concerns:** speech_content dla człowieka, fact_echo dla maszyny

### Meta-analiza
To był moment gdy zrozumieliśmy, że AGI potrzebuje **dwóch kanałów komunikacji**:
1. Kanał dla człowieka (naturalny język, emocje, styl)
2. Kanał dla systemu (JSON, fakty, metryki)

Guard nie dotyka polszczyzny - porównuje liczby. To jest 13/10.

---

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
