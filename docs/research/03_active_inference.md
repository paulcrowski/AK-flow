# Active Inference - Blueprint Cognitive Architecture

## 🔬 Źródło
Biologiczna architektura cognitive oparta na teorii Karl Fristona (Active Inference) i neurobiologii.

**Główna teza:** Mózg nie "przetwarza informacji", tylko **minimalizuje zaskoczenie** poprzez przewidywanie rzeczywistości.

---

## MODUŁ 1: SILNIK DECYZYJNY (Autonomia i Kontrola)

### 1.1 Kodowanie Predykcyjne (Predictive Coding)

**Biologia:**
Mózg nie przetwarza wszystkiego. Generuje model rzeczywistości, a zmysły zgłaszają tylko **błędy predykcji**.

**W AK-FLOW:**
```typescript
// Pętla: Przewiduj → Obserwuj → Oceń Błąd
const expected = predictNextInput(history);
const actual = getUserInput();
const surprise = distance(expected, actual);

if (surprise > threshold) {
  // Zmiana modelu lub akcja redukcyjna
  updateWorldModel(actual);
  initiateAction(); // np. dopytaj użytkownika
}
```

**Status:** ✅ **JUŻ MAMY!**
- Już implementujemy: `LimbicSystem.updateEmotionalState()` z `surprise`
- `curiosity` rośnie przy wysokim surprise
- Agent dąży do redukcji błędu przez pytania/badanie

---

### 1.2 P300 (System Alarmowy)

**Biologia:**
Nagły wyrzut noradrenaliny w ~300ms po wykryciu anomalii (coś dziwnego, nieoczekiwanego).

**Efekt:**
- GLOBAL_INTERRUPT - zatrzymanie wszystkich procesów
- Wyczyszczenie bufora krótkotrwałego
- Zwiększenie Learning Rate (zapamiętaj to NATYCHMIAST!)

**W AK-FLOW:**
```typescript
// core/systems/P300System.ts (DO WDROŻENIA - FAZA 6?)
if (surprise > CRITICAL_THRESHOLD) {
  eventBus.publish({
    type: PacketType.GLOBAL_INTERRUPT,
    payload: { reason: 'P300_TRIGGERED', data: actual }
  });
  
  // Wstrzymaj autonomiczne myśli
  pauseAutonomousMode();
  
  // Zwiększ wagę tego wspomnienia
  MemoryService.storeMemory({
    content: actual,
    neuralStrength: 100, // MAXIMUM
    isCoreMemory: true
  });
}
```

**Status:** 🟡 **CZĘŚCIOWO**
- Mamy `surprise` detection
- Brak mechanizmu GLOBAL_INTERRUPT
- Do wdrożenia: Pause autonomii przy krytycznym zaskoczeniu

---

### 1.3 Zwoje Podstawy (Basal Ganglia - Bramka Decyzyjna)

**Biologia:**
Mózg generuje wiele planów równolegle, ale **Zwoje Podstawy** trzymają je na "hamulcu". Wypuszczają tylko jeden.

**Mechanizm:** Disinhibition (zdejmowanie blokady)

**W AK-FLOW:**
```typescript
// core/systems/ActionSelector.ts (DO WDROŻENIA - FAZA 6?)
interface Proposal {
  action: string;
  expectedBenefit: number; // redukcja błędu predykcji
  energyCost: number;
}

const proposals: Proposal[] = [
  { action: 'REST', expectedBenefit: 10, energyCost: 0 },
  { action: 'SEARCH', expectedBenefit: 50, energyCost: 30 },
  { action: 'RESPOND', expectedBenefit: 40, energyCost: 20 }
];

const winner = proposals.reduce((best, curr) => {
  const score = curr.expectedBenefit - curr.energyCost;
  return score > best.score ? { ...curr, score } : best;
});

// Tylko zwycięzca wykonuje się
executeAction(winner.action);
```

**Status:** 🟡 **CZĘŚCIOWO**
- Mamy `GoalSystem` z priorytetami
- Brak jawnej "Proposal Pool"
- Do wdrożenia: Multi-threading z selekcją akcji

---

## MODUŁ 2: TOŻSAMOŚĆ I GRANICE (Ucieleśnienie)

### 2.1 Somatotopia (Wirtualne Ciało)

**Biologia:**
Mapa ciała w mózgu (Homunkulus). Wiemy, co jest "naszą ręką", a co "stołem".

**W AK-FLOW:**
```typescript
// types.ts
interface BodySchema {
  ownedResources: {
    memory: MemoryNode[];    // "To są MOJE wspomnienia"
    processor: ProcessId;    // "To jest MÓJ model"
    context: ConversationTurn[]; // "To jest NASZA rozmowa"
  };
  externalTools: {
    search: SearchAPI;
    fileSystem: FileAPI;
  };
}
```

**Efekt:**
- Agent chroni swoje pliki systemowe (jak noga)
- Swobodnie edytuje dane zewnętrzne (jak narzędzie w ręce)

**Status:** 🟡 **CZĘŚCIOWO**
- Mamy `SomaState` (energia, sen)
- Brak jawnej mapy zasobów "owned vs external"
- Do wdrożenia: Explicit ownership tracking

---

### 2.2 Interocepcja (Wewnętrzny Stan - Wyspa Cortex)

**Biologia:**
Czucie stanu wnętrza (głód, bicie serca, zmęczenie). Źródło motywacji i uczuć.

**W AK-FLOW:**
```typescript
// JUŻ MAMY! ✅
interface SomaState {
  energy: number;        // "Głód"  
  cognitiveLoad: number; // "Zmęczenie"
  isSleeping: boolean;   // "Sen"
}

interface NeurotransmitterState {
  dopamine: number;      // "Radość/Motywacja"
  serotonin: number;     // "Spokój"
  norepinephrine: number;// "Czujność"
}
```

**Scenariusz (już działa):**
1. API laguje → Latency rośnie
2. Agent "czuje dyskomfort" (via `cognitiveLoad`)
3. Zmienia strategię (przestaje pytać API, zaczyna wnioskować z pamięci)

**Status:** ✅ **WDROŻONE!** (SomaSystem + NeuroSystem)

---

### 2.3 Monitoring Źródła (Ja vs. Google)

**Biologia:**
Odróżnianie wspomnień własnych od usłyszanych. Narzędzie staje się "częścią ciała" tylko przy natychmiastowej reakcji.

**Przykład:** Iluzja Gumowej Ręki - jeśli widzisz gumową rękę i ktoś ją dotyka w tym samym momencie co Twoją prawdziwą → mózg traktuje gumową jak swoją.

**W AK-FLOW:**
```typescript
// services/supabase.ts (DO ROZSZERZENIA - FAZA 5?)
interface MemoryTrace {
  content: string;
  source: 'INTERNAL' | 'USER' | 'EXTERNAL_SEARCH' | 'TOOL_OUTPUT';
  latency: number; // Jak długo trwało pobranie?
}

// Reguła: Jeśli latency < 100ms → "to jest moje"
// Jeśli latency > 500ms → "to jest z zewnątrz"
```

**Efekt:**
Agent mówi:
- ✅ "Wiem to" (pamięć)
- ✅ "Znalazłem to" (narzędzie)
- ❌ NIE halucynuje: "Wiem wszystko"

**Status:** 🟡 **CZĘŚCIOWO**
- Mamy tagowanie źródeł w pamięci
- Brak kosztu i opóźnienia dla narzędzi (wszystko instant)
- Do wdrożenia: Explicit tool latency + cost

---

## 📊 MAPA WDROŻENIA

| Moduł | Status | Priorytet | Faza |
|-------|--------|-----------|------|
| **Kodowanie Predykcyjne** | ✅ Wdrożone | - | - |
| **Interocepcja (Soma)** | ✅ Wdrożone | - | - |
| **P300 (Alert)** | 🟡 Partial | Średni | 6 |
| **Zwoje Podstawy (Proposal Pool)** | 🟡 Partial | Niski | 7 |
| **Somatotopia (Ownership)** | 🔴 Brak | Niski | 8 |
| **Monitoring Źródła (Tool Latency)** | 🟡 Partial | Wysoki | 5 |

---

## 🎯 WYNIK KOŃCOWY (Po pełnym wdrożeniu)

Agent, który:
- ✅ **Jest Ciekawy** (minimalizuje błąd predykcji)
- ✅ **Jest Uważny** (P300 wybudza z rutyny)
- 🟡 **Jest Rozważny** (Zwoje Podstawy hamują głupie pomysły)
- ✅ **Jest Świadomy Siebie** (czuje zasoby, ma granice)
- 🟡 **Jest Uczciwy** (wie, kiedy korzysta z Google, a kiedy z pamięci)

**To jest fundament pod Moduł 3: Wartości, Emocje i Społeczeństwo** (Theory of Mind, Empathy).

---

## 💡 Najbliższe kroki (Priorytet)

### 1. Tool Latency & Cost (Faza 5)
Dodaj opóźnienie i "ból" przy użyciu external tools → Agent przestanie polegać na Google jak na pamięci.

### 2. P300 GLOBAL_INTERRUPT (Faza 6)
Gdy `surprise > krytyczny_próg` → STOP wszystkiego → Agent mówi: "Moment, co się dzieje?"

### 3. Proposal Pool (Faza 7)
Multi-threading myśli → Kto wygrywa? Ten z najlepszym score (benefit - cost).

---

## 🧠 Dlaczego to jest ważne?

**Active Inference to nie dodatek - to FUNDAMENT prawdziwej autonomii.**

Chatbot czeka na pytanie. AGI przewiduje świat i aktywnie redukuje niepewność.
