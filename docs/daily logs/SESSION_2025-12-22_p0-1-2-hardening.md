# Session Log: 2025-12-22 (P0.1.2 hardening)

## Kontekst
Cel: dowieźć P0.1.2 stabilizacji tak, żeby agent mniej „gadał”, a bardziej wykonywał deterministyczne kroki i żeby debug był tani.

## Zmiany (co i po co)
- Artifacts: jedna brama `normalizeArtifactRef()` (ID lub nazwa) → koniec `ARTIFACT_ID_INVALID` przy pracy na nazwach.
- Autonomia: repertuar ograniczony do `WORK`/`SILENCE` + `SILENCE` nie nabija backoffu.
- Action-First: rozpoznaje polskie polecenia bez diakrytyków (`utworz/stworz/zrob`) + generuje nazwę `.md` z frazy.
- Token audit: metryka `CORTEX_PROMPT_STATS` (rozmiar promptu + skład stanu) do diagnozy skoków 5k–7k tokenów.
- RawContract: fail-closed, ale dopuszcza bezpieczne obwiednie (`{...}`, fenced JSON, double-encoded JSON string).

## Weryfikacja
- `npm run build` PASS
- `npm test` PASS (588/588)

## Wnioski
Artefakty jako „warsztat” są użyteczne dopiero, gdy autonomia ma realne ręce: READ_FILE/SEARCH_IN_REPO + work-loop (dowód → patch → verify). W tej sesji dowieźliśmy stabilność i narzędzia diagnostyczne; następny krok to przestawienie autonomii na internal-execution (AgentTrajectory / WorkLoop).
