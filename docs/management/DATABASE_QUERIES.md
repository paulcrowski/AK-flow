# 🗃️ AK-FLOW Database Query Patterns

> **ALARM 3 AUDIT** - Centralizacja wzorców zapytań do bazy danych.
> Ostatnia aktualizacja: 2025-12-12

## 📋 Zasady

1. **NIGDY nie pisz zapytań inline** - używaj funkcji z serwisów
2. **Zawsze obsługuj błędy** - baza może być niedostępna
3. **Używaj `maybeSingle()` dla pojedynczych rekordów** - unika 406 errors
4. **Loguj błędy ale nie rzucaj wyjątków** - logging nie powinien łamać app

---

## 📁 Serwisy i ich odpowiedzialności

### `core/services/IdentityDataService.ts`
Dane tożsamości agenta.

| Funkcja | Tabela | Operacja |
|---------|--------|----------|
| `fetchCoreIdentity(agentId)` | `core_identity` | SELECT |
| `upsertCoreIdentity(agentId, identity)` | `core_identity` | UPSERT |
| `fetchNarrativeSelf(agentId)` | `narrative_self` | SELECT |
| `upsertNarrativeSelf(agentId, narrative)` | `narrative_self` | UPSERT |
| `fetchIdentityShards(agentId, limit)` | `identity_shards` | SELECT |
| `insertIdentityShard(agentId, shard)` | `identity_shards` | INSERT |
| `updateShardStrength(shardId, strength)` | `identity_shards` | UPDATE |
| `deleteIdentityShard(shardId)` | `identity_shards` | DELETE |
| `fetchRelationship(agentId, userId)` | `agent_relationships` | SELECT |
| `upsertRelationship(agentId, userId, rel)` | `agent_relationships` | UPSERT |
| `updateAgentTraitVector(agentId, traits)` | `agents` | UPDATE |
| `logIdentityEvolution(params)` | `identity_evolution_log` | INSERT |

### `services/supabase.ts`
Podstawowe operacje i pamięć.

| Funkcja | Tabela | Operacja |
|---------|--------|----------|
| `storeMemory(memory)` | `memories` | INSERT |
| `getCurrentAgentId()` | - | Session state |

### `services/EpisodicMemoryService.ts`
Pamięć epizodyczna.

| Funkcja | Tabela | Operacja |
|---------|--------|----------|
| `storeEpisode(episode)` | `memories` | INSERT |

### `services/GoalJournalService.ts`
Dziennik celów.

| Funkcja | Tabela | Operacja |
|---------|--------|----------|
| `logGoal(goal)` | `goal_journal` | INSERT |

---

## 🔧 Wzorce zapytań

### Pobieranie pojedynczego rekordu
```typescript
const { data, error } = await supabase
  .from('table_name')
  .select('col1, col2')
  .eq('id', id)
  .maybeSingle(); // NIE .single()! Unika 406 gdy brak danych

if (error || !data) {
  console.warn('[Service] No data found, using default');
  return DEFAULT_VALUE;
}
```

### Pobieranie listy z sortowaniem
```typescript
const { data, error } = await supabase
  .from('table_name')
  .select('*')
  .eq('agent_id', agentId)
  .order('created_at', { ascending: false })
  .limit(10);

if (error || !data) {
  console.warn('[Service] No data found');
  return [];
}
```

### Upsert (INSERT or UPDATE)
```typescript
const { error } = await supabase
  .from('table_name')
  .upsert({
    id: recordId, // Primary key
    ...data,
    updated_at: new Date().toISOString()
  });

if (error) {
  console.error('[Service] Upsert error:', error);
  return false;
}
return true;
```

### Insert z zwróceniem ID
```typescript
const { data, error } = await supabase
  .from('table_name')
  .insert({ ...payload })
  .select('id')
  .single();

if (error || !data) {
  console.error('[Service] Insert error:', error);
  return null;
}
return data.id;
```

---

## ⚠️ Anti-patterns

### ❌ NIE RÓB TEGO:
```typescript
// Inline query w komponencie
const { data } = await supabase.from('agents').select('*');

// Brak obsługi błędów
const { data } = await supabase.from('agents').select('*');
return data; // Co jeśli error?

// .single() bez danych
const { data } = await supabase.from('x').select('*').eq('id', id).single();
// Rzuci 406 jeśli brak rekordu!
```

### ✅ ZAMIAST TEGO:
```typescript
// Użyj serwisu
import { fetchCoreIdentity } from '@/core/services/IdentityDataService';
const identity = await fetchCoreIdentity(agentId);

// Obsłuż błędy
const { data, error } = await supabase.from('agents').select('*');
if (error) {
  console.error('Query failed:', error);
  return DEFAULT;
}

// Użyj maybeSingle()
const { data } = await supabase.from('x').select('*').eq('id', id).maybeSingle();
```

---

## 📊 Tabele w użyciu

| Tabela | Opis | Serwis |
|--------|------|--------|
| `agents` | Podstawowe dane agenta | supabase.ts |
| `core_identity` | Stabilna tożsamość | IdentityDataService |
| `narrative_self` | Dynamiczny obraz siebie | IdentityDataService |
| `identity_shards` | Fragmenty tożsamości | IdentityDataService |
| `agent_relationships` | Relacje z użytkownikami | IdentityDataService |
| `identity_evolution_log` | Log zmian tożsamości | IdentityDataService |
| `memories` | Pamięć semantyczna | supabase.ts, EpisodicMemoryService |
| `goal_journal` | Historia celów | GoalJournalService |

---

## 🔄 Migracje

Wszystkie migracje w: `database/migrations/`

| Plik | Opis |
|------|------|
| `001_initial.sql` | Początkowy schemat |
| `002_persona_less_cortex.sql` | core_identity, narrative_self, identity_shards |

**WAŻNE:** Po każdej zmianie schematu:
1. Stwórz nowy plik migracji
2. Zaktualizuj typy w `types/`
3. Zaktualizuj serwisy w `core/services/`
4. Zaktualizuj tę dokumentację!
