# Dead Code Triage

Goal: stop deleting by hunch. Every candidate gets a callsite audit.

Rules:
- KEEP: at least one callsite in `src/**` (including lazy imports in tools).
- QUARANTINE: no callsite, but historical/reference value.
- DELETE: no callsite + no reference value + causes confusion.

Pola (skrót):
- Co robi
- Korzyść
- Wada/ryzyko
- Callsite (gdzie żyje)
- Decyzja (KEEP / QUARANTINE / DELETE)

## KEEP (używane w runtime)

`SessionMemoryService`
Co robi: Dostarcza fakty o sesjach (dziś/wczoraj/tematy) do kontekstu LLM.
Korzyść: Odpowiedzi na pytania o historię są ugruntowane.
Wada/ryzyko: Zależy od storage; trzeba defensywnie fallbackować.
Callsite: `src/core/systems/cortex/processUserMessage.ts`, `src/core/systems/eventloop/AutonomousVolitionStep.ts`.
Decyzja: KEEP.

`SnapshotService`
Co robi: Generuje snapshot + zapis do DB.
Korzyść: Twardy artefakt stanu.
Wada/ryzyko: Wymaga supabase; bez niego tylko lokalnie.
Callsite: `src/tools/toolParser.ts` (lazy import).
Decyzja: KEEP.

`GoalSystem`
Co robi: Formowanie celów + journaling.
Korzyść: Autonomia ma „co robić”.
Wada/ryzyko: Może spamować celami bez zdrowych limitów.
Callsite: `src/core/systems/EventLoop.ts`.
Decyzja: KEEP.

`ConversationArchive`
Co robi: Archiwizuje rozmowy do bazy.
Korzyść: Historia rozmów i session stats.
Wada/ryzyko: Supabase down = brak danych.
Callsite: `src/hooks/useCognitiveKernelLite.ts`, `src/core/memory/ConversationStore.ts`, `src/services/SnapshotService.ts`.
Decyzja: KEEP.

`PrismMetrics`
Co robi: Trust index + limity kar.
Korzyść: Chroni przed nadmiernym karaniem i drift.
Wada/ryzyko: Trudne do debugowania, jeśli metryki się rozjadą.
Callsite: `src/core/systems/FactEchoPipeline.ts`.
Decyzja: KEEP.

`BiologicalClock`
Co robi: Harmonogram ticków (sen/czuwanie).
Korzyść: Stabilny rytm ticków.
Wada/ryzyko: Złe progi mogą spowolnić reakcje.
Callsite: `src/core/kernel/reducer/handlers/tick.ts`.
Decyzja: KEEP.

`ConfessionService`
Co robi: Samoregulacja + raporty zgodności.
Korzyść: Kontrola jakości i transparentność.
Wada/ryzyko: Głośne logi przy awariach.
Callsite: `src/runtime/initRuntime.ts`.
Decyzja: KEEP.

`TraitEvolutionEngine`
Co robi: Homeostaza cech osobowości.
Korzyść: Stabilna ewolucja traits.
Wada/ryzyko: Ukryty singleton (trudniej testować).
Callsite: `src/core/services/WakeService.ts`.
Decyzja: KEEP.

## KANDYDACI DO ZMIANY (TBD)

`VolitionSystem.shouldSpeak`
Co robi: Legacy gate mowy (treść, powtórki, refractory window, limbic fear, silence bonus, próg).
Korzyść: Było główną logiką mowy przed ExecutiveGate.
Wada/ryzyko: Dual-path, brak callsite w runtime.
Callsite: `__tests__/unit/VolitionSystem.test.ts` tylko.
Decyzja: QUARANTINE albo DELETE.

`VolitionSystem.evaluateVolition`
Co robi: Prosty legacy gate (content + voicePressure > 0.75).
Korzyść: Minimalny wrapper wsteczny.
Wada/ryzyko: Nieużywany, może mylić.
Callsite: `src/core/systems/VolitionSystem.ts` export only.
Decyzja: QUARANTINE albo DELETE.
