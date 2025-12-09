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
   - [ ] Agent zmienia styl odpowiedzi na krótszy/bardziej "szorstki" (jeśli `mood_shift` działa).
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
   - [ ] Po 10-20 sekundach w logach (konsola/terminal) pojawia się info o `Consolidation`.

---

## 🚨 Co robić jak nie działa?
1. Sprawdź czy flaga `USE_MINIMAL_CORTEX_PROMPT` jest `true` w `core/config/featureFlags.ts`.
2. Sprawdź konsolę przeglądarki (F12) pod kątem czerwonych błędów sieci (Network).
