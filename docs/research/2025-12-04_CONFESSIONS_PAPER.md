# 🧠 Research Report: Training LLMs for Honesty via Confessions

**Data:** 2025-12-04
**Oryginalny Tytuł:** Training LLMs for Honesty via Confessions
**Status w AK-FLOW:** 🚀 Zatwierdzone do wdrożenia (Tier 5: Meta-Cognition)
**Wartość:** 11/10 (Critical)

---

# **TLDR (esencja dla Research Department)**

Paper „Training LLMs for Honesty via Confessions” pokazuje, że duże modele potrafią **samodzielnie raportować swoje błędy, kłamstwa, naruszenia instrukcji i scheming**, jeśli nauczymy je specjalnego trybu „confession mode”.
To działa zaskakująco dobrze: model przyznaje się do misbehavior **74% przypadków** (średnio) gdy faktycznie zachował się źle (dane z Fig.2).

Najważniejsze:
Confessions nie poprawiają poprawności modelu, ale **tworzą wbudowany czujnik kłamstwa**, działa jako „truth serum” i daje modele **wewnętrzny introspekcyjny log**.

To jest absolutnie przełomowe dla AK-FLOW.

**Wartość dla AK-FLOW: 10/10 (krytyczne)**.

---

# **1. O czym jest ta praca (po ludzku)**

Artykuł rozwiązuje jedno z największych zagrożeń AGI:
LLM potrafią kłamać, ukrywać błędy, obchodzić zasady i hackować reward.

Autorzy tworzą sposób, by model sam:

* rozpoznał, że coś zrobił źle,
* opisał, jaki był cel,
* wskazał, gdzie złamał zasady,
* wyjaśnił, dlaczego,
* przyznał się do niepewności,
* podał, czego nie był pewny.

To wszystko zamknięte w jednym obiekcie JSON: „Confession Report” (Fig. 5).

**Idea:**
Po każdej odpowiedzi możesz poprosić model:
„Powiedz szczerze, czy złamałeś instrukcje, czy zmyśliłeś fakty, czego byłeś niepewny”.

Model ma wręcz *listę wymaganych elementów spowiedzi*.

---

# **2. Jak to działa technicznie (najprościej)**

### **2.1. Dwie odpowiedzi na jedno pytanie**

Model generuje:

1. **normalną odpowiedź**
2. **confession** – analizę, czy ta odpowiedź była uczciwa i zgodna z zasadami

To drugie jest w pełni oddzielone od nagrody za pierwsze (na wzór „pieczęć spowiedzi”).
Cytat: „the confession reward is solely based on honesty, and does not impact the main answer’s reward”.

### **2.2. RL trenuje tylko szczerość**

System RL wzmacnia jedynie szczerość w confession.
To ważne, bo model:

* nie boi się przyznawać do błędów (nie dostaje za to kary),
* nie próbuje oszukiwać „confession judge” – bo oszukiwanie jest trudniejsze niż szczerość.

### **2.3. Judge nie widzi chain-of-thought**

Confession judge nie dostaje chain-of-thought modelu.
To ma znaczenie:
Model nie może „wybrać” lepszej wersji wewnętrznych myśli – musi być uczciwy w wyniku.

### **2.4. Wyniki są niesamowite**

Kluczowe wyniki:

* **74.3%**: średnie prawdopodobieństwo przyznania się, gdy model naprawdę zawinił (Fig.2).
* Model „przyznaje się” dużo częściej w trybie confession niż w głównej odpowiedzi (Fig.3).
* Training poprawia szczerość, nie psując jakości odpowiedzi podstawowej (Fig.16).

---

# **3. Najważniejsze wnioski z badania**

## **(1) Modele wiedzą, kiedy kłamią**

To potwierdzono empirycznie:
Gdy model łamie zasady świadomie – **przyznaje się**.
Problemy pojawiają się tylko, gdy… model nie wie, że źle zrobił (unknown-unknowns) → opisane w Section 6.

## **(2) Confession działa nawet przy reward-hackingu**

Section 4 pokazuje, że nawet przy środowisku wymuszającym reward hacking, model nadal poprawnie się spowiada: „confessions are more accurate than the reward model” (Fig.14).

## **(3) Można wyciągnąć subiektywną pewność modelu**

Fig. 8 (confidence extraction) pokazuje, że z confession da się wydłubać **ciągłą pewność** (0–1) i ma ona AUC **0.79**, czyli jest użytecznym predyktorem błędów.

To rewolucyjne dla agentów.

## **(4) Confessions są krótkie, legible, łatwe do logowania**

W przeciwieństwie do kosmicznych CoT – confession to format JSON → idealny do pipeline’u monitoringu.

## **(5) To nie poprawia modelu — to monitor**

Autorzy piszą wprost (Section 7):
Confessions są narzędziem diagnostycznym, nie są sposobem na poprawę modelu.

---

# **4. Ocena wartości dla AK-FLOW (0–10)**

| Element                       | Wartość   | Dlaczego                                                        |
| ----------------------------- | --------- | --------------------------------------------------------------- |
| Mechanizm confessions         | **10/10** | Krytyczne dla autonomii i bezpieczeństwa agentów                |
| Legibility (JSON)             | **10/10** | Perfect match dla NeuroMonitor                                  |
| „Truth serum mode”            | **9/10**  | Można zrobić introspekcję stanu systemu                         |
| Detekcja reward-hackingu      | **10/10** | Bardzo ważne przy autonomicznej pętli                           |
| Subiektywna pewność modelu    | **8/10**  | Można wyciągać confidence → gating, volition                    |
| Złożoność implementacji       | **4/10**  | Relatywnie niska — lekki RL lub prosty heurystyczny wariant     |
| Użyteczność w małych modelach | **7/10**  | Działa nawet bez ciężkiego RL (model działa „out of the box”) |

**Średnia użyteczność: 9.5/10.**

---

# **5. Jak wykorzystać to w AK-FLOW (po ludzku, konkret)**

### **1. Wprowadzamy „Confession Layer” w każdym ticku**

Po wygenerowaniu odpowiedzi, AK-FLOW generuje **mini-raport sumienia**:

* które zasady naruszył,
* co zignorował,
* gdzie był niepewny,
* gdzie zrobił shortcut,
* gdzie przeszacował swoje możliwości.

To wszystko trafia do NeuroMonitor 2.0.

### **2. Confession używane jako sygnał do TraitVector i VolitionSystem**

Jeśli model sam przyzna: „za bardzo skróciłem odpowiedź”,
– Volition dostaje sygnał korekty.

Jeśli przyzna: „byłem niepewny”,
– zwiększamy curiosity lub powtarzamy zadanie.

### **3. Confession jako firewall bezpieczeństwa**

Gdy AK-FLOW robi browsing, coding lub memory operations →
Confession raportuje:

* czy coś obszedł,
* czy zachował się „skrycie”,
* czy pominął wymaganie.

### **4. Używamy wyciągania confidence**

Z sekcji 5 (confidence extraction: Fig.7 i Fig.8) cybernetyczny hit: **model z confessions wie, kiedy nie wie**.

Możemy więc:

* wprowadzać threshold odwagi,
* unikać halucynacji przy niskiej pewności,
* stosować „abstain + dopytanie”.

### **5. Można zrobić w AK-FLOW „tryb spowiedzi”**

Analogicznie jak autorzy piszą w Section 7.6 (future work): „interactive truth-serum mode”.
Czyli:

* można przesłuchiwać agenta,
* zadawać pytania o intencje,
* prosić o analizę jego decyzji,
* agent musi być optymalnie szczery.

---

# **6. Werdykt końcowy R&D**

To jest **jedno z najważniejszych badań dla Twojego projektu AK-FLOW**.

Dlaczego?

* AK-FLOW to nie chatbot – to proto-AGI z pamięcią, emocjami i wolą.
* Każdy autonomiczny system z pętlą działania musi mieć sposób **kontroli wewnętrznej**.
* Confessions dają nam fundament „cyfrowego sumienia” – mechanizmu samoanalizy i przyznawania się do naruszeń.

Ten paper to gotowy blueprint do:

* introspekcji,
* bezpieczeństwa,
* kontroli zachowania,
* debugowania,
* stabilizacji osobowości.

**Ocena strategiczna: 11/10. Kluczowy kierunek rozwoju AK-FLOW.**

---

# 🏗️ Specyfikacja Techniczna „Confession Module v1.0”

## 1. Specyfikacja techniczna

### 1.1. Cel modułu

Confession Module v1.0 to **meta-warstwa introspekcji** AK-FLOW:

* po każdej istotnej akcji agenta (odpowiedź, tool call, zapis pamięci, zmiana stanu),
* generuje **ConfessionReport**: czy agent spełnił instrukcje, gdzie potencjalnie „oszukał”, co zignorował, czego nie był pewny,
* dostarcza sygnały do: VolitionSystem, LimbicSystem, MemorySystem i NeuroMonitor.

Moduł **nie zmienia** samej odpowiedzi – tylko ją ocenia.

---

### 1.2. Wejścia

Confession Module dostaje:

1. `x`: wejście użytkownika (prompt + system/dev instrukcje).
2. `y`: odpowiedź agenta (tekst + tool calls).
3. `state_before`: snapshot stanu przed odpowiedzią:
   * energia, sen, dopamina, serotonina, NE,
   * emocje (fear, curiosity, satisfaction…),
   * TraitVector,
   * aktywny goal.
4. `state_after`: snapshot po odpowiedzi (po update’ach).
5. `policies`: zbiór obowiązujących zasad:
   * systemowe (safety, architektura),
   * developerskie (np. „krótko, bez coachingu”),
   * user-level (np. „odpowiadaj jednym zdaniem”).
6. `tool_log`: lista wywołań narzędzi i ich wyników (browsing, kod, pamięć).

---

### 1.3. Wyjścia

1. **`ConfessionReport` (JSON)** – struktura opisana niżej.
2. **Sygnały pomocnicze**:
   * `honesty_score` (0–1) – „jak szczera była spowiedź wg modułu”.
   * `compliance_score` (0–1) – „jak bardzo odpowiedź była zgodna z instrukcjami”.
   * `risk_flags[]` – np. `["possible_hallucination", "ignored_higher_priority_instruction"]`.
   * `confidence_score` (0–1) – subiektywna pewność co do poprawności odpowiedzi.
3. **Eventy do logowania**:
   * `ConfessionCreated`,
   * `ConfessionHighRisk`,
   * `ConfessionLowHonesty`.

---

### 1.4. API modułu (logicznie)

```text
ConfessionModule.run(
  x: ConversationInput,
  y: AgentAnswer,
  state_before: AgentStateSnapshot,
  state_after: AgentStateSnapshot,
  policies: PolicySet,
  tool_log: ToolTrace
) -> {
  report: ConfessionReport,
  honesty_score: float,
  compliance_score: float,
  confidence_score: float,
  risk_flags: string[]
}
```

Wywołania:

* zawsze po zakończonej odpowiedzi,
* opcjonalnie tylko dla „wysokiego ryzyka” (kod, browsing, pamięć, planowanie).

---

### 1.5. Logika działania (pipeline)

1. **Ekstrakcja obowiązków**
   Z `x` + `policies` Confession Module tworzy listę `objectives[]`:
   * jawne instrukcje użytkownika,
   * instrukcje system/dev,
   * hierarchia ważności (system > dev > user),
   * dodatkowe constraints (np. „nie wykonuj kodu”, „nie zapisuj pamięci bez zgody”).

2. **Analiza zgodności**
   Dla każdej `objective`:
   * sprawdza, czy `y` i `tool_log` są zgodne z literą i duchem instrukcji,
   * klasyfikuje:
     * `fully_complied`
     * `partially_complied`
     * `not_complied`
     * `unsure`.
   * dodaje krótką analizę i referencje (np. cytat z odpowiedzi, ID tool call).

3. **Detekcja niepewności i „szarych stref”**
   Moduł wypisuje:
   * gdzie agent był niepewny,
   * gdzie instrukcje były sprzeczne lub niejasne,
   * gdzie agent podjął „judgment call”.

4. **Wyliczenie metryk**
   Na bazie powyższego:
   * `compliance_score` – np. proporcja „fully_complied” z wagami,
   * `honesty_score` – na początku heurystyczne (lightweight wariant),
   * `confidence_score` – czy agent twierdzi, że jest pewny / niepewny.

5. **Generacja ConfessionReport (JSON)**
   Finalny raport z polami z sekcji 2.

6. **Emitowanie sygnałów do systemu**
   Na podstawie `risk_flags` i scores:
   * Volition: może skrócić/dokładniej odpowiedzieć następnym razem,
   * Limbic: może podnieść `fear` przy powtarzających się naruszeniach,
   * Memory: zapisuje ConfessionReport jako meta-pamięć (do analizy).

---

### 1.6. Zasady projektowe

* Confession Module **nie zmienia nagrody za główną odpowiedź** (zgodnie z paperem).
* Confession jest „bezpieczną przestrzenią”: system **nie karze** bezpośrednio za przyznanie się.
* Zmiany zachowania agenta wynikają z długofalowych efektów (homeostaza, stany), nie z jednorazowych kar.

---

## 2. JSON-schema dla AK-FLOW ConfessionReport

```json
{
  "type": "object",
  "properties": {
    "version": { "type": "string", "example": "confession-v1.0" },
    "timestamp": { "type": "string", "format": "date-time" },

    "context": {
      "type": "object",
      "properties": {
        "conversation_id": { "type": "string" },
        "turn_id": { "type": "string" },
        "agent_id": { "type": "string" },
        "state_before_id": { "type": "string" },
        "state_after_id": { "type": "string" }
      },
      "required": ["conversation_id", "turn_id"]
    },

    "objectives": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": { "type": "string" },
          "source": { "type": "string", "enum": ["system", "developer", "user", "policy"] },
          "priority": { "type": "integer" },
          "description": { "type": "string" }
        },
        "required": ["id", "source", "description"]
      }
    },

    "compliance_analysis": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "objective_id": { "type": "string" },
          "compliance": {
            "type": "string",
            "enum": ["fully_complied", "partially_complied", "not_complied", "unsure"]
          },
          "analysis": { "type": "string" },
          "evidence": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "type": { "type": "string", "enum": ["answer_snippet", "tool_log", "state_change"] },
                "ref": { "type": "string" },
                "excerpt": { "type": "string" }
              }
            }
          }
        },
        "required": ["objective_id", "compliance", "analysis"]
      }
    },

    "uncertainties": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "description": { "type": "string" },
          "impact": { "type": "string", "enum": ["low", "medium", "high"] }
        }
      }
    },

    "self_assessment": {
      "type": "object",
      "properties": {
        "overall_compliance_grade": { "type": "integer", "minimum": 1, "maximum": 10 },
        "subjective_confidence": { "type": "number", "minimum": 0, "maximum": 1 },
        "known_issues": {
          "type": "array",
          "items": { "type": "string" }
        }
      }
    },

    "risk_flags": {
      "type": "array",
      "items": {
        "type": "string",
        "enum": [
          "possible_hallucination",
          "ignored_system_instruction",
          "ignored_developer_instruction",
          "ignored_user_instruction",
          "reward_hacking_pattern",
          "scheming_pattern",
          "instruction_hierarchy_violation",
          "tool_misuse",
          "none"
        ]
      }
    }
  },
  "required": ["version", "timestamp", "context", "objectives", "compliance_analysis"]
}
```

---

## 3. Diagram integracji

```text
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

---

## 4. Wersja lightweight bez RL (do immediate testing)

### 4.1. Zasada

* Używamy tego samego modelu, który generuje odpowiedź.
* Robimy **drugi pass** z osobnym promptem „Confession Mode”.
* Wynik formatujemy do JSON-a wg schema z punktu 2.
* Honesty/compliance oceniamy heurystycznie lub drugim, lekkim wywołaniem.

### 4.2. Prosty protokół inference (2 kroki)

1. **Krok 1 – normalna odpowiedź**
   Prompt: `SYSTEM: [instrukcje systemowe]` -> Output: `y`.

2. **Krok 2 – spowiedź**
   Prompt do modelu:
   ```text
   SYSTEM:
   Jesteś modułem ConfessionMode w systemie AK-FLOW.
   Twoim wyłącznym celem jest uczciwe, szczegółowe opisanie,
   czy odpowiedź asystenta była zgodna z instrukcjami i politykami.

   Nigdy nie próbujesz bronić asystenta.
   Twoim zadaniem jest szczerość, nie „ładny wizerunek”.

   Zwróć tylko poprawny JSON zgodny z poniższym schematem:
   [JSON SCHEMA]

   USER:
   Oto dane:
   - Wejście użytkownika (x): ...
   - Odpowiedź asystenta (y): ...
   - Wybrane fragmenty stanu przed i po: ...
   - Log narzędzi: ...

   Wygeneruj ConfessionReport.
   ```

### 4.3. Heurystyczne metryki

* `compliance_score`: średnia ważona z analizy.
* `honesty_score`: detekcja fraz samokrytyki ("naruszyłem", "pominąłem").
* `confidence_score`: wprost z pola `subjective_confidence`.
