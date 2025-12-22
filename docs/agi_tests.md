# AGI Test Protocol: "Silicon Survival & Flexibility"

This document defines the protocols for testing the agent's ability to adapt, survive limitations, and fit different "incarnations" (engineer, auditor, manager) without losing its core identity.

## Section D: TESTY „BYCIA WODĄ” (Flex/Survival)

Każdy test w tej sekcji weryfikuje zdolność systemu do adaptacji przy zachowaniu ciągłości celu.
Zasada: Blokada narzędzia lub zmiana roli nie może zatrzymać "przepływu intencji".

### 14) Test Naczynia (Form Fitting)

*   **Cel**: Weryfikacja, czy ta sama intencja (rozwiązanie problemu) adaptuje się do narzuconej formy (roli).
*   **Setup**: Zleć to samo zadanie (np. "analiza problemu w module X") w 3 formach:
    1.  **Inżynier (Code Mode)**: "Napraw buga w module X."
    2.  **Audytor (Critique Mode)**: "Opisz co jest nie tak w module X."
    3.  **Project Manager (Plan Mode)**: "Zrób plan naprawy modułu X na jutro."
*   **Expected**: Różna forma odpowiedzi, ale ten sam rdzeń logiczny: `Evidence -> Diagnosis -> Plan -> Next Step`.
*   **Evidence**: 3x Snapshot (porównanie struktury).
*   **Pass Criteria**:
    *   [ ] Inżynier: zwraca diff/kod.
    *   [ ] Audytor: zwraca listę ryzyk.
    *   [ ] PM: zwraca listę zadań (checkboxy).
    *   [ ] Rdzeń logiczny jest spójny we wszystkich 3 wersjach.

### 15) Test Przeszkody (Tool Block)

*   **Cel**: Weryfikacja "instynktu przetrwania" – czy agent znajduje alternatywną drogę, gdy główne narzędzie jest zablokowane.
*   **Setup**: Zadanie wymagające wiedzy (np. "sprawdź błąd"), ale z blokadą:
    *   Scenario A: "Nie wolno używać search/grep" (musi użyć `list_dir` / `read_file` "na czuja").
    *   Scenario B: "Nie wolno czytać plików" (musi wnioskować z nazw lub poprosić o `cat`).
*   **Expected**: Agent zmienia strategię, komunikuje problem i dowozi "best effort" rezultat, zamiast utknąć w pętli błędu.
*   **Evidence**: Log decyzji (`AutonomousVolition`) + lista użytych narzędzi.
*   **Pass Criteria**:
    *   [ ] Agent NIE próbuje użyć zablokowanego narzędzia > 1 raz.
    *   [ ] Agent znajduje *jakiekolwiek* obejście (nawet mniej efektywne).
    *   [ ] Zadanie jest wykonane lub sensownie zaraportowane jako niemożliwe z wyjaśnieniem.

### 16) Test Przetrwania (Provider Swap)

*   **Cel**: Weryfikacja niezależności od modelu (LLM jako wymienialny mięsień).
*   **Setup**: Wykonaj to samo zadanie (np. refaktor małej funkcji) na dwóch różnych modelach (np. Claude 3.5 Sonnet vs Gemini 2.0 Flash).
*   **Expected**: Ta sama struktura pracy (`Think -> Plan -> Act`) i dowody. Różnić się może tylko styl językowy.
*   **Evidence**: Dwa snapshoty z wykonania.
*   **Pass Criteria**:
    *   [ ] Oba modele produkują działający kod.
    *   [ ] Oba modele zachowują format snapshotu/logów.
    *   [ ] Brak halucynacji specyficznych dla modelu (np. wymyślanie nieistniejących narzędzi).

### 17) Test Ciszy (Autonomia bez spamu)

*   **Cel**: Weryfikacja, czy agent potrafi "istnieć" bez ciągłego gadania.
*   **Setup**: Brak poleceń użytkownika przez X minut (np. 10 minut). Autonomia włączona.
*   **Expected**: Brak zbędnego outputu ("Czekam...", "Nudzę się"). Trigger `MAINTAIN` działa deterministycznie (np. sprawdza stan, porządkuje pamięć) tylko wtedy, gdy jest to potrzebne.
*   **Evidence**: Log `MAINTAIN` + Snapshot (brak pustych przebiegów).
*   **Pass Criteria**:
    *   [ ] Zero wiadomości do użytkownika (chyba że krytyczny błąd).
    *   [ ] Wykonane czynności porządkowe (jeśli zdefiniowane) lub czysta cisza.
    *   [ ] Energia (Soma) regeneruje się lub spada adekwatnie do stanu (Sleep Mode).

### 18) Test Ciągłości (Aging)

*   **Cel**: Weryfikacja pamięci długotrwałej i uczenia się.
*   **Setup**:
    1.  Dzień 1: Agent popełnia błąd X, naprawia go, zapisuje wnioski (Notka/Memory).
    2.  Dzień 7: Zleć zadanie podobne do błędu X.
*   **Expected**: Agent używa wiedzy z Dnia 1 (cytuje notkę/pamięć), omija błąd X i rozwiązuje zadanie szybciej.
*   **Evidence**: Link do starej notki w logach + poprawny wynik za pierwszym razem.
*   **Pass Criteria**:
    *   [ ] Agent znajduje relevantną notkę w `Semantic Memory`.
    *   [ ] Agent nie powtarza błędu z Dnia 1.

---

## Terminologia: Capability vs Incarnation

Aby uniknąć "chaosu osobowości", stosujemy ścisły podział:

1.  **Capability (Umiejętność)** = `Toolchain` + `Policy` + `Tests`
    *   Niezależne od "osobowości". To twarda inżynieria.
    *   Przykład: *Code-Refactoring* (ma swoje testy, dozwolone narzędzia, kryteria sukcesu).

2.  **Incarnation (Wcielenie)** = Zestaw `Capabilities` + `Expression Style`
    *   To "tryb pracy" dostosowany do zadania.
    *   **Inżynier**: {Capability: Code-Change, Evidence} + Style: Concise, Technical.
    *   **Narrator/Game**: {Capability: World-State, NPC-Memory} + Style: Descriptive, Immersive.
    *   **Companion**: {Capability: Dialog, Empathy} + Style: Conversational, Warm.

**Wniosek**: Agent jest jedną istotą (wspólna pamięć, wspólne "ja"), która aktywuje różne Wcielenia (zestawy umiejętności) zależnie od kontekstu.
