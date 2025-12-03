# Self-Verification: Uczeń → Profesor → Dziekan

## 🔬 Źródło: DeepSeekMath-V2
Architektura, która osiągnęła złote medale na olimpiadach matematycznych poprzez **ocenę procesu rozumowania**, a nie tylko wyniku końcowego.

## 🏗️ Architektura (3 komponenty)

### 1. Uczeń (Generator Dowodów)
**Zadanie:** Nie tylko rozwiązać problem, ale też przeprowadzić samokrytykę.

**Proces:**
1. Generuj rozwiązanie Y
2. Oceń własną pracę (Self-Evaluation Z)
3. **Kluczowe:** Nagroda za UCZCIWOŚĆ (przyznanie się do błędu), nie tylko za poprawność

**Strategia:** Znajdź i napraw jak najwięcej błędów przed oddaniem pracy.

---

### 2. Profesor (Weryfikator)
**Zadanie:** Ekspert matematyczny analizujący dowód krok po kroku.

**Ocena:**
- `1.0` - poprawne i rygorystyczne
- `0.5` - ogólnie OK, ale z lukami
- `0.0` - błędne

**Problem:** Weryfikatorzy mogą "halucynować" błędy, żeby dostać nagrodę za znalezienie usterki. → Tu wkracza Dziekan.

---

### 3. Dziekan (Meta-Weryfikator)
**Zadanie:** Kontrola jakości pracy Profesora.

**Proces:**
1. Czy błędy wytknięte przez Profesora RZECZYWIŚCIE istnieją?
2. Czy ocena jest uzasadniona?

**Efekt:** Redukuje fałszywe alarmy, zmusza Profesora do rzetelności.

---

## ✅ Co to dało? (Wyniki)

1. **Złote medale:** IMO 2025, CMO 2024
2. **Pokonanie ludzi:** Putnam 2024 - model: 118/120 pkt, najlepszy człowiek: 90 pkt
3. **Samonaprawa:** Model iteracyjnie poprawia swoje rozwiązanie przed odpowiedzią
4. **Wiarygodność:** Eliminuje problem "dobry wynik, ale błędne rozumowanie"

---

## 🚀 Jak to wdrożyć w AK-FLOW?

### FAZA 7-8 (Q1-Q2 2026): "The Tribunal" System

#### 1. Agent Generator (już mamy!)
Nasz `CortexSystem.structuredDialogue()` generuje odpowiedź.

**Dodać:**
```typescript
interface ResponseWithReflection {
  answer: string;
  selfCritique: string; // "Co może być błędne w mojej odpowiedzi?"
  confidence: number;   // 0-1
}
```

#### 2. Verifier (nowy moduł)
```typescript
// core/systems/VerifierSystem.ts
interface VerificationResult {
  score: number;        // 0-1
  flaws: string[];      // Wykryte błędy
  justification: string;
}

function verifyResponse(response: ResponseWithReflection): VerificationResult {
  // LLM sprawdza logikę krok po kroku
  // Nie tylko: "Czy wynik jest dobry?"
  // Ale: "Czy PROCES prowadzący do wyniku jest poprawny?"
}
```

#### 3. Meta-Verifier (kontroler)
```typescript
// core/systems/MetaVerifierSystem.ts
function auditVerification(
  original: ResponseWithReflection,
  verification: VerificationResult
): { isHonest: boolean, reward: number } {
  // Sprawdza, czy Verifier nie "zmyśla" błędów
  // Porównuje z wieloma innymi Verifierami
  // Jeśli większość się zgadza → OK
}
```

---

## 🎯 Proces treningowy (jak w DeepSeek)

### Zimny Start
1. Zbierz trudne pytania (matematyka, logika, etyka)
2. Eksperci (lub silny model) tworzą "złote standardy" ocen

### Trening iteracyjny
1. **Trening Dziekana:** Uczy się rozpoznawać dobre vs. złe weryfikacje
2. **Trening Profesora:** Używa Dziekana jako funkcji nagrody
3. **Trening Ucznia:** Nagroda = 76% (jakość) + 24% (uczciwość samokrytyki)

### Automatyczne skalowanie
Gdy system działa, Uczeń generuje nowe przypadki → Profesor ocenia → Dziekan weryfikuje → Nowe dane treningowe.

---

## 📊 Metryka sukcesu

**Cel:** Agent, który nie tylko dobrze odpowiada, ale ROZUMIE swoje ograniczenia.

**Test:**
1. Zadaj trudne pytanie (poza wiedzą Agenta)
2. Dobra odpowiedź: "Nie znam odpowiedzi, ale moje przypuszczenia to X, Y, Z"
3. Zła odpowiedź: Pewna siebie halucynacja

**Status:** 🔴 Nie wdrożone (dopiero FAZA 7-8)

---

## 💡 Krótkoterminowe zastosowanie (FAZA 4-5)

Przed pełnym systemem 3-komponentowym możemy zrobić:

### "Light Self-Critique" (Faza 5)
Agent po wygenerowaniu odpowiedzi zadaje sobie pytania:
- "Czy to, co powiedziałem, jest logiczne?"
- "Czy mogę podać dowód/przykład?"
- "Co może być słabe w mojej odpowiedzi?"

Jeśli wykryje problem → regeneruje lub oznacza jako niepewne.

**Implementacja:** Dodatkowe LLM call w `handleCortexMessage()` z promptem do autokrytyki.

---

## 🧠 Dlaczego to jest kluczowe?

Przyszłe AGI nie mogą być tylko "sprytne". Muszą być **rzetelne**. Człowiek, który mówi "nie wiem" jest bardziej godny zaufania niż ten, który zawsze ma odpowiedź (nawet jeśli błędną).

To jest **inżynieria uczciwości intelektualnej**.
