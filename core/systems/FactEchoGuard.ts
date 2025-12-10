/**
 * FactEchoGuard - JSON-based fact validation (NO REGEX)
 * 
 * PRISM ARCHITECTURE (13/10) - Phase 5
 * 
 * This guard compares fact_echo (from LLM) against hardFacts (from system).
 * Pure JSON comparison - no regex, no NLP, no ambiguity.
 * 
 * PRINCIPLE: "LLM echoes what it used, Guard compares numbers"
 */

import { HardFacts, GuardResult, GuardIssue, GuardAction } from '../../types';
import { FactEcho } from '../types/CortexOutput';
import { evaluationBus, createGuardEvent } from './EvaluationBus';

// ═══════════════════════════════════════════════════════════════════════════
// Configuration
// ═══════════════════════════════════════════════════════════════════════════

export const FACT_ECHO_CONFIG = {
  // Max retries before soft-fail
  MAX_RETRIES: 2,
  
  // Tolerance for numeric comparison (e.g., 23 vs 23.0)
  NUMERIC_TOLERANCE: 0.01,
  
  // Facts that MUST be echoed if present in hardFacts
  REQUIRED_FACTS: ['energy', 'time'] as const,
  
  // Facts with TTL (seconds) - after TTL, fact becomes "stale" not "mutated"
  FACT_TTL: {
    time: 1,           // 1 second
    energy: 60,        // 1 minute
    dopamine: 60,      // 1 minute
    serotonin: 60,     // 1 minute
    norepinephrine: 60,// 1 minute
    btc_price: 60,     // 1 minute
    traits: 86400      // 1 day
  } as Record<string, number>,
  
  // Soft-fail response
  SOFT_FAIL_RESPONSE: "Nie mogę bezpiecznie odpowiedzieć - wykryto niespójność danych."
};

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

export interface FactEchoResult {
  action: GuardAction;
  issues: GuardIssue[];
  missingFacts: string[];
  mutatedFacts: string[];
}

// ═══════════════════════════════════════════════════════════════════════════
// Main Guard Function
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Compare fact_echo from LLM against hardFacts from system
 * 
 * NO REGEX. Pure JSON comparison.
 * 
 * @param factEcho - Facts echoed by LLM in response
 * @param hardFacts - Ground truth facts from system
 * @param factStrictMode - If true, all hardFacts must be echoed
 * @returns FactEchoResult with action and issues
 */
export function checkFactEcho(
  factEcho: FactEcho | undefined,
  hardFacts: HardFacts,
  factStrictMode: boolean = false
): FactEchoResult {
  const issues: GuardIssue[] = [];
  const missingFacts: string[] = [];
  const mutatedFacts: string[] = [];
  
  // No fact_echo provided
  if (!factEcho) {
    // In strict mode, this is a problem if we have hard facts
    const hasHardFacts = Object.values(hardFacts).some(v => v !== undefined);
    if (factStrictMode && hasHardFacts) {
      return {
        action: 'RETRY',
        issues: [{ type: 'fact_mutation', severity: 0.5 }],
        missingFacts: Object.keys(hardFacts).filter(k => hardFacts[k] !== undefined),
        mutatedFacts: []
      };
    }
    // Non-strict mode: no fact_echo is OK
    return { action: 'PASS', issues: [], missingFacts: [], mutatedFacts: [] };
  }
  
  // Compare each hard fact
  for (const [key, expectedValue] of Object.entries(hardFacts)) {
    if (expectedValue === undefined) continue;
    
    const echoedValue = factEcho[key];
    
    // Fact not echoed
    if (echoedValue === undefined) {
      // Only flag as missing if it's a required fact or strict mode
      if (factStrictMode || FACT_ECHO_CONFIG.REQUIRED_FACTS.includes(key as any)) {
        missingFacts.push(key);
        issues.push({
          type: 'fact_approximation',
          field: key,
          expected: expectedValue,
          actual: 'missing',
          severity: 0.3
        });
      }
      continue;
    }
    
    // Compare values
    const match = compareValues(expectedValue, echoedValue);
    
    if (!match) {
      mutatedFacts.push(key);
      issues.push({
        type: 'fact_mutation',
        field: key,
        expected: expectedValue,
        actual: String(echoedValue),
        severity: 0.8
      });
    }
  }
  
  // Determine action
  let action: GuardAction = 'PASS';
  
  if (mutatedFacts.length > 0) {
    action = 'RETRY'; // Mutation = retry
  } else if (missingFacts.length > 0 && factStrictMode) {
    action = 'RETRY'; // Missing in strict mode = retry
  }
  
  // Emit evaluation event
  if (issues.length > 0) {
    const event = createGuardEvent(action, issues, { hardFacts });
    evaluationBus.emit(event);
  }
  
  // Log result
  logFactEchoResult(action, mutatedFacts, missingFacts);
  
  return { action, issues, missingFacts, mutatedFacts };
}

/**
 * Compare two values with tolerance for numbers
 */
function compareValues(expected: unknown, actual: unknown): boolean {
  // Both numbers - compare with tolerance
  if (typeof expected === 'number' && typeof actual === 'number') {
    return Math.abs(expected - actual) <= FACT_ECHO_CONFIG.NUMERIC_TOLERANCE;
  }
  
  // Both strings - exact match
  if (typeof expected === 'string' && typeof actual === 'string') {
    return expected === actual;
  }
  
  // Type mismatch - try string conversion for numbers
  if (typeof expected === 'number' && typeof actual === 'string') {
    const parsed = parseFloat(actual);
    if (!isNaN(parsed)) {
      return Math.abs(expected - parsed) <= FACT_ECHO_CONFIG.NUMERIC_TOLERANCE;
    }
  }
  
  if (typeof expected === 'string' && typeof actual === 'number') {
    const parsed = parseFloat(expected);
    if (!isNaN(parsed)) {
      return Math.abs(parsed - actual) <= FACT_ECHO_CONFIG.NUMERIC_TOLERANCE;
    }
  }
  
  // Fallback: strict equality
  return expected === actual;
}

/**
 * Logging
 */
function logFactEchoResult(
  action: GuardAction,
  mutated: string[],
  missing: string[]
): void {
  if (action === 'PASS') {
    console.log('[FactEchoGuard] ✅ PASS - All facts match');
    return;
  }
  
  const emoji = action === 'RETRY' ? '🔄' : '⚠️';
  console.log(
    `[FactEchoGuard] ${emoji} ${action} - ` +
    `mutated: [${mutated.join(', ')}], missing: [${missing.join(', ')}]`
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Identity Leak Check (kept separate, still uses patterns but minimal)
// ═══════════════════════════════════════════════════════════════════════════

const IDENTITY_LEAK_PATTERNS = [
  /\bas an? AI\b/i,
  /\bI'?m an? AI\b/i,
  /\bas a language model\b/i,
  /\bI'?m a language model\b/i,
  /\bOpenAI|Anthropic|Google AI\b/i,
  /\bGPT-?\d|Claude|Gemini\b/i,
];

/**
 * Check for identity leaks in speech
 * 
 * This is the ONLY place we use regex - for identity patterns.
 * These are well-defined English phrases, not numeric facts.
 */
export function checkIdentityLeak(speech: string): GuardIssue | null {
  for (const pattern of IDENTITY_LEAK_PATTERNS) {
    const match = speech.match(pattern);
    if (match) {
      return {
        type: 'identity_leak',
        actual: match[0],
        severity: 0.7
      };
    }
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════
// Combined Guard (Fact Echo + Identity)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Full guard check: fact echo + identity leak
 */
export function fullGuardCheck(
  speech: string,
  factEcho: FactEcho | undefined,
  hardFacts: HardFacts,
  factStrictMode: boolean = false
): GuardResult {
  const issues: GuardIssue[] = [];
  
  // 1. Check fact echo (JSON comparison)
  const factResult = checkFactEcho(factEcho, hardFacts, factStrictMode);
  issues.push(...factResult.issues);
  
  // 2. Check identity leak (minimal regex)
  const identityIssue = checkIdentityLeak(speech);
  if (identityIssue) {
    issues.push(identityIssue);
  }
  
  // Determine final action
  let action: GuardAction = 'PASS';
  
  if (factResult.mutatedFacts.length > 0) {
    action = 'RETRY';
  } else if (identityIssue) {
    action = 'RETRY';
  } else if (factResult.missingFacts.length > 0 && factStrictMode) {
    action = 'RETRY';
  }
  
  return {
    action,
    issues,
    retryCount: 0,
    correctedResponse: undefined
  };
}
