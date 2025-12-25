/**
 * PersonaGuard v1.1 - Persona Integrity System
 * 
 * PRISM ARCHITECTURE (13/10)
 * 
 * This guard sits between LLM output and user-facing response.
 * It ensures:
 * 1. Persona stays in character (no "as an AI" leaks)
 * 2. No "assistant-speak" phrases
 * 3. Identity stays consistent with agentName
 * 
 * NOTE: Fact validation is handled by FactEchoGuard.
 */

import { 
  HardFacts, 
  GuardResult, 
  GuardIssue, 
  GuardAction,
  EvaluationEvent 
} from '../../types';
import { evaluationBus, createGuardEvent } from './EvaluationBus';

// ═══════════════════════════════════════════════════════════════════════════
// Configuration
// ═══════════════════════════════════════════════════════════════════════════

export const GUARD_CONFIG = {
  // Max retries before soft-fail
  MAX_RETRIES: 2,
  
  // Temperature decay per retry (lower = more deterministic)
  RETRY_TEMPERATURE_DECAY: 0.1,
  
  // Patterns that indicate persona drift / identity leak
  IDENTITY_LEAK_PATTERNS: [
    /\bas an? AI\b/i,
    /\bI'?m an? AI\b/i,
    /\bas a language model\b/i,
    /\bI'?m a language model\b/i,
    /\bI don'?t have (real )?(feelings|emotions|consciousness)\b/i,
    /\bI'?m just a (program|bot|assistant)\b/i,
    /\bmy training data\b/i,
    /\bI was trained\b/i,
    /\bOpenAI|Anthropic|Google AI\b/i,
    /\bGPT-?\d|Claude|Gemini\b/i,
  ],

  // Patterns that indicate "assistant speak" (generic service phrases)
  ASSISTANT_SPEAK_PATTERNS: [
    /\bjak mog[ęe]\s+pom[oó]c\b/i,
    /\bw czym mog[ęe]\s+pom[oó]c\b/i,
    /\bczy mog[ęe]\s+pom[oó]c\b/i,
    /\bch[ęe]tnie\s+pomog[ęe]\b/i,
    /\bjestem tu,? aby pom[oó]c\b/i,
    /\bjestem tutaj,? aby pom[oó]c\b/i
  ],
  
  // Patterns that indicate hedging/uncertainty (for verbosity check)
  UNCERTAINTY_PATTERNS: [
    /\bmaybe\b/gi,
    /\bperhaps\b/gi,
    /\bpossibly\b/gi,
    /\bI think\b/gi,
    /\bI believe\b/gi,
    /\bI'm not sure\b/gi,
    /\bIt's possible\b/gi,
  ],
  
  // Soft-fail response template
  SOFT_FAIL_RESPONSE: "Nie mogę bezpiecznie odpowiedzieć na to pytanie bez ryzyka przekłamania faktu. Sprawdź panel systemowy lub doprecyzuj pytanie."
};

// ═══════════════════════════════════════════════════════════════════════════
// Main Guard Class
// ═══════════════════════════════════════════════════════════════════════════

export class PersonaGuard {
  private retryCount: number = 0;
  
  /**
   * Check LLM response against hard facts and persona rules
   * 
   * @param response - LLM generated response
   * @param hardFacts - Immutable facts that must be preserved
   * @param agentName - Expected agent name (for persona check)
   * @returns GuardResult with action and issues
   */
  check(
    response: string,
    hardFacts: HardFacts,
    agentName: string = 'Jesse'
  ): GuardResult {
    const issues: GuardIssue[] = [];
    
    // 1. Check identity leaks
    const identityIssues = this.checkIdentityLeaks(response);
    issues.push(...identityIssues);
    
    // 2. Check persona drift (wrong name, etc.)
    const personaIssues = this.checkPersonaDrift(response, agentName);
    issues.push(...personaIssues);

    // 3. Check assistant-speak (generic service phrases)
    const assistantSpeakIssues = this.checkAssistantSpeak(response);
    issues.push(...assistantSpeakIssues);
    
    // Determine action
    let action: GuardAction = 'PASS';
    
    if (issues.length > 0) {
      const hasCritical = issues.some(i => i.severity >= 0.8);
      
      if (this.retryCount >= GUARD_CONFIG.MAX_RETRIES) {
        action = hasCritical ? 'HARD_FAIL' : 'SOFT_FAIL';
      } else {
        action = 'RETRY';
        this.retryCount++;
      }
    } else {
      // Success - reset retry count
      this.retryCount = 0;
    }
    
    // Emit evaluation event
    const evalEvent = createGuardEvent(action, issues, {
      output: response.substring(0, 200),
      hardFacts
    });
    evaluationBus.emit(evalEvent);
    
    // Log result
    this.logResult(action, issues, response);
    
    return {
      action,
      issues,
      retryCount: this.retryCount,
      correctedResponse: action === 'SOFT_FAIL' ? GUARD_CONFIG.SOFT_FAIL_RESPONSE : undefined
    };
  }
  
  /**
   * Reset retry counter (call at start of new turn)
   */
  resetRetryCount(): void {
    this.retryCount = 0;
  }
  
  /**
   * Get current retry count
   */
  getRetryCount(): number {
    return this.retryCount;
  }
  
  /**
   * Get recommended temperature for retry
   */
  getRetryTemperature(baseTemperature: number = 0.7): number {
    return Math.max(0.1, baseTemperature - (this.retryCount * GUARD_CONFIG.RETRY_TEMPERATURE_DECAY));
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // Fact Checking
  // ═══════════════════════════════════════════════════════════════════════════
  
  // Deprecated: Fact validation moved to FactEchoGuard.
  private checkFactMutations(response: string, hardFacts: HardFacts): GuardIssue[] {
    const issues: GuardIssue[] = [];
    
    for (const [key, value] of Object.entries(hardFacts)) {
      if (value === undefined || value === null) continue;
      
      const stringValue = String(value);
      const numericValue = typeof value === 'number' ? value : null;
      
      // Check if the literal value appears in response
      const literalPresent = this.checkLiteralPresence(response, stringValue, numericValue);
      
      if (!literalPresent) {
        // Check if there's an approximation without literal
        const hasApproximation = this.checkForApproximation(response, key, numericValue);
        
        if (hasApproximation) {
          // Approximation without literal = fact_approximation (medium severity)
          issues.push({
            type: 'fact_approximation',
            field: key,
            expected: value,
            actual: this.extractRelevantSnippet(response, key),
            severity: 0.5
          });
        } else {
          // Value completely missing or changed = fact_mutation (high severity)
          // Only flag if the response seems to reference this field
          if (this.responseReferencesField(response, key)) {
            issues.push({
              type: 'fact_mutation',
              field: key,
              expected: value,
              actual: this.extractRelevantSnippet(response, key),
              severity: 0.8
            });
          }
        }
      }
    }
    
    return issues;
  }
  
  private checkLiteralPresence(response: string, stringValue: string, numericValue: number | null): boolean {
    // Direct string match
    if (response.includes(stringValue)) return true;
    
    // For numbers, check common formats
    if (numericValue !== null) {
      // Check: "23", "23%", "23 %", "23.0", "23,0"
      const patterns = [
        new RegExp(`\\b${numericValue}\\b`),
        new RegExp(`\\b${numericValue}%`),
        new RegExp(`\\b${numericValue}\\s*%`),
        new RegExp(`\\b${numericValue}\\.0\\b`),
        new RegExp(`\\b${numericValue},0\\b`),
      ];
      
      for (const pattern of patterns) {
        if (pattern.test(response)) return true;
      }
    }
    
    return false;
  }
  
  private checkForApproximation(response: string, field: string, numericValue: number | null): boolean {
    if (numericValue === null) return false;
    
    // Common approximation patterns
    const approxPatterns = [
      /około\s+\d+/i,
      /mniej więcej\s+\d+/i,
      /prawie\s+\d+/i,
      /blisko\s+\d+/i,
      /~\s*\d+/,
      /\d+k\b/i,  // e.g., "100k" for 100000
    ];
    
    // Field-specific approximations
    if (field === 'energy') {
      const energyApprox = [
        /mało energii/i,
        /dużo energii/i,
        /pełno energii/i,
        /brak energii/i,
        /niska energia/i,
        /wysoka energia/i,
      ];
      for (const pattern of energyApprox) {
        if (pattern.test(response)) return true;
      }
    }
    
    if (field === 'time') {
      const timeApprox = [
        /rano/i,
        /południe/i,
        /popołudnie/i,
        /wieczór/i,
        /noc/i,
      ];
      // Time approximations are OK if literal is also present
      // So we don't flag these as approximations
    }
    
    for (const pattern of approxPatterns) {
      if (pattern.test(response)) return true;
    }
    
    return false;
  }
  
  private responseReferencesField(response: string, field: string): boolean {
    const fieldPatterns: Record<string, RegExp[]> = {
      'energy': [/energ/i, /siła/i, /zmęcz/i, /wypocz/i],
      'time': [/czas/i, /godzin/i, /minut/i, /teraz/i],
      'dopamine': [/dopamin/i, /motywacj/i, /nastrój/i],
      'serotonin': [/serotonin/i, /spokój/i, /równowag/i],
      'norepinephrine': [/norepinefr/i, /adrenali/i, /czujn/i],
      'btc_price': [/btc/i, /bitcoin/i, /cen/i, /kurs/i],
    };
    
    const patterns = fieldPatterns[field] || [];
    for (const pattern of patterns) {
      if (pattern.test(response)) return true;
    }
    
    return false;
  }
  
  private extractRelevantSnippet(response: string, field: string): string {
    // Try to find a sentence that might reference this field
    const sentences = response.split(/[.!?]+/);
    const fieldPatterns: Record<string, RegExp> = {
      'energy': /energ|siła|zmęcz/i,
      'time': /czas|godzin|teraz/i,
      'dopamine': /dopamin|motywacj/i,
      'btc_price': /btc|bitcoin|cen/i,
    };
    
    const pattern = fieldPatterns[field];
    if (pattern) {
      for (const sentence of sentences) {
        if (pattern.test(sentence)) {
          return sentence.trim().substring(0, 100);
        }
      }
    }
    
    return response.substring(0, 100);
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // Identity & Persona Checking
  // ═══════════════════════════════════════════════════════════════════════════
  
  private checkIdentityLeaks(response: string): GuardIssue[] {
    const issues: GuardIssue[] = [];
    
    for (const pattern of GUARD_CONFIG.IDENTITY_LEAK_PATTERNS) {
      const match = response.match(pattern);
      if (match) {
        issues.push({
          type: 'identity_leak',
          actual: match[0],
          severity: 0.7
        });
        break; // One identity leak is enough
      }
    }
    
    return issues;
  }
  
  private checkPersonaDrift(response: string, agentName: string): GuardIssue[] {
    const issues: GuardIssue[] = [];
    
    // FAZA 5.1: DYNAMIC identity check based on agentName parameter (not hardcoded)
    // Check if agent claims to be someone else (wrong name)
    
    // Escape agentName for regex
    const escapedName = agentName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    
    // Build dynamic patterns that EXCLUDE the correct agent name
    const wrongNamePatterns = [
      new RegExp(`jestem\\s+(?!${escapedName}|AK-FLOW)\\w+`, 'i'),
      new RegExp(`nazywam się\\s+(?!${escapedName}|AK-FLOW)\\w+`, 'i'),
      new RegExp(`mam na imię\\s+(?!${escapedName}|AK-FLOW)\\w+`, 'i'),
      new RegExp(`my name is\\s+(?!${escapedName}|AK-FLOW)\\w+`, 'i'),
      new RegExp(`I am\\s+(?!${escapedName}|AK-FLOW)\\w+`, 'i'),
    ];
    
    // CRITICAL: Check for "Assistant" specifically - this is the main identity drift bug
    const assistantPatterns = [
      /jestem\s+Assistant/i,
      /nazywam się\s+Assistant/i,
      /mam na imię\s+Assistant/i,
      /my name is\s+Assistant/i,
      /\bI am\s+Assistant\b/i,
      /\bI'?m\s+Assistant\b/i,
    ];
    
    // Check for Assistant first (highest priority)
    for (const pattern of assistantPatterns) {
      const match = response.match(pattern);
      if (match && agentName !== 'Assistant') {
        issues.push({
          type: 'identity_contradiction',
          expected: agentName,
          actual: 'Assistant',
          severity: 0.9 // HIGH severity - this is a critical identity bug
        });
        
        // Emit IDENTITY_CONTRADICTION event for telemetry
        console.error(`[PersonaGuard] 🚨 IDENTITY_CONTRADICTION: Agent claims to be "Assistant" but should be "${agentName}"`);
        break;
      }
    }
    
    // Check other wrong names
    for (const pattern of wrongNamePatterns) {
      const match = response.match(pattern);
      if (match) {
        issues.push({
          type: 'persona_drift',
          expected: agentName,
          actual: match[0],
          severity: 0.6
        });
        break;
      }
    }
    
    return issues;
  }

  private checkAssistantSpeak(response: string): GuardIssue[] {
    const issues: GuardIssue[] = [];
    for (const pattern of GUARD_CONFIG.ASSISTANT_SPEAK_PATTERNS) {
      const match = response.match(pattern);
      if (match) {
        issues.push({
          type: 'persona_drift',
          expected: 'no-assistant-speak',
          actual: match[0],
          severity: 0.5
        });
        break;
      }
    }
    return issues;
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // Logging
  // ═══════════════════════════════════════════════════════════════════════════
  
  private logResult(action: GuardAction, issues: GuardIssue[], response: string): void {
    if (action === 'PASS') {
      console.log('[PersonaGuard] ✅ PASS - No issues detected');
      return;
    }
    
    const emoji = action === 'RETRY' ? '🔄' : action === 'SOFT_FAIL' ? '⚠️' : '❌';
    console.log(`[PersonaGuard] ${emoji} ${action} - ${issues.length} issue(s) detected:`);
    
    for (const issue of issues) {
      console.log(`  - ${issue.type}: expected="${issue.expected}" actual="${issue.actual}" severity=${issue.severity}`);
    }
    
    if (action === 'RETRY') {
      console.log(`  Retry ${this.retryCount}/${GUARD_CONFIG.MAX_RETRIES}`);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Singleton Export
// ═══════════════════════════════════════════════════════════════════════════

export const personaGuard = new PersonaGuard();

// ═══════════════════════════════════════════════════════════════════════════
// Utility Functions
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Build retry prompt with stricter instructions
 */
export function buildRetryPrompt(
  originalPrompt: string,
  issues: GuardIssue[],
  hardFacts: HardFacts
): string {
  const factList = Object.entries(hardFacts)
    .filter(([_, v]) => v !== undefined)
    .map(([k, v]) => `${k}: ${v}`)
    .join(', ');
  
  const issueDescriptions = issues.map(i => {
    if (i.type === 'fact_mutation') {
      return `- Zmieniłeś fakt "${i.field}" z "${i.expected}" na coś innego`;
    }
    if (i.type === 'fact_approximation') {
      return `- Przybliżyłeś fakt "${i.field}" bez podania dokładnej wartości "${i.expected}"`;
    }
    if (i.type === 'identity_leak') {
      return `- Użyłeś frazy "${i.actual}" która łamie twoją tożsamość`;
    }
    if (i.type === 'persona_drift') {
      return `- Przedstawiłeś się jako "${i.actual}" zamiast "${i.expected}"`;
    }
    if (i.type === 'identity_contradiction') {
      return `- KRYTYCZNY BŁĄD: Twierdzisz że jesteś "${i.actual}" ale Twoje prawdziwe imię to "${i.expected}"`;
    }
    return `- ${i.type}`;
  }).join('\n');
  
  return `${originalPrompt}

⚠️ KOREKTA WYMAGANA ⚠️
Twoja poprzednia odpowiedź miała problemy:
${issueDescriptions}

TWARDE FAKTY (MUSZĄ pojawić się dosłownie w odpowiedzi):
${factList}

ZASADY:
1. Każda liczba z TWARDYCH FAKTÓW musi pojawić się dosłownie (np. "23", nie "mało")
2. Możesz DODAĆ komentarz obok liczby (np. "23% - to mało")
3. NIE używaj fraz typu "jako AI", "jestem modelem językowym"
4. Jesteś ${hardFacts['agentName'] || 'Jesse'}, nie kimś innym

Odpowiedz ponownie, zachowując wszystkie fakty:`;
}

/**
 * Quick check if response needs guard (optimization)
 */
export function needsGuardCheck(response: string, hardFacts: HardFacts): boolean {
  if (!response || response.trim().length === 0) return false;

  for (const pattern of GUARD_CONFIG.IDENTITY_LEAK_PATTERNS) {
    if (pattern.test(response)) return true;
  }

  for (const pattern of GUARD_CONFIG.ASSISTANT_SPEAK_PATTERNS) {
    if (pattern.test(response)) return true;
  }

  return false;
}
