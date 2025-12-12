# 🕵️ Shadow Agent: The "Brudnopis" Testing Protocol (12/10)

> **Philosophy:** "Don't mock the truth. Face it."
> We test the **Real System** against the **Real Database** using a **False Identity**.

## 1. The Concept: "Shadow Agent"

Zamiast mockować bazę danych (co jest kłamstwem), tworzymy specjalnego agenta-ducha:
- **Agent ID:** `shadow-tester-01`
- **Typ:** `SYNTHETIC`
- **Uprawnienia:** Pełny dostęp do DB, ale izolowany przez ID.

Traktujemy bazę danych jak **Brudnopis**. Piszemy, sprawdzamy, zmazujemy.

## 2. The Architecture

```mermaid
graph TD
    TestRunner[Vitest E2E] -->|1. Inject Seed| DB[(Supabase Real)]
    TestRunner -->|2. Wake Up| Kernel[Cognitive Kernel (Real)]
    
    Kernel -->|3. Read Input| DB
    Kernel -->|4. Process & Write| DB
    
    TestRunner -->|5. Poll & Verify| DB
    TestRunner -->|6. Nuke Data| DB
```

## 3. The Protocol ( krok po kroku)

### Phase 1: Injection (Incepcja)
Test Runner wstrzykuje do tabeli `memories` fałszywe wspomnienie lub do `inputs` wiadomość od użytkownika.
```typescript
await supabase.from('memories').insert({
  agent_id: 'shadow-tester-01',
  content: 'User says: "What is the capital of Poland?"',
  type: 'user_input'
});
```

### Phase 2: Execution (Proces)
Uruchamiamy **prawdziwy** `useCognitiveKernel` (lub jego headless wersję `KernelService`) dla tego ID.
System "myśli", że obsługuje prawdziwego użytkownika. Pobiera dane, mieli przez LLM, zapisuje odpowiedź.

### Phase 3: Verification (Prawda)
Test Runner odpytuje bazę: "Czy `shadow-tester-01` ma nową odpowiedź w ciągu ostatnich 5 sekund?"
```typescript
const { data } = await supabase.from('memories')
  .select('*')
  .eq('agent_id', 'shadow-tester-01')
  .eq('type', 'agent_speech')
  .single();

expect(data.content).toContain('Warsaw');
```

### Phase 4: Cleanup (Zacieranie śladów)
**Kluczowe:** Po teście musimy usunąć śmieci, żeby nie zaśmiecać produkcji.
```typescript
await supabase.from('memories').delete().eq('agent_id', 'shadow-tester-01');
```

## 4. Why is this 12/10?

1.  **Zero Mocków:** Testujesz dokładnie ten sam kod SQL, który działa na produkcji.
2.  **Latency Check:** Widzisz, ile *naprawdę* trwa zapis do bazy (network lag).
3.  **Schema Safe:** Jeśli zmienisz nazwę kolumny w bazie, test się wywali (a mock by przeszedł).
4.  **Bezpieczeństwo:** Dane "Shadow Agenta" są separowane logicznie. Jesse (Główny Agent) ich nie widzi.

## 5. Implementation Plan

1.  **Stworzyć `TestIdProvider`:** Serwis, który generuje unikalne ID dla każdego testu (żeby testy równoległe się nie gryzły).
2.  **Stworzyć `HeadlessKernel`:** Wersję kernela, która działa w Node.js (bez React Hooks), żeby można ją było odpalić z Vitest.
3.  **Napisać `ShadowTest.e2e.ts`:** Pierwszy test "Smoke Test" - wstrzyknij "Hello", czekaj na "Hi".

---
*Status: Ready for Engineering Phase*
