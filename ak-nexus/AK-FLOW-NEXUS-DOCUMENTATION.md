# AK-FLOW NEXUS v13.0

## System do Zarządzania Projektem AK-FLOW

**Data utworzenia:** 15 grudnia 2024  
**Autor:** Paul + Claude  
**Technologie:** React 18, TypeScript, Zustand, Vite, Tailwind CSS

---

## 🎯 Cel Projektu

AK-FLOW NEXUS to dedykowany system ToDo/Roadmap stworzony specjalnie dla projektu **AK-FLOW** - kognitywnej architektury symulującej biologiczne procesy mózgu. System umożliwia:

1. **Lokalne przechowywanie danych** w plikach JSON (czytelnych i edytowalnych przez AI)
2. **Real-time synchronizację** z narzędziami AI (Windsurf, Cursor, Claude)
3. **Profesjonalny interfejs** do ręcznego zarządzania taskami
4. **Split-screen workflow** - testy w jednym oknie, dashboard w drugim

---

## 🏗️ Architektura

```
┌─────────────────────────────────────────────────────────────┐
│                    AK-FLOW NEXUS UI                         │
│  ┌─────────┐ ┌─────────┐ ┌──────────┐ ┌─────────┐          │
│  │ TaskBoard│ │ Roadmap │ │Challenges│ │  Notes  │          │
│  └────┬────┘ └────┬────┘ └────┬─────┘ └────┬────┘          │
│       │           │           │            │                │
│       └───────────┴───────────┴────────────┘                │
│                         │                                   │
│              ┌──────────▼──────────┐                        │
│              │   Zustand Store     │                        │
│              │  (nexusStore.ts)    │                        │
│              └──────────┬──────────┘                        │
│                         │                                   │
│              ┌──────────▼──────────┐                        │
│              │   File Service      │                        │
│              │ (fileService.ts)    │                        │
│              └──────────┬──────────┘                        │
│                         │                                   │
└─────────────────────────┼───────────────────────────────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │  ak-flow-state.json   │◄──── Windsurf/Cursor
              │   (lokalny plik)      │       edytuje ten plik
              └───────────────────────┘
```

---

## 📁 Struktura Plików

```
ak-flow-nexus/
├── src/
│   ├── types.ts                    # Definicje TypeScript
│   ├── main.tsx                    # Entry point React
│   ├── App.tsx                     # Główny komponent aplikacji
│   ├── index.css                   # Style Tailwind + custom
│   ├── stores/
│   │   └── nexusStore.ts           # Zustand store - stan aplikacji
│   ├── services/
│   │   └── fileService.ts          # Obsługa plików JSON + watch mode
│   └── components/
│       ├── TaskBoard.tsx           # Zarządzanie taskami (TODAY/TOMORROW/BACKLOG)
│       ├── RoadmapView.tsx         # Roadmapa projektu (10 tierów)
│       ├── ChallengesAndNotes.tsx  # Wyzwania + notatki
│       ├── CommandPalette.tsx      # Ctrl+K command palette
│       └── StatusBarAndModals.tsx  # Status bar, sync panel, modals
├── data/
│   └── ak-flow-state.json          # Plik stanu (edytowalny przez AI)
├── package.json
├── vite.config.ts
├── tailwind.config.js
└── tsconfig.json
```

---

## 🔄 Jak Działa Synchronizacja z AI

### Przepływ Danych

```
┌─────────────┐      edytuje JSON       ┌─────────────┐
│  Windsurf   │ ─────────────────────► │ ak-flow-    │
│  / Cursor   │                         │ state.json  │
└─────────────┘                         └──────┬──────┘
                                               │
                                               │ File Watch (1s polling)
                                               ▼
                                        ┌─────────────┐
                                        │  NEXUS UI   │
                                        │  (browser)  │
                                        └─────────────┘
```

### Mechanizm Watch Mode

1. **Użytkownik klika "Open & Watch"** → wybiera plik JSON
2. **File System Access API** zapamiętuje uchwyt do pliku
3. **Polling co 1 sekundę** sprawdza `lastModified` pliku
4. **Jeśli plik zmieniony** → automatyczny reload stanu do UI
5. **Użytkownik widzi zmiany** wprowadzone przez AI w czasie rzeczywistym

### Auto-Save (odwrotny kierunek)

1. **Użytkownik edytuje w UI** → Zustand store się aktualizuje
2. **Subscription na store** wykrywa zmianę
3. **Debounced save (2s)** zapisuje JSON do pliku
4. **AI może odczytać** zaktualizowany stan

---

## 📊 Model Danych (JSON Schema)

```json
{
  "version": "13.0",
  "lastModified": "ISO timestamp",
  "modifiedBy": "USER | AI_WINDSURF | AI_CURSOR | AI_CLAUDE",
  
  "tasks": [{
    "id": "task-xxx",
    "content": "Treść zadania",
    "priority": "CRITICAL | HIGH | MEDIUM | LOW",
    "type": "TODAY | TOMORROW | BACKLOG",
    "completed": false,
    "subtasks": [{ "id": "sub-xxx", "content": "...", "completed": false }],
    "createdAt": "ISO timestamp",
    "modifiedAt": "ISO timestamp"
  }],
  
  "roadmap": [{
    "id": "rm-xxx",
    "title": "Nazwa feature'a",
    "description": "Opis",
    "tier": 1-10,
    "status": "PLANNED | IN_PROGRESS | IMPLEMENTED | TESTED | DOCUMENTED",
    "completionPercentage": 0-100,
    "createdAt": "ISO timestamp",
    "modifiedAt": "ISO timestamp"
  }],
  
  "challenges": [{
    "id": "ch-xxx",
    "title": "Tytuł wyzwania",
    "description": "Opis problemu",
    "severity": "CRITICAL | HIGH | MODERATE | LOW",
    "status": "OPEN | INVESTIGATING | RESOLVED",
    "potentialSolution": "Propozycja rozwiązania",
    "createdAt": "ISO timestamp",
    "modifiedAt": "ISO timestamp"
  }],
  
  "notes": [{
    "id": "note-xxx",
    "title": "Tytuł notatki",
    "content": "Treść",
    "category": "IDEA | INSIGHT | DECISION | RESEARCH | QUESTION",
    "tags": ["tag1", "tag2"],
    "createdAt": "ISO timestamp",
    "modifiedAt": "ISO timestamp"
  }],
  
  "stats": {
    "totalFeatures": 30,
    "implemented": 6,
    "partial": 7,
    "overallProgress": 47,
    "currentPhase": "FAZA 6.2: Kernel Stabilization",
    "todayCompleted": 0,
    "streak": 5
  },
  
  "settings": {
    "theme": "cyberpunk",
    "autoSaveInterval": 2000,
    "fileWatchEnabled": true,
    "showCompletedTasks": true
  }
}
```

---

## 🎨 Interfejs Użytkownika

### Główne Widoki

| Widok | Skrót | Opis |
|-------|-------|------|
| **Tasks** | `G T` | Taski podzielone na TODAY / TOMORROW / BACKLOG |
| **Roadmap** | `G R` | 10-tierowa roadmapa projektu |
| **Challenges** | `G C` | Wyzwania techniczne z severity |
| **Notes** | `G N` | Notatki, pomysły, decyzje |

### Skróty Klawiszowe

| Skrót | Akcja |
|-------|-------|
| `Ctrl/Cmd + K` | Command Palette |
| `Ctrl/Cmd + S` | Wymuś zapis |
| `Ctrl/Cmd + O` | Panel synchronizacji |
| `Ctrl/Cmd + Z` | Cofnij |
| `Ctrl/Cmd + Shift + Z` | Ponów |
| `ESC` | Zamknij modal/palette |

### Roadmap Tiers (10 poziomów)

1. **Consciousness** - Podstawowa świadomość
2. **Perception** - Percepcja i przetwarzanie
3. **Emotion** - System emocjonalny
4. **Memory** - Pamięć i uczenie
5. **Reasoning** - Rozumowanie
6. **Creativity** - Kreatywność
7. **Social** - Inteligencja społeczna
8. **Meta-Cognition** - Samoświadomość
9. **Integration** - Integracja systemów
10. **Transcendence** - Przekroczenie limitów

---

## 🤖 Protokół dla AI (Windsurf/Cursor/Claude)

### Jak AI Powinno Edytować JSON

```markdown
## Zasady dla AI edytującego ak-flow-state.json:

1. ZAWSZE zachowuj istniejące ID - nigdy nie generuj nowych dla istniejących elementów
2. ZAWSZE ustawiaj `modifiedBy` na swoją nazwę (np. "AI_WINDSURF")
3. ZAWSZE aktualizuj `lastModified` na aktualny timestamp
4. ZAWSZE aktualizuj `modifiedAt` dla zmienionych elementów

### Dozwolone akcje:
- ADD_TASK: Dodaj nowy task z unikalnym ID (format: task-xxx)
- COMPLETE_TASK: Ustaw completed: true
- UPDATE_ROADMAP_STATUS: Zmień status feature'a
- ADD_CHALLENGE: Zgłoś nowy problem
- RESOLVE_CHALLENGE: Oznacz jako RESOLVED
- ADD_NOTE: Dodaj notatkę/insight
- UPDATE_STATS: Zaktualizuj statystyki projektu

### Przykład dodania taska:
{
  "id": "task-ai-001",
  "content": "Zrefaktorować EmotionEngine",
  "priority": "HIGH",
  "type": "TODAY",
  "completed": false,
  "subtasks": [],
  "createdAt": "2024-12-15T10:00:00.000Z",
  "modifiedAt": "2024-12-15T10:00:00.000Z"
}
```

---

## 🚀 Uruchomienie

```bash
# Instalacja
cd ak-flow-nexus
npm install

# Development
npm run dev
# Otwiera się na http://localhost:3000

# Build produkcyjny
npm run build
# Pliki w dist/
```

### Wymagania

- Node.js 18+
- Przeglądarka z File System Access API (Chrome 86+, Edge 86+)
- Dla Firefox/Safari: fallback na download/upload

---

## 🔗 Integracja z AK-FLOW

System NEXUS jest zaprojektowany do współpracy z głównym projektem AK-FLOW:

1. **Umieść `ak-flow-state.json`** w katalogu głównym AK-FLOW
2. **Otwórz NEXUS** w osobnym oknie przeglądarki
3. **Połącz z plikiem** przez "Open & Watch"
4. **AI analizując kod AK-FLOW** może aktualizować JSON
5. **Dashboard odświeża się automatycznie** pokazując postęp

### Zastosowanie w Workflow

```
┌──────────────────┐     ┌──────────────────┐
│   Terminal       │     │   NEXUS Dashboard│
│   npm test       │     │   (localhost:3000)│
│                  │     │                  │
│   PASS ✓ Emotion │     │   ✓ Emotion Test │
│   PASS ✓ Memory  │     │   ✓ Memory Test  │
│   FAIL ✗ Sleep   │     │   ⚠ Sleep Issue  │
└──────────────────┘     └──────────────────┘
         │                        ▲
         │   AI aktualizuje       │
         └──────── JSON ──────────┘
```

---

## 📝 Notatki Implementacyjne

### Dlaczego Zustand?

- Lekki (2KB) vs Redux (7KB+)
- Brak boilerplate'u
- `subscribeWithSelector` umożliwia precyzyjne reakcje na zmiany
- Idealny do integracji z external storage

### Dlaczego File System Access API?

- **Persistent access** - plik pozostaje dostępny między sesjami
- **Real-time watching** - polling `lastModified`
- **No server needed** - działa całkowicie lokalnie
- **AI-friendly** - pliki tekstowe łatwe do edycji

### Dlaczego JSON zamiast SQLite/IndexedDB?

- **Czytelność** - AI może odczytać i zrozumieć strukturę
- **Edytowalność** - Windsurf/Cursor mogą bezpośrednio modyfikować
- **Portability** - łatwy backup/transfer
- **Version control** - można commitować do git

---

## 🎯 Roadmap NEXUS (przyszłość)

- [ ] Drag & drop reordering tasków
- [ ] WebSocket sync dla collaborative editing
- [ ] Cloud backup (opcjonalny)
- [ ] Mobile app (React Native)
- [ ] Voice input
- [ ] Analytics dashboard
- [ ] Export do Markdown/PDF
- [ ] Integracja z GitHub Issues
- [ ] Pomodoro timer
- [ ] Calendar view

---

## 📞 Kontekst Projektu AK-FLOW

**AK-FLOW** to ambitna kognitywna architektura symulująca biologiczne procesy mózgu:

- **Neurotransmitery** (dopamina, serotonina, norepinefryna)
- **System emocjonalny** z dynamicznymi przejściami stanów
- **Cykle biologiczne** (rytmy dobowe, sen, zmęczenie)
- **KernelEngine** jako czysta maszyna stanów
- **Zustand adapter** do reaktywnego UI

NEXUS służy jako "mission control" dla rozwoju AK-FLOW - trackuje postęp, wyzwania, i umożliwia AI-assisted project management.

---

*Dokumentacja wygenerowana: 15 grudnia 2024*
*Wersja: 13.0*
