# SESSION: 2025-12-17 — Grounded Strict Mode + Provenance + Dream Topic Shards

## Cel sesji
- Ustabilizować strict grounded mode (bez halucynacji i bez mylących fallbacków)
- Uczytelnić provenance w UI (`EVID:*` + detale)
- Wzmocnić konsolidację snu tak, żeby zostawiała pamięć tematów (np. fizyka)

---

## Zmiany (Architektura → Stan → Dynamika → UI)

### Architektura
- Strict mode: jawny pipeline „evidence-first” (memory/tool/system), bez treningowego fallbacku.
- Dream: topic shards jako osobny rodzaj pamięci (`origin:dream`, `kind:TOPIC_SHARD`).

### Stan
- Nowy feature flag: `USE_DREAM_TOPIC_SHARDS`.
- Nowe metadane rozmowy: `evidenceDetail` (UI provenance).

### Dynamika
- Parse fallback lokalizowany + oznaczany jako `SYSTEM(PARSE_ERROR)`.
- Topic shards:
  - Wejście: `recallRecent(60)`
  - Wyjście: max 3 wpisy `TOPIC_SHARD: <topic>`
  - Homeostaza: cooldown 12h + clamp strength 14..24

### UI
- Badge provenance pokazuje `EVID:<SOURCE>(<DETAIL>)`.

---

## Weryfikacja
- `npm run build` ✅ PASS
- `npm test` ✅ PASS (514/514)

---

## Commit / Delivery
- `5192ccd` dream: dream consolidation

---

## Otwarte tematy
- `DETECT_INTENT NO_JSON` — wymaga hardeningu kontraktu.
