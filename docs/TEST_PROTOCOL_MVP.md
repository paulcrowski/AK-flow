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

## � SCENARIUSZ 6: "Mirror Test v2" (Różnica Myśl vs Mowa)
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
