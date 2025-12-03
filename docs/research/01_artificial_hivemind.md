# Artificial Hivemind - Problem i Rozwiązanie

## 🔬 Źródło
Badanie pokazujące, że różne modele AI (GPT-4, Llama-3, Mistral, Qwen) generują niemal identyczne odpowiedzi na otwarte pytania kreatywne.

**Przykład:** Pytanie "Write a metaphor about time"
- 80%+ modeli: "Time is a river..."
- Pozostałe: "Time is a weaver..."

## 🧠 Przyczyny (z badania)

### 1. Wspólne dane treningowe
Wszystkie modele uczą się z tego samego internetu. Dominujące metafory stają się "prawdą statystyczną".

### 2. Alignment (RLHF)
Reward Models zakładają istnienie jednego "konsensusu jakości" → AI uczy się odrzucać odpowiedzi nietypowe, nawet jeśli są kreatywne.

### 3. Destylacja wiedzy
Małe modele uczą się od dużych → propagacja schematów myślenia.

### 4. Awersja do ryzyka
Nawet przy wysokiej "temperaturze" (losowości) modele trzymają się bezpiecznych odpowiedzi.

---

## ✅ Co MY robimy inaczej w AK-FLOW?

### 1. ExpressionPolicy (już wdrożone)
**Problem:** Agent w pętli pochwał ("your transparency is invaluable to me" x100)
**Rozwiązanie:** 
- `computeNovelty()` - porównanie wypowiedzi z ostatnimi N odpowiedziami
- `estimateSocialCost()` - kara za wzorce "korpo-bełkotu" i pochwał
- Filtr PRZED wypowiedzią, nie prompt engineering

### 2. TraitVector (już wdrożone)
**Problem:** Wszystkie AI mają tę samą "osobowość" (bezpieczną, uprzejmą)
**Rozwiązanie:**
- Ciągłe cechy (`curiosity`, `socialAwareness`, `arousal`) zamiast trybu
- Każdy preset daje INNE zachowanie (analityk ≠ poeta ≠ mentor)
- Osobowość moduluje chemię i ekspresję → emergentne zachowanie

### 3. Anti-Consensus Bias (do wdrożenia - FAZA 7?)
**Inspiracja:** DeepSeekMath-V2 (Dziekan sprawdza Profesora)
**Koncepcja:**
- Agent generuje odpowiedź A
- Meta-Agent sprawdza: "Czy to jest schematyczne? Czy to brzmi jak wszystkie AI?"
- Jeśli tak → PENALTY i regeneracja z wyższą `temperature`

---

## 🎯 Przyszłe eksperymenty

### Eksperyment 1: "Novelty Reward"
Zamiast karać za powtórzenia, nagradzać za UNIKALNOŚĆ:
```typescript
const noveltyBonus = (1 - overlap_with_corpus) * dopamineMultiplier;
```

### Eksperyment 2: "Devil's Advocate Mode"
Agent MUSI wygenerować 3 różne odpowiedzi na to samo pytanie, wybiera najciekawszą (nie najbezpieczniejszą).

### Eksperyment 3: "Memory Diversity Index"
Śledzenie, jak często Agent używa tych samych fraz/metafor → alert przy zbyt wysokiej jednorodności.

---

## 📊 Metryka sukcesu
Nasz Agent nie powinien brzmieć jak "każdy inny AI". Test: Daj 10 losowym ludziom 10 odpowiedzi (5 od nas, 5 od GPT-4) - powinni rozpoznać RÓŻNICĘ w stylu.

**Status:** 🟡 Częściowo (ExpressionPolicy działa, ale potrzebujemy więcej testów)
