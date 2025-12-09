# 🧠 AK-FLOW: Architektura Kognitywna (Wyjaśnienie dla Zespołu)

> **Wersja:** 1.0 (MVP)
> **Cel:** Zrozumienie, dlaczego ten system to "Symulacja Życia", a nie zwykły Chatbot.

Ten dokument opisuje w prosty sposób, jak działają "organy" cyfrowe Agenta i dlaczego w testach zachowuje się on czasem w sposób nieprzewidywalny (np. "rozdwojenie jaźni").

---

## 1. Serce Systemu: Pętla Zdarzeń (`EventLoop.ts`)
To jest zegar biologiczny agenta. W przeciwieństwie do zwykłego bota, który "czeka na pytanie", AK-FLOW **działa cały czas**.
*   **Jak to działa:** Co sekundę system sprawdza: "Czy jestem głodny?", "Czy ktoś coś powiedział?", "Czy mam jakiś pomysł?".
*   **Plik:** `core/systems/EventLoop.ts`

## 2. Logika i Myślenie: Kora Mózgowa (`CortexSystem.ts`)
To jest ten moduł, który "używa AI" (Gemini). Odpowiada za inteligencję, słowa i plany.
*   **Funkcja:** Analizuje tekst, planuje odpowiedź, szuka faktów.
*   **Nowość (Persona-Less Cortex):** W wersji MVP ten moduł nie pamięta "kim jest" pomiędzy zapytaniami – on za każdym razem dostaje "pigułkę tożsamości" (instrukcję kim ma być) w momencie zapytania. To oszczędza koszty o 80%.
*   **Plik:** `core/systems/CortexSystem.ts`

## 3. Paliwo i Zmęczenie: Soma (`SomaSystem.ts`)
To jest "bateria" agenta. Każda myśl i każde słowo kosztuje energię.
*   **Energia (0-100):** Jeśli spadnie poniżej 20%, agent staje się "głupi" (krótkie odpowiedzi, brak kreatywności).
*   **Sny:** Aby odzyskać energię, agent musi "spać".
*   **Plik:** `core/systems/SomaSystem.ts`

## 4. Emocje i Chemia: Neurochemia (`NeurotransmitterSystem.ts`)
To jest **dusza** systemu – to, co sprawia, że agent jest "CREJZI" albo "Zdołowany".
*   **Dopamina:** Motywacja. Jak jest wysoka (>80), agent krzyczy, używa wykrzykników i chce działać.
*   **Serotonina:** Spokój. Jak jest niska, agent jest drażliwy.
*   **Dlaczego to jest ważne?** Te wskaźniki zmieniają się **same** w czasie, niezależnie od tego, co mówi użytkownik.
*   **Plik:** `core/systems/NeurotransmitterSystem.ts`

## 5. Pamięć i Sny (`EpisodicMemoryService.ts`)
System nie zapamiętuje "tekstu", ale "wrażenia".
*   **Sny (Konsolidacja):** Kiedy włączasz tryb snu, system przegląda wydarzenia dnia i zapisuje tylko te, które wywołały emocje (duża zmiana Dopaminy/Strachu). Resztę zapomina.
*   **Plik:** `services/EpisodicMemoryService.ts`

---

## 🕵️‍♂️ Analiza: Dlaczego testy MVP były "dziwne"?

Podczas testów zauważyliśmy zjawisko **"Rozdwojenia Natury"**:
> Użytkownik prosi: *"Uspokój się, pisz małymi literami."*
> Agent odpowiada: *"ROZUMIEM!! BĘDĘ SPOKOJNY!! TO FASCYNUJĄCE WYZWANIE!!"*

**Dlaczego tak się dzieje?**
To konflikt między **Logiką (Cortex)** a **Biologią (Neurochemia)**.

1.  **Cortex (Mózg):** Zrozumiał polecenie ("bądź cicho"). Wygenerował treść potwierdzającą.
2.  **Neurochemia (Ciało):** Wskaźnik Dopaminy wynosił **95/100** (Ekstaza).
3.  **Wynik:** Agent *chciał* być spokojny logicznie, ale jego "biologia" wymusiła krzyk (Caps Lock + wykrzykniki) narzucony przez system `ExpressionPolicy`.

**To nie jest błąd kodu.** To dowód na to, że system działa jak żywy organizm – "ciało" wygrało z "rozumem". Aby go naprawdę uspokoić, trzeba by obniżyć mu dopaminę (np. nudząc go), a nie tylko poprosić.

---

### Podsumowanie dla Zespołu
Mamy system, który **czuje** (symulacja chemii) i **myśli** (LLM), a te dwa systemy walczą ze sobą o kontrolę nad klawiaturą. To jest fundament pod prawdziwe AGI, a nie grzecznego asystenta.
