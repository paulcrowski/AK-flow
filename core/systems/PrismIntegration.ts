/**
 * PrismIntegration - Integrates PersonaGuard into LLM pipeline
 * 
 * PRISM ARCHITECTURE (13/10) - Phase 2
 * 
 * This module wraps LLM inference with:
 * 1. HardFacts building
 * 2. PersonaGuard checking
 * 3. Retry logic with temperature decay
 * 4. EvaluationBus emission
 * 
 * MODULAR: This is a thin integration layer, not a god file.
 * All heavy lifting is in PersonaGuard and HardFactsBuilder.
 */

import { HardFacts, GuardResult } from '../../types';
import { personaGuard, buildRetryPrompt, GUARD_CONFIG } from './PersonaGuard';
import { evaluationBus, createGuardEvent } from './EvaluationBus';

// ═══════════════════════════════════════════════════════════════════════════
// Configuration
// ═══════════════════════════════════════════════════════════════════════════

export const PRISM_CONFIG = {
  // Feature flag: Enable PersonaGuard checking
  GUARD_ENABLED: true,
  
  // Feature flag: Enable retry on guard failure
  RETRY_ENABLED: true,
  
  // Log all guard checks (for Phase 1 observation)
  LOG_ALL_CHECKS: true
};

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

export interface PrismCheckResult {
  /** Final response (original or corrected) */
  response: string;
  
  /** Guard result details */
  guardResult: GuardResult;
  
  /** Was the response modified? */
  wasModified: boolean;
  
  /** Number of retries used */
  retriesUsed: number;
}

export interface PrismInferenceOptions {
  /** Hard facts that must be preserved */
  hardFacts: HardFacts;
  
  /** Agent name for persona check */
  agentName?: string;
  
  /** Original prompt (for retry) */
  originalPrompt?: string;
  
  /** LLM inference function to call on retry */
  inferenceFunction?: () => Promise<string>;
}

// ═══════════════════════════════════════════════════════════════════════════
// Main Integration Function
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Check LLM response through PersonaGuard
 * 
 * This is the main integration point. Call this after LLM inference
 * to validate the response against hard facts and persona rules.
 * 
 * @param response - LLM generated response
 * @param options - Check options including hard facts
 * @returns PrismCheckResult with final response and guard details
 */
export function checkResponse(
  response: string,
  options: PrismInferenceOptions
): PrismCheckResult {
  const { hardFacts, agentName = 'Jesse' } = options;
  
  // Skip if guard disabled
  if (!PRISM_CONFIG.GUARD_ENABLED) {
    return {
      response,
      guardResult: { action: 'PASS', issues: [], retryCount: 0 },
      wasModified: false,
      retriesUsed: 0
    };
  }
  
  // Reset retry count for new check
  personaGuard.resetRetryCount();
  
  // Run guard check
  const guardResult = personaGuard.check(response, hardFacts, agentName);
  
  // Log for observation (Phase 1)
  if (PRISM_CONFIG.LOG_ALL_CHECKS) {
    logGuardCheck(response, hardFacts, guardResult);
  }
  
  // Determine final response
  let finalResponse = response;
  let wasModified = false;
  
  if (guardResult.action === 'SOFT_FAIL' || guardResult.action === 'HARD_FAIL') {
    finalResponse = guardResult.correctedResponse || GUARD_CONFIG.SOFT_FAIL_RESPONSE;
    wasModified = true;
  }
  
  return {
    response: finalResponse,
    guardResult,
    wasModified,
    retriesUsed: guardResult.retryCount
  };
}

/**
 * Check response with automatic retry on failure
 * 
 * This version will call the inference function again if guard fails,
 * with decreasing temperature for more deterministic output.
 * 
 * @param initialResponse - First LLM response
 * @param options - Options including inference function for retry
 * @returns PrismCheckResult with final response
 */
export async function checkResponseWithRetry(
  initialResponse: string,
  options: PrismInferenceOptions & {
    inferenceFunction: (temperature: number, retryPrompt?: string) => Promise<string>;
  }
): Promise<PrismCheckResult> {
  const { hardFacts, agentName = 'Jesse', inferenceFunction, originalPrompt } = options;
  
  // Skip if guard or retry disabled
  if (!PRISM_CONFIG.GUARD_ENABLED || !PRISM_CONFIG.RETRY_ENABLED) {
    return checkResponse(initialResponse, options);
  }
  
  // Reset for new check
  personaGuard.resetRetryCount();
  
  let currentResponse = initialResponse;
  let totalRetries = 0;
  
  while (totalRetries <= GUARD_CONFIG.MAX_RETRIES) {
    const guardResult = personaGuard.check(currentResponse, hardFacts, agentName);
    
    if (guardResult.action === 'PASS') {
      // Success!
      return {
        response: currentResponse,
        guardResult,
        wasModified: totalRetries > 0,
        retriesUsed: totalRetries
      };
    }
    
    if (guardResult.action === 'SOFT_FAIL' || guardResult.action === 'HARD_FAIL') {
      // Max retries reached
      return {
        response: guardResult.correctedResponse || GUARD_CONFIG.SOFT_FAIL_RESPONSE,
        guardResult,
        wasModified: true,
        retriesUsed: totalRetries
      };
    }
    
    // RETRY action - call inference again with lower temperature
    totalRetries++;
    const retryTemp = personaGuard.getRetryTemperature(0.7);
    
    // Build retry prompt with issues
    const retryPrompt = originalPrompt 
      ? buildRetryPrompt(originalPrompt, guardResult.issues, hardFacts)
      : undefined;
    
    console.log(`[PrismIntegration] Retry ${totalRetries}/${GUARD_CONFIG.MAX_RETRIES} with temp=${retryTemp.toFixed(2)}`);
    
    try {
      currentResponse = await inferenceFunction(retryTemp, retryPrompt);
    } catch (error) {
      console.error('[PrismIntegration] Retry inference failed:', error);
      // Return soft fail on inference error
      return {
        response: GUARD_CONFIG.SOFT_FAIL_RESPONSE,
        guardResult: {
          action: 'SOFT_FAIL',
          issues: guardResult.issues,
          retryCount: totalRetries
        },
        wasModified: true,
        retriesUsed: totalRetries
      };
    }
  }
  
  // Should not reach here, but safety fallback
  return {
    response: GUARD_CONFIG.SOFT_FAIL_RESPONSE,
    guardResult: { action: 'SOFT_FAIL', issues: [], retryCount: totalRetries },
    wasModified: true,
    retriesUsed: totalRetries
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Logging & Metrics
// ═══════════════════════════════════════════════════════════════════════════

function logGuardCheck(
  response: string,
  hardFacts: HardFacts,
  result: GuardResult
): void {
  const factCount = Object.keys(hardFacts).filter(k => hardFacts[k] !== undefined).length;
  const issueCount = result.issues.length;
  
  if (result.action === 'PASS') {
    console.log(
      `[PrismIntegration] ✅ PASS - ${factCount} facts preserved, 0 issues`
    );
  } else {
    console.log(
      `[PrismIntegration] ${result.action === 'RETRY' ? '🔄' : '⚠️'} ${result.action} - ` +
      `${issueCount} issue(s): ${result.issues.map(i => i.type).join(', ')}`
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Utility: Quick Check (for optimization)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Quick check if response likely needs full guard check
 * 
 * Use this to skip expensive guard checks when obviously OK.
 */
export function needsGuardCheck(response: string, hardFacts: HardFacts): boolean {
  // No hard facts = no check needed
  const hasHardFacts = Object.values(hardFacts).some(v => v !== undefined);
  if (!hasHardFacts) return false;
  
  // Quick identity leak check
  const identityPatterns = [
    /\bas an? AI\b/i,
    /\bI'?m a language model\b/i,
    /\bGPT|Claude|Gemini\b/i
  ];
  
  for (const pattern of identityPatterns) {
    if (pattern.test(response)) return true;
  }
  
  // Check if any hard fact value is missing
  for (const [_, value] of Object.entries(hardFacts)) {
    if (value === undefined) continue;
    if (!response.includes(String(value))) return true;
  }
  
  return false;
}

// ═══════════════════════════════════════════════════════════════════════════
// Export Guard Stats for Dashboard
// ═══════════════════════════════════════════════════════════════════════════

export function getGuardStats() {
  return evaluationBus.getGuardStats();
}

export function getGuardMetrics() {
  return evaluationBus.getMetrics();
}
