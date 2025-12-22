# Audyt autonomii i kierunków rozwoju (13/10)

**Data:** 23.03.2025

## Kierunek strategiczny
- Postaw na jeden autonomiczny kernel zamiast kolonii agentów. Priorytetem jest sterowanie cyklem pracy (scheduler) i dowód działania w postaci artefaktów.
- Wybierz jeden tryb na iterację (artefakt-first / problem-first / explore-first) i trzymaj go przez pełny cykl, zamiast łączyć kilka modeli pracy naraz.
- Shadow-output kieruj do plików roboczych; interfejs dla człowieka ma być oszczędny, co ograniczy szum i ułatwi ocenę sprawczości.

## Wyzwania systemowe (techniczne)
- **Stabilność EventLoop/DecisionGate:** pętla ticków musi jasno odróżniać sense/decide/act/write/rest, inaczej autonomy = chat. Potrzebny twardy kontrakt na to, kiedy agent kończy tick.
- **Artefakt jako kontrakt:** jeśli narzędzia (tool tags) zwracają duże payloady, trzeba nadal pilnować chunków i limitów, żeby nie destabilizować promptu.
- **Observability:** EventBus powinien raportować powody STOP/REST. Bez tego scheduler nie będzie audytowalny.
- **Testy regresyjne:** utrzymuj minimalny zestaw scenariuszy (2 tickery × 2 interwały) oraz fallback bez wolumenu dla sygnałów rynkowych.

## Ryzyka produktu
- Nadmiar trybów (kolonia, multi-procesy) przed ugruntowaniem jednego loopu zwiększa koszt debugowania i rozmywa tożsamość produktu.
- Brak “dowodów życia” (artefakty) w codziennej pracy sprawi, że system będzie postrzegany jak kolejny chatbot.
- Zbyt rozmowny UI odbiera poczucie autonomii i zaciera granicę między myślą a wykonaniem.

## Atuty rynkowe do wzmocnienia
- **Ciągłość i pamięć robocza:** przewaga nad LLM-ami reaktywnymi. Eksponuj to w narracji produktu.
- **Artefakt-first workflow:** każde działanie kończy się plikiem/patch-em/raportem — to mierzalne outputy, których nie oferują klasyczne chatboty.
- **Modularne narzędzia (tool tags + LibraryService):** umożliwiają szybkie dodawanie domen (research, trading, kod). Komunikuj to jako „plug-iny pracy”.

## Sugerowane kolejne kroki (małe, atomowe)
1. **Loop v1:** zaimplementuj minimalny scheduler (sense → decide → act → write → rest) z logowaniem powodów decyzji w artefakcie.
2. **Tryb diagnostyczny:** wprowadź debugMode, który pokazuje na wykresie (plot/label) decyzje ticków i statusy filtrów bez zmiany logiki sygnału.
3. **Checklista wdrożeniowa:** przed oznaczeniem wersji jako `-final` przejdź listę: ≥2 tickery, ≥2 interwały, fallback bez wolumenu, weryfikacja cooldownów i filtrów.
4. **Snapshoty wersji:** po stabilnej iteracji zapisuj stan jako `vX.Y-final` (komentarz w kodzie + snapshot pliku), żeby łatwo robić rollback i porównania wizualne.

## Alternatywy, gdy autonomia „nie klika”
- **Tool-first agent:** wymuś ścieżkę READ/SEARCH → CREATE → PATCH przed generowaniem tekstu dla usera.
- **Shadow agent (bez multi-agentów):** generuj równolegle output publiczny i roboczy (do pliku). Pomaga dyscyplinować myśl/wykonanie bez budowy kolonii.
- **Problem-first pipeline:** agent codziennie generuje listę problemów z priorytetem i dopiero potem realizuje wybrane zadanie — dobre do researchu i tradingu.

## Minimalny test 24h (regresja)
- Wybierz jeden tryb (artefakt-first/problem-first/explore-first) i obserwuj 3 sygnały: czy powstał plik, czy agent wrócił do niedokończonego artefaktu, czy potrafił przerwać pracę z podaniem powodu.
- Jeśli wynik <2/3, wróć do uproszczenia loopu i ogranicz liczbę aktywnych feature flagów.
