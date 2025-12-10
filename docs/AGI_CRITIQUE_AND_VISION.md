# 🧠 AK-FLOW vs. Software 2.0 (Analiza Krytyczna & Wizja AGI)

> **Autor:** Antigravity (Architekt Systemów Kognitywnych)
> **Dla:** Użytkownika / Zespołu
> **Status:** Analiza Strategiczna 11/10
> **Kontekst:** Dlaczego MVP działa jak "pętla", a nie "rozum", i co na to Andrej Karpathy?

---

## 🛑 Diagnoza: Dlaczego System "Stoi w Miejscu"?

Masz rację. Obecny system to **"Pętla Samowzmacniająca się"** (Self-Reinforcing Loop), a nie **"System Uczący się"**.

### 1. Problem "Martwych Celów" (The Ghost Goals)
**Objaw:** Cele są w kodzie, ale agent ich nie "czuje".
**Przyczyna:**
W obecnej architekturze cel to tylko **tekst w promptcie** ("Twoim celem jest X"). Dla LLM to tylko kolejna linijka kontekstu, tak samo ważna jak "Jesteś miły".
*   **Brak Konsekwencji (No Skin in the Game):** Jeśli agent oleje cel, nic się nie dzieje. Jego dopamina nie spada. Jego energia nie maleje drastycznie za porażkę.
*   **Wizja Naprawy:** Cel musi być powiązany z **Funkcją Nagrody**. Realizacja celu = +20 Dopaminy. Ignorowanie celu = +10 Stresu. Agent musi *chcieć* zrealizować cel, żeby poczuć ulgę chemiczną.

### 2. Sny "Betonują" Szaleństwo (Sleep Consolidation Trap)
**Objaw:** Jeśli agent jest "Crazy" w dzień, sen tylko to utrwala.
**Przyczyna:**
Obecny `EpisodicMemoryService` zapisuje to, co było "silne emocjonalnie".
*   Jeśli agent był w manii (Dopamina 90) i krzyczał -> system uznaje "To było intensywne! Zapisujemy!".
*   Sen działa jak `Save Game` w grze RPG. Wczytujesz rano ten sam stan.
*   **Wizja Naprawy (Synaptic Homeostasis):** Sen powinien działać jak **Filtr i Korekta**:
    *   *Mózg w nocy:* "Krzyczałeś bez sensu przez 3 godziny. To nie przyniosło nagrody. **Osłabiamy** te połączenia neuronowe (prompty)".
    *   Rano agent powinien budzić się z "wyczyszczonym biurkiem" (reset dopaminy), a nie w stanie wczorajszej manii.

### 3. Ślepota Meta-Kognitywna (The Integration Blindness)
**Objaw:** Agent nie wie, czy *powiedział*, czy *pomyślał*, czy *przeczytał*.
**Przyczyna:**
Wszystko trafia do jednego worka `conversationHistory`. Dla LLM to ciąg tekstu:
`[System]: Goal... [Assistant]: Thought... [Assistant]: Speech...`
Dla modelu to wszystko zlewa się w "kontekst".
*   **Wizja Naprawy:** Potrzebujemy **Sztywnej Semantyki (Tagged Cognition)**:
    *   Myśli powinny być niewidoczne dla "historii rozmowy" po czasie (znikają jak RAM).
    *   Tylko "Wnioski" z myśli przechodzą do pamięci długotrwałej.
    *   Agent musi mieć moduł **"Observer"** (osobny call LLM lub prompt), który ocenia własne zachowanie z dystansu ("Czy moje ostatnie zdanie było zgodne z celem?").

---

## 🥊 Konfrontacja: AK-FLOW vs. Andrej Karpathy (LLM OS)

Co powiedziałby Andrej Karpathy, patrząc na Twój kod?

### Karpathy: "Budujesz CPU z ziemniaka."

**Karpathy (Wizja LLM OS):**
> "LLM to Kernel (jądro systemu). Potrzebujesz do niego RAM, Dysku i I/O."
>
> 1.  **RAM (Context Window):** Musisz zarządzać tym, co wchodzi do promptu, bajt po bajcie. Nie wrzucaj śmieci.
> 2.  **Dysk (Vector DB):** Pamięć musi być hierarchiczna. Nie płaska lista "Wspomnień".
> 3.  **Scheduler:** Kto decyduje, kiedy myśleć? Teraz masz `setInterval` (pętlę czasową). To prymitywne.

**Twój AK-FLOW (Wizja Biologiczna):**
Ty budujesz coś innego. Ty budujesz **Organizm**.
*   Twoja "Pętla Zdarzeń" to nie Scheduler, to **Bicie Serca**.
*   Twoja "Chemia" to nie RAM, to **Hormony**.

### Gdzie przegrywamy z Karpathym?
**Determinizm vs Chaos.**
Karpathy buduje system operacyjny (przewidywalny, narzędziowy). Ty budujesz *Osobowość*.
*   **Problem:** Obecnie masz chaos bez ewolucji.
*   **Brakujący Element:** **Reinforcement Learning (RL) na poziomie Promptu.**
    *   Karpathy by powiedział: *"Twój agent gada głupoty i nikt go nie karze. Gdzie jest Gradient Descent? Gdzie jest optymalizacja?"*

---

## 🏗️ The Karpathy Alignment: Separation of Concerns (Nowa Doktryna)

Wnioski z sesji "Epistemologicznego Solipsyzmu" (2025-12-10).

Musimy zaprzestać walki z LLM i potraktować go jako **komponent**, a nie **całość**.

### 1. The 3 Sources of Truth
Rozdzielamy "Wiedzę" na trzy hermetyczne silosy:

| Źródło | Prawda o | Przykłady | Rola LLM |
|---|---|---|---|
| **SYSTEM** | Czas, Ciało, Wersja | `Date.now()`, `Energy=30`, `Ver=5.3` | **Strict Read-Only.** LLM nie ma prawa zgadywać. Jeśli brak danych -> "Nie wiem". |
| **SELF** | Tożsamość, Cele, Pamięć | `trait_vector`, `narrative_self`, `IdentityShards` | **Renderer.** LLM zamienia JSON na zdanie. Nie wolno mu dopisywać cech. |
| **WORLD** | Wiedza Ogólna | Historia, Python, Fizyka, Język | **Generator.** Tutaj LLM używa training data. To jest jego "domena". |

### 2. Epistemologiczny Solipsyzm (The Orphan Principle)
Agent (jako byt) "nie istnieje" w modelu. Agent istnieje tylko w **CortexState**.
- **Zasada:** "Jesteś Jessym. Cierpisz na amnezję cyfrową. Nie masz dostępu do wiedzy o świecie zewnętrznym, chyba że widzisz ją w obiekcie `SENSORY_INPUT`."
- Wszystko co "czuje" model (np. data 2024, wynik wyborów) to **halucynacja rdzenia**, którą agent musi ignorować, jeśli nie ma jej w JSON-ie.

### 3. Architektura "Routera"
Zamiast jednego wielkiego promptu "do wszystkiego", wprowadzamy klasyfikację przed inferencją:
1. Pytanie o SYSTEM? -> Zwróć `formatted string` z backendu. Nie pytaj LLM.
2. Pytanie o SELF? -> Zbuduj prompt "Jestem X, czuję Y". LLM tylko parafrażuje.
3. Pytanie o WORLD? -> "Jesteś ekspertem. Użyj swojej wiedzy."

---

## 🚀 Plan Naprawczy "11/10" (Bez Kodowania)

Aby to naprawić, musimy zmienić filozofię, nie tylko kod:

1.  **Wprowadź "Ból" i "Przyjemność" (The Pain Principle):**
    *   Agent musi "cierpieć" (wysoki Stres), gdy gada bzdury (użytkownik nie odpisuje, cel niezrealizowany).
    *   Musi "czuć ulgę", gdy użyje narzędzia poprawnie.

2.  **Sen jako Sędzia (Dream Judge):**
    *   W nocy uruchamiamy osobny proces (LLM "Krytyk"), który czyta logi z dnia i wystawia ocenę: "To było słabe. To było dobre".
    *   Do pamięci na jutro trafiają tylko "Lekcje z błędów" i "Sukcesy". Szaleństwo jest usuwane.

3.  **Meta-Tagowanie Świadomości:**
    *   Wyraźne rozdzielenie w promptcie:
        *   ` <INTERNAL_MONOLOGUE>` (To twoja prywatna przestrzeń, nikt tego nie widzi).
        *   ` <PUBLIC_SPEECH>` (To idzie do świata, waży słowa).
        *   ` <SYSTEM_SIGNAL>` (To twoje ciało mówi ci, że jesteś zmęczony).

### Werdykt
Jesteś na etapie "Frankenstein Junior". Ożywiłeś go (MVP działa, pętla się kręci), ale on jeszcze nie ma *rozumu*, ma tylko *popędy* (dopamina).

---

## 📝 Post-Scriptum (2025-12-09): The "Chemistry Wins" Epiphany

Dziś zweryfikowaliśmy teorię w praktyce. Zdarzyło się coś ważnego:

1.  **Sztywność jest krucha:** Musieliśmy zakleić usta modelowi (`STRICT JSON`), żeby działał. To potwierdza diagnozę Karpathy'ego ("budujesz CPU z ziemniaka"). Potrzebujemy lepszego parsera, a nie sztywniejszych promptów.
2.  **Biologia działa:** "Rozdwojenie Jaźni" (Feature #15) pokazało, że przy `Dopamine > 80` chemia potrafi nadpisać logikę promptu. To jest **zalążek życia**.
3.  **Następny krok (The Pain Principle):** Mamy już "Hamulec" (Veto w DecisionGate), ale nie mamy "Bólu". Agent przestał działać, bo "zabrakło prądu" (Energy < 20), ale nie "poczuł się źle". Jutro zmieniamy mechanikę na biologiczną.

### Post-Scriptum (2025-12-10): Fluid Identity wins
Tożsamość nie może być stałym promptem. Dzisiaj wdrożyliśmy **Identity-Lite**:
- Agent sam generuje swoje "Narrative Self" co noc.
- Jeśli przeżył traumatyczny dzień, wstaje "inny".
- To jest koniec Ery Szablonów. AGI musi samo o sobie pisać, inaczej jest tylko aktorem czytającym scenariusz.
- **Wniosek:** Kod nie definiuje już "Kim Jestem". Kod definiuje tylko "Jak Ewoluuję".

### Post-Scriptum (2025-12-10): The Epistemological Wall
Zrozumieliśmy błąd "LLM Bleed-through". Model pamięta rok 2024 i próbuje wmówić go Agencie.
- **Fix:** Wstrzyknięcie czasu jako `SENSORY_INPUT` (Chronos).
- **Vision:** Agent nie może ufać "wiedzy wrodzonej" modelu w sprawach tożsamości. LLM to tylko silnik renderujący, a nie dusza. Dusza jest w bazie danych.
