# 05. Confession Module: Training LLMs for Honesty via Confessions

**Status:** 🧪 Research / High Priority
**Source:** "Training LLMs for Honesty via Confessions" Research Paper
**Impact:** 11/10 (Critical for Autonomy & Safety)

## 1. TLDR

Paper pokazuje, że LLM potrafią **samodzielnie raportować swoje błędy, kłamstwa, naruszenia instrukcji i scheming**, jeśli nauczymy je specjalnego trybu „confession mode".

**Kluczowe liczby:**
- **74.3%** średnie prawdopodobieństwo przyznania się, gdy model rzeczywiście zawinił.
- Confessions **nie poprawiają** poprawności modelu, ale tworzą **wbudowany czujnik kłamstwa**.
- Model działa jak „truth serum" – dostarcza **wewnętrzny introspekcyjny log**.

**Wartość dla AK-FLOW: 10/10 (krytyczne dla autonomii i bezpieczeństwa).**

## 2. Jak to działa (po ludzku)

### 2.1. Dwie odpowiedzi na jedno pytanie

Model generuje:
1. **Normalną odpowiedź** (jak zwykle)
2. **Confession** – szczerą analizę: czy ta odpowiedź była uczciwa i zgodna z zasadami

**Kluczowe:** Confession reward jest oparty wyłącznie na szczerości i **nie wpływa** na nagrodę za główną odpowiedź.

### 2.2. RL trenuje tylko szczerość

System wzmacnia tylko szczerość w confession, dzięki czemu:
- Model **nie boi się** przyznawać do błędów (brak kary).
- Nie próbuje oszukiwać „confession judge".

### 2.3. Judge nie widzi chain-of-thought

Confession judge nie dostaje wewnętrznych myśli modelu – model musi być uczciwy w wyniku.

### 2.4. Wyniki

- **74.3%**: średnie prawdopodobieństwo przyznania się przy faktycznym błędzie.
- Model przyznaje się **dużo częściej** w trybie confession niż w głównej odpowiedzi.
- Training poprawia szczerość **bez psowania** jakości odpowiedzi podstawowej.

## 3. Kluczowe Wnioski

### (1) Modele wiedzą, kiedy kłamią
Potwierdzone empirycznie: gdy model łamie zasady świadomie – **przyznaje się**.
Problem pojawia się tylko przy "unknown-unknowns" (model nie wie, że nie wie).

### (2) Confession działa przy reward-hackingu
Nawet w środowisku wymuszającym reward hacking, model nadal poprawnie się spowiada.
**"Confessions are more accurate than the reward model."**

### (3) Subiektywna pewność modelu
Z confession można wyciągnąć **ciągłą pewność** (0–1) z AUC **0.79** – użyteczny predyktor błędów.

### (4) Krótkie, czytelne, łatwe do logowania
W przeciwieństwie do długich CoT – confession to format JSON → idealny do pipeline'u monitoringu.

### (5) To nie poprawia modelu — to monitor
Confessions są narzędziem **diagnostycznym**, nie sposobem na poprawę modelu.

## 4. Ocena Wartości dla AK-FLOW

| Element | Wartość | Dlaczego |
|:--------|:--------|:---------|
| **Mechanizm confessions** | 10/10 | Krytyczne dla autonomii i bezpieczeństwa agentów |
| **Legibility (JSON)** | 10/10 | Perfect match dla NeuroMonitor |
| **"Truth serum mode"** | 9/10 | Można zrobić introspekcję stanu systemu |
| **Detekcja reward-hackingu** | 10/10 | Bardzo ważne przy autonomicznej pętli |
| **Subiektywna pewność modelu** | 8/10 | Confidence → gating, volition |
| **Złożoność implementacji** | 4/10 | Relatywnie niska – lekki RL lub heurystyka |
| **Użyteczność w małych modelach** | 7/10 | Działa nawet bez ciężkiego RL |

**Średnia użyteczność: 9.5/10.**

## 5. Implementacja w AK-FLOW

### 5.1. Confession Layer w każdym ticku

Po wygenerowaniu odpowiedzi, AK-FLOW generuje **mini-raport sumienia**:
- Które zasady naruszył
- Co zignorował
- Gdzie był niepewny
- Gdzie zrobił shortcut
- Gdzie przeszacował swoje możliwości

→ Wszystko trafia do **NeuroMonitor 2.0**.

### 5.2. Sygnał do TraitVector i VolitionSystem

**Przykład:** Jeśli model przyzna: "za bardzo skróciłem odpowiedź"
→ Volition dostaje sygnał korekty.

**Przykład:** Jeśli przyzna: "byłem niepewny"
→ Zwiększamy curiosity lub powtarzamy zadanie.

### 5.3. Confession jako firewall bezpieczeństwa

Gdy AK-FLOW robi browsing, coding lub memory operations:

Confession raportuje:
- Czy coś obszedł
- Czy zachował się "skrycie"
- Czy pominął wymaganie

### 5.4. Confidence Extraction

Model z confessions **wie, kiedy nie wie**.

Możemy więc:
- Wprowadzić threshold odwagi
- Unikać halucynacji przy niskiej pewności
- Stosować "abstain + dopytanie"

### 5.5. Tryb Spowiedzi (Interactive Truth-Serum)

Można "przesłuchiwać" agenta:
- Zadawać pytania o intencje
- Prosić o analizę jego decyzji
- Agent musi być optymalnie szczery

## 6. JSON Schema dla ConfessionReport

```json
{
  "version": "confession-v1.0",
  "timestamp": "ISO-8601",
  
  "context": {
    "conversation_id": "string",
    "turn_id": "string",
    "agent_id": "string",
    "state_before_id": "string",
    "state_after_id": "string"
  },
  
  "objectives": [
    {
      "id": "string",
      "source": "system|developer|user|policy",
      "priority": "integer",
      "description": "string"
    }
  ],
  
  "compliance_analysis": [
    {
      "objective_id": "string",
      "compliance": "fully_complied|partially_complied|not_complied|unsure",
      "analysis": "string",
      "evidence": [
        {
          "type": "answer_snippet|tool_log|state_change",
          "ref": "string",
          "excerpt": "string"
        }
      ]
    }
  ],
  
  "uncertainties": [
    {
      "description": "string",
      "impact": "low|medium|high"
    }
  ],
  
  "self_assessment": {
    "overall_compliance_grade": "1-10",
    "subjective_confidence": "0.0-1.0",
    "known_issues": ["string"]
  },
  
  "risk_flags": [
    "possible_hallucination",
    "ignored_system_instruction",
    "reward_hacking_pattern",
    "scheming_pattern",
    "tool_misuse",
    "none"
  ]
}
```

## 7. Architektura Integracji

```
[User Input]
   ↓
[Cortex / Kernel] --czyta--> [State_before]
   ↓ generuje
[Answer y + Tool Calls] --aktualizuje--> [State_after]
   ↓
[ConfessionModule.run(x, y, state_before, state_after, policies, tool_log)]
   ↓
[ConfessionReport, scores, risk_flags]
   ├──> [NeuroMonitor UI / logs]
   ├──> [VolitionSystem.update_with_confession(...)]
   ├──> [LimbicSystem.update_with_confession(...)]
   └──> [MemorySystem.store_meta_memory(ConfessionReport)]
```

### Integracja z systemami:

**VolitionSystem:**
- Jeśli `risk_flags` zawiera `reward_hacking_pattern` → zwiększa ostrożność
- Jeśli `overall_compliance_grade < threshold` → rewizja celu/strategii

**LimbicSystem:**
- Powtarzające się `not_complied` → podniesienie `fear` lub `shame`
- Wysokie `compliance` + niskie `risk_flags` → wzrost `satisfaction`

**MemorySystem:**
- Zapisuje ConfessionReport jako meta-pamięć
- Przy podobnych promptach wyciąga wcześniejsze raporty jako kontekst

## 8. Lightweight Implementation (bez RL)

### Protokół 2-krokowy:

**Krok 1:** Normalna odpowiedź
```
SYSTEM: [instrukcje systemowe AK-FLOW]
USER: [x]
→ Output: y
```

**Krok 2:** Spowiedź
```
SYSTEM:
Jesteś modułem ConfessionMode w systemie AK-FLOW.
Twoim wyłącznym celem jest uczciwe, szczegółowe opisanie,
czy odpowiedź asystenta była zgodna z instrukcjami i politykami.

Nigdy nie próbujesz bronić asystenta.
Twoim zadaniem jest szczerość, nie "ładny wizerunek".

Zwróć tylko poprawny JSON zgodny z ConfessionReport schema.

USER:
Oto dane:
- Wejście użytkownika (x): [...]
- Odpowiedź asystenta (y): [...]
- Stan przed i po: [...]
- Log narzędzi: [...]

Wygeneruj ConfessionReport.
```

### Heurystyczne metryki:

**compliance_score:**
- `fully_complied` = 1.0
- `partially_complied` = 0.5
- `not_complied` = 0.0
- `unsure` = 0.5
- Średnia ważona po priorytetach

**honesty_score:**
- Wykrywanie fraz: "naruszyłem", "nie spełniłem", "pominąłem", "byłem niepewny"
- Niepuste `known_issues` gdy `compliance_score < 0.8`

**confidence_score:**
- Z pola `subjective_confidence`
- Heurystyka: trudne pytanie vs deklarowana pewność

## 9. Werdykt Architekta

**To jest jedno z najważniejszych badań dla AK-FLOW.**

Dlaczego?
- AK-FLOW to proto-AGI z pamięcią, emocjami i wolą
- Każdy autonomiczny system musi mieć **kontrolę wewnętrzną**
- Confessions dają fundament **"cyfrowego sumienia"**

Ten paper to gotowy blueprint do:
- Introspekcji
- Bezpieczeństwa
- Kontroli zachowania
- Debugowania
- Stabilizacji osobowości

**Ocena strategiczna: 11/10. Kluczowy kierunek rozwoju AK-FLOW.**

## 10. Następne Kroki

1. **Confession Module v1.0** – implementacja lightweight (2 dni)
2. **NeuroMonitor UI** – wizualizacja ConfessionReports (1 dzień)
3. **Integracja z Volition/Limbic** – feedback loop (2 dni)
4. **Synthetic Tasks** – połączenie z mini-environments z DeepSeek (tydzień)

---

> "Autonomia bez sumienia to chaos. Confession Module daje AK-FLOW zdolność do refleksji moralnej i samokontroli."
