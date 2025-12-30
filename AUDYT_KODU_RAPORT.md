# Raport z Audytu Kodu - Znalezione Błędy i Proponowane Rozwiązania

## Spis Treści
1. [Błędy Krytyczne](#błędy-krytyczne)
2. [Błędy Wysokie](#błędy-wysokie)
3. [Błędy Średnie](#błędy-średnie)
4. [Błędy Niskie](#błędy-niskie)
5. [Podsumowanie i Rekomendacje](#podsumowanie-i-rekomendacje)

---

## Błędy Krytyczne

### 1. ActionFirst omija poprawki z P0

**Opis problemu:**
- `ReactiveStep.ts` nie implementuje extract nazw i wymuszenia treści dla poleceń CREATE
- Efekt: Puste pliki i złe nazwy w logu "Commit CREATE ... 0 chars"
- Lokalizacja: `src/core/systems/eventloop/ReactiveStep.ts` (linie 200-250)

**Dowody:**
```typescript
// Aktualny kod w detectCreateIntent (linia ~180)
const payload = String(candidate.match[candidate.payloadIndex] || '').trim();
if (!payload) continue;  // <-- Tutaj spada jeśli brak payload
```

**Proponowane rozwiązanie:**
```typescript
// Rozszerzyć detectCreateIntent o generowanie domyślnej treści
function detectCreateIntent(ctx: IntentInput): ActionFirstResult | null {
  // ... istniejący kod ...
  
  // Nowe: Jeśli brak payload, wygeneruj domyślną treść
  if (!payload) {
    const defaultContent = `TODO: Uzupełnić treść dla ${name || 'nowego pliku'}`;
    const target = deriveCreateTarget(name || defaultContent, { preferPhrase: true });
    return { handled: true, action: 'CREATE', target, payload: defaultContent };
  }
  
  // ... reszta kodu ...
}

// Dodatkowo: Walidacja nazwy pliku
function deriveCreateTarget(rawTarget: string, opts?: { preferPhrase?: boolean }): string {
  const t = String(rawTarget || '').trim();
  if (!t) return 'artifact.md';
  
  // Walidacja: minimalna długość nazwy
  if (t.length < 3) {
    return 'artifact.md';
  }
  
  // ... reszta istniejącego kodu ...
}
```

---

### 2. Brak obsługi fraz z polskimi znakami

**Opis problemu:**
- Regexpy w `ReactiveStep.ts` używają tylko ASCII (utworz/stworz)
- Brak obsługi "twórz" i "a w nim"
- Efekt: Spadanie do LLM i błędy "Wystąpił problem"

**Dowody:**
```typescript
// Aktualne regexpy (linia ~90)
const CREATE_SIMPLE_REGEX = /(?:stworz|utworz|zapisz)\s+(?:plik\s+)?(.+)/i;
// Brak: twórz, stworz, utworz
```

**Proponowane rozwiązanie:**
```typescript
// Rozszerzyć regexpy o polskie znaki i frazy
const CREATE_SIMPLE_REGEX = /(?:stworz|utworz|zapisz|tw[óo]rz)\s+(?:plik\s+)?(.+)/i;
const CREATE_WITH_NAME_REGEX = new RegExp(
  `(?:stworz|utworz|zapisz|tw[óo]rz)\s+(?:plik\s+)?(?:o\s+nazwie\s+)?(.+?)\s+z\s+${CONTENT_KEYWORD}\s+([\s\S]+)`,
  'i'
);

// Dodatkowo: Obsługa "a w nim"
const CREATE_WITH_CONTENT_REGEX = new RegExp(
  `(?:stworz|utworz|zapisz|tw[óo]rz)\s+(?:plik\s+)?(.+?)\s+(?:a\s+w\s+nim\s+|z\s+${CONTENT_KEYWORD}\s+)(.+)`,
  'i'
);

// W detectCreateIntent dodać:
const createWithContentMatch = ctx.raw.match(CREATE_WITH_CONTENT_REGEX);
if (createWithContentMatch) {
  const name = String(createWithContentMatch[1] || '').trim();
  const payload = String(createWithContentMatch[2] || '').trim();
  if (payload) {
    const target = deriveCreateTarget(name || payload);
    return { handled: true, action: 'CREATE', target, payload };
  }
}
```

---

## Błędy Wysokie

### 3. Sztuczny timestamp w semantic search

**Opis problemu:**
- `MemoryService.semanticSearch` ustawia `timestamp = new Date().toISOString()` dla wszystkich wyników
- Efekt: Wszystkie wspomnienia wyglądają jak z bieżącego tygodnia, omijają filtr zakresu czasowego

**Dowody:**
```typescript
// supabase.ts (linia ~480)
return (diagnosed.data || []).map((item: any) => ({
  id: item.id,
  content: item.raw_text,
  timestamp: new Date().toISOString(),  // <-- ZAWSZE bieżący czas!
  // ...
}));
```

**Proponowane rozwiązanie:**
```typescript
// Używać rzeczywistego created_at z bazy danych
return (diagnosed.data || []).map((item: any) => ({
  id: item.id,
  content: item.raw_text,
  timestamp: item.created_at || new Date().toISOString(),  // <-- Użyj rzeczywistego timestampu
  // ...
}));

// Dodatkowo: Walidacja timestampu
const rawTimestamp = item.created_at || item.timestamp;
const timestamp = typeof rawTimestamp === 'string' 
  ? rawTimestamp 
  : new Date().toISOString();
```

---

### 4. Brak telemetrii CORTEX_PARSE_FAILURE

**Opis problemu:**
- Wiele błędów "Wystąpił problem" bez odpowiadających eventów `CORTEX_PARSE_FAILURE`
- Możliwa dziura w telemetry

**Dowody:**
```typescript
// CortexInference.ts (linia ~120)
// Event jest publikowany tylko w catch bloku
} catch (error) {
  console.error('[CortexInference] Parse error:', error);
  eventBus.publish({  // <-- Tylko tutaj!
    id: generateUUID(),
    timestamp: Date.now(),
    source: AgentType.CORTEX_FLOW,
    type: PacketType.PREDICTION_ERROR,
    payload: {
      metric: 'CORTEX_PARSE_FAILURE',
      // ...
    }
  });
}
```

**Proponowane rozwiązanie:**
```typescript
// 1. Dodać logowanie przed catch
function parseResponse(text: string | undefined): CortexOutput {
  if (!text) {
    console.warn('[CortexInference] Empty response');
    
    // Log empty response
    eventBus.publish({
      id: generateUUID(),
      timestamp: Date.now(),
      source: AgentType.CORTEX_FLOW,
      type: PacketType.PREDICTION_ERROR,
      payload: {
        metric: 'CORTEX_PARSE_FAILURE',
        reason: 'EMPTY_RESPONSE',
        rawOutput: 'EMPTY'
      }
    });
    
    return { ...FALLBACK_CORTEX_OUTPUT };
  }
  
  // 2. Dodać logowanie dla invalid structure
  if (!parsedResult.ok || !parsedResult.value) {
    eventBus.publish({
      id: generateUUID(),
      timestamp: Date.now(),
      source: AgentType.CORTEX_FLOW,
      type: PacketType.PREDICTION_ERROR,
      payload: {
        metric: 'CORTEX_PARSE_FAILURE',
        reason: 'INVALID_STRUCTURE',
        rawOutput: text?.substring(0, 500)
      }
    });
  }
  
  // ... reszta kodu ...
}
```

---

## Błędy Średnie

### 5. Brak obsługi "dodaj 2 linijki"

**Opis problemu:**
- `ActionFirst` wymaga gotowej treści (payload)
- Bez payload spada do LLM, który zaprzecza, że umie edytować

**Dowody:**
```typescript
// ReactiveStep.ts (linia ~320)
const payload = String(actionIntent.payload || '').trim();
if (!payload) {
  // No payload - fall through to LLM
  // <-- Tutaj spada do LLM
}
```

**Proponowane rozwiązanie:**
```typescript
// 1. Generowanie domyślnej treści
if (!payload) {
  const defaultPayload = `// TODO: Uzupełnić treść\n// Data: ${new Date().toISOString().split('T')[0]}`;
  // ... reszta logiki APPEND ...
}

// 2. Lub: Pytanie o content
if (!payload) {
  // Zamiast spadać do LLM, zapytaj użytkownika
  callbacks.onMessage('assistant', 
    `Co chcesz dodać do pliku ${target}? Podaj treść.`,
    'speech'
  );
  return;  // Nie wykonuj APPEND
}

// 3. Lub: Automatyczne generowanie na podstawie kontekstu
const contextBasedPayload = generateContentFromContext({
  action: 'APPEND',
  target,
  userInput
});
```

---

### 6. Brak UI_ERROR_TOAST w logach

**Opis problemu:**
- Mimo wielu fallbacków, `UI_ERROR_TOAST` nie pojawia się w logu
- Możliwe, że eventy `SYSTEM_ALERT` nie są publikowane

**Dowody:**
```typescript
// KernelEngineRunner.ts (linia ~50)
private maybeEmitUiErrorToast(messageId: string, text: string): void {
  if (!this.isUserFacingError(text)) return;
  this.deps.publishEvent({
    id: this.deps.generateUUID(),
    timestamp: Date.now(),
    source: AgentType.CORTEX_FLOW,
    type: PacketType.SYSTEM_ALERT,
    payload: {
      event: 'UI_ERROR_TOAST',  // <-- Powinno się pojawiać!
      // ...
    }
  });
}
```

**Proponowane rozwiązanie:**
```typescript
// 1. Dodać debug log
private maybeEmitUiErrorToast(messageId: string, text: string): void {
  console.log('[UI_ERROR_TOAST] Checking:', text);  // <-- Debug
  if (!this.isUserFacingError(text)) {
    console.log('[UI_ERROR_TOAST] Not user-facing');
    return;
  }
  console.log('[UI_ERROR_TOAST] Publishing event');  // <-- Debug
  this.deps.publishEvent({
    // ...
  });
}

// 2. Sprawdzić isUserFacingError
private isUserFacingError(text: string): boolean {
  const normalized = String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  
  const isError = normalized.includes('wystapil problem') 
    || normalized.includes('error') 
    || normalized.includes('błąd');
    
  console.log('[isUserFacingError]', { text, normalized, isError });  // <-- Debug
  return isError;
}

// 3. Sprawdzić czy publishEvent działa
this.deps.publishEvent = (packet) => {
  console.log('[publishEvent]', packet);  // <-- Debug
  // ... reszta logiki ...
};
```

---

## Błędy Niskie

### 7. Ogólne sleep summary

**Opis problemu:**
- `DreamConsolidationService` generuje bardzo ogólne podsumowania snu
- Brak konkretnych informacji o przetworzonych epizodach i tematach

**Dowody:**
```typescript
// DreamConsolidationService.ts (linia ~120)
console.log(`💤 [DreamConsolidation] Created self-summary`);
// Brak szczegółów!

// Linia ~150
message: `💤 Processed ${episodes.length} episodes, generated ${lessons.length} lessons`
// Brak listy epizodów!
```

**Proponowane rozwiązanie:**
```typescript
// 1. Dodać szczegółowe logowanie
console.log(`💤 [DreamConsolidation] Created self-summary`, {
  summaryPreview: selfSummary.substring(0, 200),
  episodes: episodes.map(e => ({
    id: e.id,
    preview: e.event.substring(0, 50),
    strength: e.neuralStrength
  })),
  lessonsPreview: lessons.slice(0, 3)
});

// 2. Ulepszyć message
message: `💤 Processed ${episodes.length} episodes: ` +
  `${episodes.map(e => e.id).join(', ')} | ` +
  `Generated ${lessons.length} lessons: ` +
  `${lessons.slice(0, 3).map(l => l.substring(0, 30)).join('; ')}`

// 3. Dodać do wyniku
const result: DreamConsolidationResult = {
  // ... istniejące pola ...
  episodeSummaries: episodes.map(e => ({
    id: e.id,
    preview: e.event.substring(0, 100),
    emotionalDelta: e.emotionalDelta,
    tags: e.tags
  })),
  lessonSummaries: lessons.map(l => l.substring(0, 200))
};
```

---

## Podsumowanie i Rekomendacje

### Priorytety

1. **Krytyczne (natychmiastowe działanie):**
   - Naprawa `ActionFirst` w `ReactiveStep.ts`
   - Rozszerzenie regexów o polskie znaki
   - Walidacja payload i generowanie domyślnej treści

2. **Wysokie (w ciągu 1-2 dni):**
   - Naprawa timestampu w `MemoryService.semanticSearch`
   - Poprawa telemetrii `CORTEX_PARSE_FAILURE`
   - Dodanie logowania dla empty response i invalid structure

3. **Średnie (w ciągu tygodnia):**
   - Obsługa "dodaj 2 linijki" w `ActionFirst`
   - Debugowanie `UI_ERROR_TOAST`
   - Sprawdzenie czy eventy są publikowane

4. **Niskie (w kolejnych iteracjach):**
   - Ulepszenie sleep summary
   - Dodanie szczegółowych informacji o epizodach

### Szacowany czas naprawy

- **Krytyczne:** 4-6 godzin
- **Wysokie:** 3-4 godziny
- **Średnie:** 2-3 godziny
- **Niskie:** 1-2 godziny

### Zalecenia ogólne

1. **Testowanie:**
   - Po naprawie `ActionFirst`, przetestować wszystkie frazy:
     - "utwórz plik X z treścią Y"
     - "stwórz plik o nazwie X"
     - "twórz plik X a w nim Y"
     - "dodaj 2 linijki do pliku X"

2. **Monitoring:**
   - Dodać metryki dla:
     - `actionFirstFallbackCount` (ile razy spadło do LLM)
     - `semanticSearchTimestampFixCount` (ile razy naprawiono timestamp)
     - `parseFailureLoggedCount` (ile razy zalogowano parse failure)

3. **Dokumentacja:**
   - Zaktualizować dokumentację dla:
     - Obsługiwanych fraz w `ActionFirst`
     - Formatowania timestampów w `MemoryService`
     - Telemetrii błędów w `CortexInference`

---

## Podpis

Raport przygotowany przez: Mistral Vibe
Data: 2025-12-27
Wersja: 1.0