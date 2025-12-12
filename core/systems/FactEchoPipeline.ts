/**
 * FactEchoPipeline - Production pipeline with JSON-based guard
 * 
 * PRISM ARCHITECTURE (13/10) - Phase 6
 * 
 * Replaces regex-based PersonaGuard with FactEchoGuard.
 * Pure JSON comparison - no regex hell.
 * 
 * MODULAR: Single responsibility - wrap CortexOutput with fact validation.
 */

import { HardFacts, SomaState, NeurotransmitterState } from '../../types';
import { CortexOutput, FactEcho } from '../types/CortexOutput';
import { buildHardFacts } from './HardFactsBuilder';
import { fullGuardCheck, checkFactEcho, FACT_ECHO_CONFIG } from './FactEchoGuard';
import { evaluationBus } from './EvaluationBus';
import { canApplyPenalty, recordPenalty, logArchitectureIssue } from './PrismMetrics';

// ═══════════════════════════════════════════════════════════════════════════
// Configuration
// ═══════════════════════════════════════════════════════════════════════════

import { SYSTEM_CONFIG } from '../config/systemConfig';

// DEPRECATED: Use SYSTEM_CONFIG.factEcho instead
export const FACT_ECHO_PIPELINE_CONFIG = {
  get ENABLED() { return SYSTEM_CONFIG.factEcho.enabled; },
  set ENABLED(v: boolean) { (SYSTEM_CONFIG.factEcho as any).enabled = v; },
  
  get DEFAULT_STRICT_MODE() { return SYSTEM_CONFIG.factEcho.strictMode; },
  set DEFAULT_STRICT_MODE(v: boolean) { (SYSTEM_CONFIG.factEcho as any).strictMode = v; },
  
  get LOG_ENABLED() { return SYSTEM_CONFIG.factEcho.logEnabled; },
  set LOG_ENABLED(v: boolean) { (SYSTEM_CONFIG.factEcho as any).logEnabled = v; }
};

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

export interface FactEchoPipelineContext {
  soma?: SomaState;
  neuro?: NeurotransmitterState;
  agentName?: string;
  worldFacts?: Record<string, string | number>;
  
  /** If true, all hardFacts must be echoed. If false, only required facts. */
  factStrictMode?: boolean;
}

export interface FactEchoPipelineResult<T> {
  output: T;
  guardPassed: boolean;
  wasModified: boolean;
  mutatedFacts: string[];
  missingFacts: string[];
}

// ═══════════════════════════════════════════════════════════════════════════
// Main Pipeline Function
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Guard CortexOutput using FactEcho (JSON comparison)
 * 
 * This is the main entry point for the 13/10 fact validation.
 * NO REGEX - pure JSON comparison.
 */
export function guardCortexOutputWithFactEcho(
  output: CortexOutput,
  context: FactEchoPipelineContext
): FactEchoPipelineResult<CortexOutput> {
  // Skip if disabled
  if (!FACT_ECHO_PIPELINE_CONFIG.ENABLED) {
    return {
      output,
      guardPassed: true,
      wasModified: false,
      mutatedFacts: [],
      missingFacts: []
    };
  }
  
  // Build hard facts from current state
  const hardFacts = buildHardFacts({
    soma: context.soma,
    neuro: context.neuro,
    worldFacts: context.worldFacts,
    // CRITICAL FIX: agentName MUST be in HardFacts for identity preservation
    agentName: context.agentName
  });
  
  const factStrictMode = context.factStrictMode ?? FACT_ECHO_PIPELINE_CONFIG.DEFAULT_STRICT_MODE;
  
  // Run full guard check (fact echo + identity leak)
  const guardResult = fullGuardCheck(
    output.speech_content,
    output.fact_echo,
    hardFacts,
    factStrictMode
  );
  
  // Log result
  if (FACT_ECHO_PIPELINE_CONFIG.LOG_ENABLED) {
    logPipelineResult(guardResult.action, output.fact_echo, hardFacts);
  }
  
  // Check for architecture issues (repeated failures)
  checkForArchitectureIssues(guardResult.action, hardFacts);
  
  // Determine final output
  let finalOutput = output;
  let wasModified = false;
  
  if (guardResult.action === 'SOFT_FAIL' || guardResult.action === 'HARD_FAIL') {
    finalOutput = {
      ...output,
      speech_content: FACT_ECHO_CONFIG.SOFT_FAIL_RESPONSE
    };
    wasModified = true;
  }
  
  // Extract mutated/missing facts from issues
  const mutatedFacts = guardResult.issues
    .filter(i => i.type === 'fact_mutation')
    .map(i => i.field!)
    .filter(Boolean);
  
  const missingFacts = guardResult.issues
    .filter(i => i.type === 'fact_approximation')
    .map(i => i.field!)
    .filter(Boolean);
  
  return {
    output: finalOutput,
    guardPassed: guardResult.action === 'PASS',
    wasModified,
    mutatedFacts,
    missingFacts
  };
}

/**
 * Guard legacy response format (text field instead of speech_content)
 */
export function guardLegacyWithFactEcho<T extends { text: string }>(
  response: T,
  factEcho: FactEcho | undefined,
  context: FactEchoPipelineContext
): FactEchoPipelineResult<T> {
  // Skip if disabled
  if (!FACT_ECHO_PIPELINE_CONFIG.ENABLED) {
    return {
      output: response,
      guardPassed: true,
      wasModified: false,
      mutatedFacts: [],
      missingFacts: []
    };
  }
  
  const hardFacts = buildHardFacts({
    soma: context.soma,
    neuro: context.neuro,
    worldFacts: context.worldFacts,
    // CRITICAL FIX: agentName MUST be in HardFacts for identity preservation
    agentName: context.agentName
  });
  
  const factStrictMode = context.factStrictMode ?? FACT_ECHO_PIPELINE_CONFIG.DEFAULT_STRICT_MODE;
  
  const guardResult = fullGuardCheck(
    response.text,
    factEcho,
    hardFacts,
    factStrictMode
  );
  
  if (FACT_ECHO_PIPELINE_CONFIG.LOG_ENABLED) {
    logPipelineResult(guardResult.action, factEcho, hardFacts);
  }
  
  let finalResponse = response;
  let wasModified = false;
  
  if (guardResult.action === 'SOFT_FAIL' || guardResult.action === 'HARD_FAIL') {
    finalResponse = {
      ...response,
      text: FACT_ECHO_CONFIG.SOFT_FAIL_RESPONSE
    };
    wasModified = true;
  }
  
  const mutatedFacts = guardResult.issues
    .filter(i => i.type === 'fact_mutation')
    .map(i => i.field!)
    .filter(Boolean);
  
  const missingFacts = guardResult.issues
    .filter(i => i.type === 'fact_approximation')
    .map(i => i.field!)
    .filter(Boolean);
  
  return {
    output: finalResponse,
    guardPassed: guardResult.action === 'PASS',
    wasModified,
    mutatedFacts,
    missingFacts
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Logging
// ═══════════════════════════════════════════════════════════════════════════

function logPipelineResult(
  action: string,
  factEcho: FactEcho | undefined,
  hardFacts: HardFacts
): void {
  const echoKeys = factEcho ? Object.keys(factEcho).filter(k => factEcho[k] !== undefined) : [];
  const hardKeys = Object.keys(hardFacts).filter(k => hardFacts[k] !== undefined);
  
  if (action === 'PASS') {
    console.log(
      `[FactEchoPipeline] ✅ PASS - echoed: [${echoKeys.join(', ')}], expected: [${hardKeys.join(', ')}]`
    );
  } else {
    console.log(
      `[FactEchoPipeline] ⚠️ ${action} - echoed: [${echoKeys.join(', ')}], expected: [${hardKeys.join(', ')}]`
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Architecture Issue Detection
// ═══════════════════════════════════════════════════════════════════════════

let consecutiveFailures = 0;
const CONSECUTIVE_FAILURE_THRESHOLD = 5;

function checkForArchitectureIssues(action: string, hardFacts: HardFacts): void {
  if (action === 'PASS') {
    consecutiveFailures = 0;
    return;
  }
  
  consecutiveFailures++;
  
  if (consecutiveFailures >= CONSECUTIVE_FAILURE_THRESHOLD) {
    logArchitectureIssue({
      type: 'REPEATED_FAILURE',
      description: `${consecutiveFailures} consecutive guard failures - possible LLM prompt issue`,
      severity: 0.8,
      context: { hardFacts, consecutiveFailures }
    });
    consecutiveFailures = 0; // Reset after logging
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Feature Flags
// ═══════════════════════════════════════════════════════════════════════════

export function enableFactEchoPipeline(): void {
  FACT_ECHO_PIPELINE_CONFIG.ENABLED = true;
  console.log('[FactEchoPipeline] ✅ ENABLED');
}

export function disableFactEchoPipeline(): void {
  FACT_ECHO_PIPELINE_CONFIG.ENABLED = false;
  console.log('[FactEchoPipeline] ⏸️ DISABLED');
}

export function isFactEchoPipelineEnabled(): boolean {
  return FACT_ECHO_PIPELINE_CONFIG.ENABLED;
}

export function setDefaultStrictMode(strict: boolean): void {
  FACT_ECHO_PIPELINE_CONFIG.DEFAULT_STRICT_MODE = strict;
  console.log(`[FactEchoPipeline] Strict mode: ${strict ? 'ON' : 'OFF'}`);
}
