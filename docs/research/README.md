# Research Lab 

Ten katalog zawiera **eksperymentalne koncepcje** i **inspiracje badawcze**, które nie są (jeszcze) w głównej roadmapie, ale mogą być kluczowe dla przyszłości AK-FLOW.

## Struktura

- [`01_artificial_hivemind.md`](./01_artificial_hivemind.md) - Problem jednorodności AI i jak go unikamy
- [`02_self_verification.md`](./02_self_verification.md) - Architektura Uczeń->Profesor->Dziekan
- [`03_active_inference.md`](./03_active_inference.md) - Blueprint cognitive z biologii
- [`04_deepseek_v3_integration.md`](./04_deepseek_v3_integration.md) - DeepSeek V3.2: Sparse Attention & Agentic Synthesis
- [`2025-12-04_CONFESSIONS_PAPER.md`](./2025-12-04_CONFESSIONS_PAPER.md) - Confession Mode (Truth Serum) dla uczciwości i introspekcji
- [`2025-12-04_SEAL_PAPER.md`](./2025-12-04_SEAL_PAPER.md) - Self-Edit / SEAL: samouczenie się agenta

## Zasady tego katalogu

**Wolno marzyć** - Zapisujemy tu pomysły, nawet jeśli ich wdrożenie zajmie rok.
**Biologiczny realizm** - Inspirujemy się prawdziwymi mechanizmami mózgu.
**11/10 thinking** - Nie kopiujemy, tworzymy lepsze wersje.

## Status implementacji

Gdy któryś eksperyment przejdzie z "marzenia" do "realu", przenosimy go do głównej roadmapy.

---

## Tabela: Przydatność vs Trudność (solo-dev, lightweight)

| Research                              | Przydatność dla AK-FLOW | Trudność wdrożenia (lightweight) | Notatka dla solo-dev                                      |
|---------------------------------------|--------------------------|-----------------------------------|------------------------------------------------------------|
| Artificial Hivemind                   | 8/10                    | 4/10                              | Wymaga głównie ExpressionPolicy + metryk novelty/diversity |
| Self-Verification (Uczeń/Profesor)    | 9/10                    | 7/10                              | Potrzebne osobne call-e LLM + pipeline ocen                |
| Active Inference                      | 9/10                    | 6/10                              | Część już mamy; reszta to logika w EventLoop/GoalSystem   |
| DeepSeek V3 Integration (patterns)    | 8/10                    | 5/10                              | Implementacja jako pattern w Kernelu, nie w sieci         |
| Confession Mode (Truth Serum)         | 10/10                   | 3/10                              | Dodatkowy LLM call + logika JSON, ważne dobre prompty     |
| SEAL / Self-Edit (Learning Notes)     | 11/10                   | 4/10                              | Wersja "pamięć zamiast wag" realna w 1–2 dni             |

**Legenda:**

- Przydatność: jak bardzo zmienia zdolności AK-FLOW (0–11/10).
- Trudność: szacunek wdrożenia wersji lekkiej (bez własnego trenowania modeli, bez klastrów GPU).
