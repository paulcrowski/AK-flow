# 🔧 AK-FLOW Procedures

> *"Procedura to pamięć instytucjonalna - chroni przed powtarzaniem błędów."*
> 
> Wersja: **ALARM-3 STANDARD** | Data: 2025-12-12

---

## 📋 Spis Treści

1. [Procedura Nowej Funkcji](#-procedura-nowej-funkcji)
2. [Procedura Zamknięcia Dnia](#-procedura-zamknięcia-dnia)
3. [Procedura Przed Wdrożeniem](#-procedura-przed-wdrożeniem)
4. [Procedura Debugowania](#-procedura-debugowania)
5. [Procedura Audytu](#-procedura-audytu)

---

## 🆕 Procedura Nowej Funkcji

> **ALARM-3 STANDARD**: Każda nowa funkcja MUSI przejść przez te kroki.

### Checklist

```
═══════════════════════════════════════════════════════════════════════════
🔧 NEW FEATURE CHECKLIST
═══════════════════════════════════════════════════════════════════════════

□ 1. CONFIG
   └─ Dodaj przełącznik do core/config/systemConfig.ts
   └─ NIE twórz lokalnych const ENABLED = true
   
□ 2. INVARIANT
   └─ Jeśli system krytyczny → dodaj do CRITICAL_SYSTEMS w wiringValidator.ts
   └─ Dodaj test do __tests__/IntegrationWiring.test.ts
   
□ 3. TELEMETRY
   └─ Dodaj log na wejściu: [ModuleName] ACTION: details
   └─ Dodaj log na wyjściu z wynikiem
   
□ 4. WIRING CHECK
   └─ Upewnij się że funkcja jest WYWOŁANA w main flow
   └─ Nie tylko zdefiniowana - UŻYWANA!
   
□ 5. TEST
   └─ Unit test dla logiki
   └─ Integration test dla wiring
   
□ 6. DOCUMENTATION
   └─ docs/FEATURE_FLAGS.md - jeśli nowy flag
   └─ docs/STATUS.md - aktualizuj "Co działa"

═══════════════════════════════════════════════════════════════════════════
```

### Przykład

```typescript
// 1. CONFIG - w core/config/systemConfig.ts
myNewFeature: {
  enabled: true,
  threshold: 0.5,
}

// 2. INVARIANT - w core/config/wiringValidator.ts
{
  name: 'MyNewFeature',
  description: 'Does something important',
  configPath: 'myNewFeature.enabled',
  testFn: async () => {
    const { myFunction } = await import('../systems/MySystem');
    return typeof myFunction === 'function';
  }
}

// 3. TELEMETRY - w samym module
console.log(`[MySystem] ACTION: doing thing with value=${value}`);

// 4. WIRING - upewnij się że jest wywołane!
// W EventLoop.ts lub CortexSystem.ts:
if (SYSTEM_CONFIG.myNewFeature.enabled) {
  myFunction(ctx);
}
```

---

## 🌙 Procedura Zamknięcia Dnia

> Wykonuj to NA KOŃCU każdej sesji pracy.

### Checklist

```
═══════════════════════════════════════════════════════════════════════════
🌙 END OF DAY PROCEDURE
═══════════════════════════════════════════════════════════════════════════

□ 1. TESTY
   └─ npm test -- --run
   └─ Wszystkie MUSZĄ przechodzić przed commitem!

□ 2. WIRING VALIDATION
   └─ Sprawdź czy validateWiring() pokazuje wszystko ACTIVE
   └─ npm run dev → sprawdź logi przy starcie

□ 3. COMMIT
   └─ git add .
   └─ git commit -m "YYYY-MM-DD: [krótki opis zmian]"
   └─ git push

□ 4. DAILY LOG
   └─ Stwórz/zaktualizuj docs/daily-logs/SESSION_LOG_YYYY_MM_DD.md
   └─ Użyj template poniżej

□ 5. STATUS UPDATE
   └─ Zaktualizuj docs/STATUS.md jeśli duże zmiany
   └─ Zaktualizuj liczniki testów

□ 6. TOMORROW NOTE
   └─ Zapisz co robić jutro w daily log
   └─ 3 punkty max!

═══════════════════════════════════════════════════════════════════════════
```

### Template Daily Log

```markdown
# 📅 Session Log: YYYY-MM-DD

## 🎯 Cel dnia
- [co chciałeś osiągnąć]

## ✅ Co zrobione
- [lista zrealizowanych zadań]

## ❌ Co nie zrobione
- [lista niezrealizowanych - dlaczego?]

## 🐛 Napotkane problemy
- [problemy i jak je rozwiązałeś]

## 📊 Metryki
- Testy: X passed
- Nowe pliki: X
- Zmodyfikowane: X

## 🔮 Na jutro
1. [priorytet 1]
2. [priorytet 2]
3. [priorytet 3]

## 💡 Przemyślenia
- [notatki, pomysły, wnioski]
```

---

## 🚀 Procedura Przed Wdrożeniem

```
═══════════════════════════════════════════════════════════════════════════
🚀 PRE-DEPLOYMENT CHECKLIST
═══════════════════════════════════════════════════════════════════════════

□ 1. npm test -- --run
   └─ WSZYSTKIE testy MUSZĄ przechodzić
   └─ Zero failures, zero errors

□ 2. npm run dev
   └─ Sprawdź logi przy starcie
   └─ validateWiring() = ALL ACTIVE
   └─ logSystemConfig() = expected flags

□ 3. MANUAL TEST
   └─ "Jak masz na imię?" → poprawna nazwa
   └─ "Jaki dziś dzień?" → poprawna data
   └─ 60s ciszy → dopamine spada w logach

□ 4. GIT
   └─ git status - sprawdź co commitujesz
   └─ git diff - przejrzyj zmiany
   └─ git commit z sensownym message

□ 5. PUSH
   └─ git push
   └─ Sprawdź że nie ma błędów

═══════════════════════════════════════════════════════════════════════════
```

---

## 🔍 Procedura Debugowania

```
═══════════════════════════════════════════════════════════════════════════
🔍 DEBUG PROCEDURE
═══════════════════════════════════════════════════════════════════════════

□ 1. ZIDENTYFIKUJ PROBLEM
   └─ Co dokładnie nie działa?
   └─ Kiedy zaczęło nie działać?
   └─ Jakie logi widzisz?

□ 2. SPRAWDŹ WIRING
   └─ validateWiring() - czy wszystko ACTIVE?
   └─ Czy funkcja jest WYWOŁANA czy tylko ZDEFINIOWANA?

□ 3. SPRAWDŹ CONFIG
   └─ Czy flag jest włączony w systemConfig.ts?
   └─ logSystemConfig() - co pokazuje?

□ 4. SPRAWDŹ TELEMETRIĘ
   └─ Szukaj logów: [ModuleName] ACTION:
   └─ Czy logi w ogóle się pojawiają?

□ 5. IZOLUJ PROBLEM
   └─ Stwórz minimalny test case
   └─ Dodaj do __tests__/

□ 6. NAPRAW I POTWIERDŹ
   └─ Napraw
   └─ npm test -- --run
   └─ Sprawdź że fix nie psuje czegoś innego

═══════════════════════════════════════════════════════════════════════════
```

---

## 🔬 Procedura Audytu (ALARM-3)

> Wykonuj gdy coś "dziwnie działa" lub przed dużym release.

```
═══════════════════════════════════════════════════════════════════════════
🔬 ALARM-3 AUDIT PROCEDURE
═══════════════════════════════════════════════════════════════════════════

□ 1. WIRING
   └─ validateWiring() - wszystko ACTIVE?
   └─ Przejrzyj CRITICAL_SYSTEMS - czy coś brakuje?

□ 2. CONFIG
   └─ Czy wszystkie przełączniki są w systemConfig.ts?
   └─ grep -r "const.*ENABLED" core/ - nie powinno być!

□ 3. IDENTITY
   └─ grep -r "Assistant" core/ - tylko w PersonaGuard jako wykrywany błąd
   └─ DEFAULT_CORE_IDENTITY.name === 'UNINITIALIZED_AGENT'

□ 4. TELEMETRY
   └─ PROMPT_HARDFACTS pojawia się przed każdym LLM call?
   └─ DOPAMINE_TICK pojawia się co tick?

□ 5. TESTS
   └─ npm test -- --run
   └─ Sprawdź __tests__/IntegrationWiring.test.ts

□ 6. MANUAL
   └─ Test imienia
   └─ Test daty
   └─ Test ciszy (60s)

═══════════════════════════════════════════════════════════════════════════
```

---

## 🏆 Złote Zasady

1. **Config w jednym miejscu** - `systemConfig.ts`
2. **Każdy system ma test wiring** - `IntegrationWiring.test.ts`
3. **Telemetria przed optymalizacją** - loguj wszystko
4. **Zdefiniowane ≠ Używane** - sprawdzaj wiring!
5. **Testy przed commitem** - zawsze

---

*Procedury są po to, żeby nie powtarzać błędów. Szanuj je.*
