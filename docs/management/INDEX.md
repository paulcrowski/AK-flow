# 📚 AK-FLOW Documentation Hub

> *"Porządek jest fundamentem mądrości."* - Konfucjusz
> 
> Ostatnia aktualizacja: **2025-12-12** | Wersja: **ALARM-3-STABLE**

---

## 🎯 SZYBKI START

| Potrzebujesz... | Idź do... |
|-----------------|-----------|
| Zrozumieć architekturę | [ARCHITECTURE_MAP.md](./ARCHITECTURE_MAP.md) |
| Dodać nową funkcję | [PROCEDURES.md](./PROCEDURES.md) |
| Sprawdzić co włączone | [FEATURE_FLAGS.md](./FEATURE_FLAGS.md) |
| Zobaczyć postęp | [STATUS.md](./STATUS.md) |
| Debugować problem | [DATABASE_QUERIES.md](./DATABASE_QUERIES.md) |

---

## 📁 STRUKTURA DOKUMENTACJI

```
docs/
├── 📋 INDEX.md              ← JESTEŚ TUTAJ
├── 📊 STATUS.md             ← Gdzie jesteśmy? Co działa?
├── 🔧 PROCEDURES.md         ← Jak dodawać nowe funkcje
├── 🎛️ FEATURE_FLAGS.md      ← Co jest włączone/wyłączone
│
├── 🏗️ architecture/         ← Jak system działa
│   ├── ARCHITECTURE_MAP.md
│   ├── SYSTEM_MANIFEST.md
│   └── PERSONA_LESS_CORTEX.md
│
├── 🔬 research/             ← Pomysły i eksperymenty
│   └── (pliki badawcze)
│
├── 📅 daily-logs/           ← Historia sesji
│   └── SESSION_LOG_YYYY_MM_DD.md
│
└── 🗄️ archive/              ← Stare dokumenty
    └── (legacy docs)
```

---

## 🚦 AKTUALNY STATUS PROJEKTU

### Faza: **INŻYNIERYJNA** (post-ALARM-3)

| System | Status | Uwagi |
|--------|--------|-------|
| PersonaGuard | ✅ ACTIVE | Wpięty w CortexSystem |
| FactEchoPipeline | ✅ ACTIVE | HardFacts validation |
| Dopamine RPE | ✅ ACTIVE | Decay działa |
| Central Config | ✅ ACTIVE | systemConfig.ts |
| Wiring Validator | ✅ ACTIVE | 7 systemów sprawdzanych |
| Identity (Jesse) | ✅ FIXED | Nie ma więcej "Assistant" |

### Testy: **318 passed** ✅

---

## 📜 PROCEDURY (OBOWIĄZKOWE)

### Przed każdym wdrożeniem:
```bash
npm test -- --run
npm run dev  # sprawdź logi przy starcie
```

### Dodając nową funkcję:
→ Zobacz [PROCEDURES.md](./PROCEDURES.md)

### Zamykając dzień:
→ Zobacz sekcja "Procedura Zamknięcia Dnia" w [PROCEDURES.md](./PROCEDURES.md)

---

## 🗺️ ROADMAP (skrót)

| Faza | Opis | Status |
|------|------|--------|
| 1-3 | Podstawowa architektura | ✅ DONE |
| 4 | Chemical Soul / Dopamine | ✅ DONE |
| 5 | ALARM-3 Stabilizacja | ✅ DONE |
| 6 | Observability Dashboard | 🔜 NEXT |
| 7 | WorldResponse Architecture | 📋 PLANNED |

Pełny roadmap: [ROADMAP_AGI_PHASES.md](./architecture/ROADMAP_AGI_PHASES.md)

---

## 📞 KONTAKT Z PRZESZŁOŚCIĄ

Jeśli szukasz czegoś starego:
- Stare sesje: `docs/daily-logs/`
- Stare pomysły: `docs/archive/`
- Stare audyty: `docs/archive/`

---

*Dokumentacja to pamięć projektu. Szanuj ją.*
