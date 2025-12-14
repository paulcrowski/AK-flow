# 🔧 AK-FLOW - POPRAWKI I UZASADNIENIE

**Wersja:** v1.0
**Cel:** Poprawki do refaktoru + uzasadnienie dlaczego **nie ograniczać pamięci** (dla celów badawczych)

---

## 📝 POPRAWKI (do zrobienia)

### 1. **Dodaj seed do losowości**

**Co:**
```typescript
// useCognitiveKernelLite.ts
import seedrandom from 'seedrandom';

interface UseCognitiveKernelLiteProps {
  seed?: string; // Nowy parametr
}

export function useCognitiveKernelLite({ seed }: UseCognitiveKernelLiteProps) {
  const rng = seed ? seedrandom(seed) : Math.random;
  const shouldRemoveCycle = rng() < 0.3; // Przewidywalne!
}
```

**Dlaczego:**
- Testy są reprodukowalne
- Debugowanie jest łatwiejsze
- Zero flaky tests

---

### 2. **Dodaj useErrorBoundary**

**Co:**
```typescript
// useErrorBoundary.ts
export function useErrorBoundary<T>(fn: () => T, onError: (error: Error) => void) {
  try {
    return fn();
  } catch (error) {
    onError(error);
    return null;
  }
}
```

**Dlaczego:**
- Zero crashy
- Lepszy UX
- Łatwiejsze debugowanie

---

### 3. **Dodaj maxConversationLength (ALE NIE DLA BADAŃ!)**

**Co:**
```typescript
// reducer.ts
const MAX_CONVERSATION_LENGTH = 50;

case ADD_MESSAGE:
  return {
    ...state,
    conversation: [
      ...state.conversation.slice(-MAX_CONVERSATION_LENGTH + 1),
      action.payload,
    ],
  };
```

**Dlaczego NIE dla badań:**
- **Potrzebujesz pełnej historii** (do analizy)
- **Potrzebujesz kontekstu** (do uczenia)
- **Potrzebujesz danych** (do EvalBus)

**Kompromis:**
- **Dla produkcji:** `MAX_CONVERSATION_LENGTH = 50`
- **Dla badań:** `MAX_CONVERSATION_LENGTH = Infinity`

---

### 4. **Popraw ComponentErrorBoundary**

**Co:**
```typescript
// ComponentErrorBoundary.tsx
import React, { ErrorInfo, ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ComponentErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || <div>Something went wrong</div>;
    }
    return this.props.children;
  }
}
```

**Dlaczego:**
- Type safety
- Lepsze IDE support
- Łatwiejsze debugowanie

---

### 5. **Popraw hook testy (DOM environment)**

**Co:**
```typescript
// vite.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom', // Dodaj to!
    globals: true,
    setupFiles: './tests/setup.ts',
  },
});
```

**Dlaczego:**
- Testy działają
- Lepsze pokrycie
- Zero flaky tests

---

## 🧠 UZASADNIENIE: Dlaczego NIE ograniczać pamięci (dla badań)

### 1. **Potrzebujesz pełnej historii**

**Dlaczego:**
- **Analiza konwersacji:** Musisz wiedzieć co agent powiedział 10 kroków temu
- **Uczenie się:** Agent musi mieć kontekst (co powiedział wcześniej)
- **EvalBus:** Musi mieć dane o całej konwersacji

**Przykład:**
```typescript
// Bez historii:
User: "Jaka pogoda?"
Agent: "Nie wiem" (brak kontekstu)

// Z historią:
User: "Jaka pogoda w Warszawie?"
Agent: "W Warszawie jest słonecznie" (ma kontekst)
```

---

### 2. **Potrzebujesz kontekstu**

**Dlaczego:**
- **Agent musi się uczyć:** Bez kontekstu nie ma uczenia
- **Agent musi pamiętać:** Bez pamięci nie ma tożsamości
- **Agent musi reagować:** Bez historii nie ma reakcji

**Przykład:**
```typescript
// Bez kontekstu:
User: "A co z Krakowem?"
Agent: "Nie rozumiem" (brak kontekstu)

// Z kontekstem:
User: "A co z Krakowem?"
Agent: "W Krakowie jest deszczowo" (ma kontekst)
```

---

### 3. **Potrzebujesz danych**

**Dlaczego:**
- **EvalBus:** Musi mieć dane o całej konwersacji
- **Guard:** Musi mieć dane o całej konwersacji
- **Chemia:** Musi mieć dane o całej konwersacji

**Przykład:**
```typescript
// Bez danych:
EvalBus: "Agent powiedział X" (brak kontekstu)

// Z danymi:
EvalBus: "Agent powiedział X, bo wcześniej powiedział Y" (ma kontekst)
```

---

## 🎯 KOMPROMIS (dla produkcji vs. badań)

### Dla produkcji:
```typescript
// reducer.ts
const MAX_CONVERSATION_LENGTH = 50; // Ograniczenie
```

### Dla badań:
```typescript
// reducer.ts
const MAX_CONVERSATION_LENGTH = Infinity; // Brak ograniczenia
```

---

## 📊 PODSUMOWANIE

**Co zrobić:**
1. **Dodaj seed do losowości** (dla testów)
2. **Dodaj useErrorBoundary** (obsługa błędów)
3. **NIE ograniczać pamięci** (dla badań)
4. **Popraw ComponentErrorBoundary** (typy)
5. **Popraw hook testy** (DOM)

**Efekt:**
- **13/10** (pewność że nic nie zepsujesz)
- **Zero flaky tests** (testy są stabilne)
- **Pełna historia** (dla badań)
- **Lepsze UX** (obsługa błędów)

---

**Data generowania:** 2025-12-13
**Wersja:** AK-FLOW Fixes and Rationale v1.0
**Autor:** Mistral Vibe (na podstawie audytu kodu)
