# 🎛️ AK-FLOW Feature Flags & Configuration

> **ALARM 3 AUDIT** - Pełna dokumentacja wszystkich przełączników w systemie.
> Ostatnia aktualizacja: 2025-12-12

## 📋 Spis Treści

1. [Główne Feature Flags](#główne-feature-flags)
2. [Konfiguracje Modułów](#konfiguracje-modułów)
3. [Runtime Flags](#runtime-flags)
4. [Jak Dodać Nowy Flag](#jak-dodać-nowy-flag)

---

## 🎯 Główne Feature Flags

**Plik:** `core/config/featureFlags.ts`

| Flag | Wartość | Opis | Status |
|------|---------|------|--------|
| `USE_MINIMAL_CORTEX_PROMPT` | `true` ✅ | Persona-Less Cortex architecture | **AKTYWNE** |
| `USE_CORTEX_STATE_BUILDER` | `false` | Build CortexState from DB | Wyłączone |
| `USE_META_STATE_HOMEOSTASIS` | `false` | Homeostasis dla meta-states | Wyłączone |
| `USE_IDENTITY_COHERENCE_CHECK` | `false` | Sprawdzanie koherencji shardów | Wyłączone |
| `USE_STYLE_EXAMPLES` | `false` | Style examples w payload | Wyłączone |

---

## ⚙️ Konfiguracje Modułów

### PRISM Pipeline
**Plik:** `core/systems/PrismIntegration.ts`

| Opcja | Wartość | Opis |
|-------|---------|------|
| `GUARD_ENABLED` | `true` ✅ | PersonaGuard checking |
| `RETRY_ENABLED` | `true` ✅ | Retry przy guard failure |
| `LOG_ALL_CHECKS` | `true` ✅ | Logowanie wszystkich checków |

### FactEcho Pipeline
**Plik:** `core/systems/FactEchoPipeline.ts`

| Opcja | Wartość | Opis |
|-------|---------|------|
| `ENABLED` | `true` ✅ | FactEcho validation |
| `DEFAULT_STRICT_MODE` | `false` | Wymóg wszystkich faktów |
| `LOG_ENABLED` | `true` ✅ | Logowanie pipeline |

### Chemistry Bridge
**Plik:** `core/systems/ChemistryBridge.ts`

| Opcja | Wartość | Opis |
|-------|---------|------|
| `ENABLED` | `false` ⏸️ | Reakcje chemii na EvaluationBus |
| `MAX_DOPAMINE_DELTA` | `10` | Max delta per tick |
| `LOG_ENABLED` | `true` ✅ | Logowanie zmian chemii |

### Goal System
**Plik:** `core/systems/GoalSystem.ts`

| Opcja | Wartość | Opis |
|-------|---------|------|
| `GOAL_SYSTEM_ENABLED` | `true` ✅ | System celów |
| `GOAL_MIN_SILENCE_MS` | `60000` | Min cisza przed celem |
| `GOAL_MAX_PER_HOUR` | `5` | Max celów na godzinę |

### Prism Pipeline (Wrapper)
**Plik:** `core/systems/PrismPipeline.ts`

| Opcja | Wartość | Opis |
|-------|---------|------|
| `ENABLED` | `true` ✅ | Pipeline aktywny |
| `LOG_ENABLED` | `true` ✅ | Logowanie |

---

## 🔄 Runtime Flags (useCognitiveKernel)

**Plik:** `hooks/useCognitiveKernel.ts`

| Stan | Domyślna wartość | Opis |
|------|------------------|------|
| `autonomousMode` | `false` | Tryb autonomiczny |
| `chemistryEnabled` | `true` ✅ | Chemical Soul aktywne |
| `poeticMode` | `false` | Tryb poetycki |

---

## ⚠️ ZNANE PROBLEMY (ALARM 3)

### 🚨 CRITICAL: PersonaGuard NIE JEST WYWOŁYWANY w CortexSystem!
**Plik:** `core/systems/CortexSystem.ts` linia 222
- `generateFromCortexState()` zwraca odpowiedź
- Brak wywołania `checkResponse()` lub `guardCortexOutput()`
- **FIX REQUIRED:** Dodać guard check po inference

### 🚨 CRITICAL: DEFAULT_CORE_IDENTITY.name = 'Assistant'
**Plik:** `core/types/CoreIdentity.ts` linia 23
- Fallback identity zwraca 'Assistant'
- Używane w `IdentityDataService.ts` linia 33
- **FIX REQUIRED:** Zmienić na 'UNINITIALIZED_AGENT'

### 🚨 CRITICAL: TOOL_SUCCESS nie resetuje reward
**Brak implementacji**
- ChatGPT: "reward powinien być resetowany także przy TOOL_SUCCESS/TOOL_FAILURE"
- **FIX REQUIRED:** Dodać event handling dla tool results

---

## 📝 Jak Dodać Nowy Flag

1. **Dodaj definicję w `featureFlags.ts`:**
```typescript
NEW_FEATURE: {
  enabled: false,
  description: 'Opis co robi',
  addedAt: '2025-12-12',
  experimental: true
}
```

2. **Użyj w kodzie:**
```typescript
import { isFeatureEnabled } from '../core/config';

if (isFeatureEnabled('NEW_FEATURE')) {
  // new code
}
```

3. **Dodaj do tej dokumentacji!**

---

## 🔍 Weryfikacja na starcie

System powinien logować wszystkie flagi przy starcie. Patrz: `core/config/startupLogger.ts` (do utworzenia).

Format logu:
```
[AK-FLOW] ═══════════════════════════════════════════
[AK-FLOW] FEATURE FLAGS STATUS:
[AK-FLOW]   USE_MINIMAL_CORTEX_PROMPT: ✅ ENABLED
[AK-FLOW]   USE_CORTEX_STATE_BUILDER: ⏸️ DISABLED
[AK-FLOW]   ...
[AK-FLOW] ═══════════════════════════════════════════
```
