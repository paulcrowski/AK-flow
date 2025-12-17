---
description: Procedura Zamknięcia Dnia (AK-FLOW)
---

# 🌙 Procedura Zamknięcia Dnia

Wykonuj to na końcu każdej sesji pracy.

## 1) TESTY

Uruchom:

- `npm run build`
- `npm test`

Wszystkie muszą przechodzić przed commitem.

## 2) WIRING VALIDATION

- Uruchom `npm run dev` i sprawdź logi przy starcie
- Sprawdź czy `validateWiring()` pokazuje wszystko `ACTIVE`

## 3) DAILY LOG

Zaktualizuj:

- `docs/daily logs/YYYY-MM-DD.md`

Dopisz:

- co zrobione
- jak zweryfikowane (build/test)
- co dalej

## 4) CHALLENGES (tylko gdy zaszło „nowe zjawisko”)

Jeśli był nowy problem / przełom: dopisz do:

- `docs/engineering/CHALLENGES.md`

## 5) ARCH DOCS (tylko gdy zmienił się flow/kontrakt)

- `docs/SYSTEM_MANIFEST.md` → zaktualizuj sekcję „What’s New”
- `docs/architecture/ARCHITECTURE_MAP.md` → dodaj krótki wpis / link

## 6) NEXUS (ak-flow-state.json)

Zaktualizuj w `ak-flow-state.json`:

- `lastModified`
- dodaj note: `Daily Close: YYYY-MM-DD` (krótko: co, testy, co dalej)
- zaktualizuj `stats.testsTotal/testsPassing`

## 7) COMMIT CLOSE

Jeden commit = jedna spójna zmiana + testy + wpis w daily log.

- `git add .`
- `git commit -m "feat(faza6): short summary"`
- `git push`

## 8) TOMORROW NOTE

- dopisz 1-3 punkty w daily log
- opcjonalnie: przenieś taski w `ak-flow-state.json`
