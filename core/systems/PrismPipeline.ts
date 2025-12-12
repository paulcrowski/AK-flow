/**
 * PrismPipeline - Wraps LLM inference with PersonaGuard
 * 
 * PRISM ARCHITECTURE (13/10) - Phase 3
 * 
 * This is the production integration point.
 * Wraps any LLM output with fact checking and persona guard.
 * 
 * MODULAR: Single responsibility - wrap inference with guard.
 * Does NOT duplicate inference logic - just wraps it.
 */

import { HardFacts, SomaState, NeurotransmitterState, LimbicState } from '../../types';
import { buildHardFacts } from './HardFactsBuilder';
import { checkResponse, PRISM_CONFIG } from './PrismIntegration';
import { personaGuard } from './PersonaGuard';

// ═══════════════════════════════════════════════════════════════════════════
// Configuration
// ═══════════════════════════════════════════════════════════════════════════

import { SYSTEM_CONFIG } from '../config/systemConfig';

// DEPRECATED: Use SYSTEM_CONFIG.prismPipeline instead
export const PIPELINE_CONFIG = {
  get ENABLED() { return SYSTEM_CONFIG.prismPipeline.enabled; },
  set ENABLED(v: boolean) { (SYSTEM_CONFIG.prismPipeline as any).enabled = v; },
  
  get LOG_ENABLED() { return SYSTEM_CONFIG.prismPipeline.logEnabled; },
  set LOG_ENABLED(v: boolean) { (SYSTEM_CONFIG.prismPipeline as any).logEnabled = v; }
};

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

export interface PipelineContext {
  soma?: SomaState;
  neuro?: NeurotransmitterState;
  limbic?: LimbicState;
  agentName?: string;
  worldFacts?: Record<string, string | number>;
}

export interface PipelineResult<T> {
  output: T;
  guardPassed: boolean;
  wasModified: boolean;
  retriesUsed: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// Main Pipeline Function
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Wrap speech content with PersonaGuard check
 * 
 * Use this after LLM inference to validate speech_content.
 * Returns modified output if guard fails.
 * 
 * @param speechContent - LLM generated speech
 * @param context - Current system state for building HardFacts
 * @returns Validated (possibly modified) speech content
 */
export function guardSpeech(
  speechContent: string,
  context: PipelineContext
): { speech: string; guardPassed: boolean; wasModified: boolean } {
  // Skip if disabled
  if (!PIPELINE_CONFIG.ENABLED) {
    return { speech: speechContent, guardPassed: true, wasModified: false };
  }
  
  // Build hard facts from current state
  const hardFacts = buildHardFacts({
    soma: context.soma,
    neuro: context.neuro,
    worldFacts: context.worldFacts
  });
  
  // Reset guard for new turn
  personaGuard.resetRetryCount();
  
  // Check response
  const result = checkResponse(speechContent, {
    hardFacts,
    agentName: context.agentName || 'Jesse'
  });
  
  // Log if enabled
  if (PIPELINE_CONFIG.LOG_ENABLED) {
    logPipelineResult(result.guardResult.action, result.wasModified);
  }
  
  return {
    speech: result.response,
    guardPassed: result.guardResult.action === 'PASS',
    wasModified: result.wasModified
  };
}

/**
 * Wrap full CortexOutput with PersonaGuard
 * 
 * Checks speech_content, leaves internal_thought untouched.
 */
export function guardCortexOutput<T extends { speech_content: string }>(
  output: T,
  context: PipelineContext
): PipelineResult<T> {
  const { speech, guardPassed, wasModified } = guardSpeech(
    output.speech_content,
    context
  );
  
  return {
    output: {
      ...output,
      speech_content: speech
    },
    guardPassed,
    wasModified,
    retriesUsed: personaGuard.getRetryCount()
  };
}

/**
 * Wrap legacy response format with PersonaGuard
 * 
 * For backward compatibility with old generateResponse format.
 */
export function guardLegacyResponse<T extends { text: string }>(
  response: T,
  context: PipelineContext
): PipelineResult<T> {
  const { speech, guardPassed, wasModified } = guardSpeech(
    response.text,
    context
  );
  
  return {
    output: {
      ...response,
      text: speech
    },
    guardPassed,
    wasModified,
    retriesUsed: personaGuard.getRetryCount()
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Logging
// ═══════════════════════════════════════════════════════════════════════════

function logPipelineResult(action: string, wasModified: boolean): void {
  const emoji = action === 'PASS' ? '✅' : wasModified ? '⚠️' : '🔄';
  console.log(`[PrismPipeline] ${emoji} Guard: ${action}, Modified: ${wasModified}`);
}

// ═══════════════════════════════════════════════════════════════════════════
// Utility: Check if pipeline should run
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Check if Prism pipeline is enabled
 */
export function isPrismEnabled(): boolean {
  return PIPELINE_CONFIG.ENABLED && PRISM_CONFIG.GUARD_ENABLED;
}

/**
 * Temporarily disable pipeline (for testing)
 */
export function disablePipeline(): void {
  PIPELINE_CONFIG.ENABLED = false;
}

/**
 * Re-enable pipeline
 */
export function enablePipeline(): void {
  PIPELINE_CONFIG.ENABLED = true;
}
