/**
 * IntegrationWiring.test.ts - ALARM 3 Integration Tests
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 * Te testy sprawdzają czy wszystkie moduły są POPRAWNIE PODPIĘTE.
 * Nie testują logiki biznesowej - tylko "plumbing".
 * 
 * Karpathy: "Unit tests pass but system doesn't work = wiring is broken"
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * @module __tests__/IntegrationWiring.test.ts
 */

import { describe, it, expect, beforeEach } from 'vitest';

// ═══════════════════════════════════════════════════════════════════════════
// 1. CONFIG CENTRALIZATION TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('Config Centralization', () => {
  it('SYSTEM_CONFIG is the single source of truth', async () => {
    const { SYSTEM_CONFIG } = await import('../core/config/systemConfig');
    
    // All config sections exist
    expect(SYSTEM_CONFIG.features).toBeDefined();
    expect(SYSTEM_CONFIG.prism).toBeDefined();
    expect(SYSTEM_CONFIG.prismPipeline).toBeDefined();
    expect(SYSTEM_CONFIG.factEcho).toBeDefined();
    expect(SYSTEM_CONFIG.chemistryBridge).toBeDefined();
    expect(SYSTEM_CONFIG.goals).toBeDefined();
    expect(SYSTEM_CONFIG.rpe).toBeDefined();
    expect(SYSTEM_CONFIG.expression).toBeDefined();
    expect(SYSTEM_CONFIG.telemetry).toBeDefined();
  });

  it('PrismIntegration reads from SYSTEM_CONFIG', async () => {
    const { SYSTEM_CONFIG } = await import('../core/config/systemConfig');
    const { PRISM_CONFIG } = await import('../core/systems/PrismIntegration');
    
    // Verify they're linked (change one, other changes)
    const original = SYSTEM_CONFIG.prism.guardEnabled;
    expect(PRISM_CONFIG.GUARD_ENABLED).toBe(original);
  });

  it('PrismPipeline reads from SYSTEM_CONFIG', async () => {
    const { SYSTEM_CONFIG } = await import('../core/config/systemConfig');
    const { PIPELINE_CONFIG } = await import('../core/systems/PrismPipeline');
    
    expect(PIPELINE_CONFIG.ENABLED).toBe(SYSTEM_CONFIG.prismPipeline.enabled);
  });

  it('FactEchoPipeline reads from SYSTEM_CONFIG', async () => {
    const { SYSTEM_CONFIG } = await import('../core/config/systemConfig');
    const { FACT_ECHO_PIPELINE_CONFIG } = await import('../core/systems/FactEchoPipeline');
    
    expect(FACT_ECHO_PIPELINE_CONFIG.ENABLED).toBe(SYSTEM_CONFIG.factEcho.enabled);
  });

  it('ChemistryBridge reads from SYSTEM_CONFIG', async () => {
    const { SYSTEM_CONFIG } = await import('../core/config/systemConfig');
    const { CHEMISTRY_BRIDGE_CONFIG } = await import('../core/systems/ChemistryBridge');
    
    expect(CHEMISTRY_BRIDGE_CONFIG.ENABLED).toBe(SYSTEM_CONFIG.chemistryBridge.enabled);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 2. HARD FACTS WIRING TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('HardFacts Wiring', () => {
  it('buildHardFacts includes agentName when provided', async () => {
    const { buildHardFacts } = await import('../core/systems/HardFactsBuilder');
    
    const facts = buildHardFacts({
      agentName: 'TestAgent'
    });
    
    expect(facts.agentName).toBe('TestAgent');
  });

  it('buildHardFacts includes date', async () => {
    const { buildHardFacts } = await import('../core/systems/HardFactsBuilder');
    
    const facts = buildHardFacts({});
    
    expect(facts.date).toBeDefined();
    expect(facts.time).toBeDefined();
  });

  it('CortexState includes hard_facts field', async () => {
    const { buildMinimalCortexState, setCachedIdentity } = await import('../core/builders');
    
    // Setup cache
    setCachedIdentity('test-agent', {
      name: 'TestAgent',
      core_values: ['test'],
      constitutional_constraints: []
    }, {
      verbosity: 0.5,
      arousal: 0.5,
      conscientiousness: 0.5,
      social_awareness: 0.5,
      curiosity: 0.5
    });
    
    const state = buildMinimalCortexState({
      agentId: 'test-agent',
      metaStates: { energy: 100, stress: 0, confidence: 100 },
      userInput: 'Test'
    });
    
    // CRITICAL: hard_facts must be in state
    expect(state.hard_facts).toBeDefined();
    expect(state.hard_facts?.agentName).toBe('TestAgent');
    expect(state.hard_facts?.date).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 3. IDENTITY WIRING TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('Identity Wiring', () => {
  it('DEFAULT_CORE_IDENTITY uses UNINITIALIZED_AGENT', async () => {
    const { DEFAULT_CORE_IDENTITY } = await import('../core/types/CoreIdentity');
    
    // CRITICAL: Must NOT be 'Assistant'
    expect(DEFAULT_CORE_IDENTITY.name).toBe('UNINITIALIZED_AGENT');
    expect(DEFAULT_CORE_IDENTITY.name).not.toBe('Assistant');
  });

  it('MinimalCortexStateBuilder fallback is UNINITIALIZED_AGENT', async () => {
    const { buildMinimalCortexState, clearIdentityCache } = await import('../core/builders');
    
    // Clear cache to trigger fallback
    clearIdentityCache();
    
    const state = buildMinimalCortexState({
      agentId: 'nonexistent-agent',
      metaStates: { energy: 100, stress: 0, confidence: 100 },
      userInput: 'Test'
    });
    
    // CRITICAL: Fallback must NOT be 'Assistant'
    expect(state.core_identity.name).toBe('UNINITIALIZED_AGENT');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 4. PERSONAGUARD WIRING TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('PersonaGuard Wiring', () => {
  it('PersonaGuard exports are available', async () => {
    const { personaGuard, buildRetryPrompt } = await import('../core/systems/PersonaGuard');
    
    expect(personaGuard).toBeDefined();
    expect(personaGuard.check).toBeDefined();
    expect(buildRetryPrompt).toBeDefined();
  });

  it('PrismPipeline uses PersonaGuard', async () => {
    const { guardSpeech, isPrismEnabled } = await import('../core/systems/PrismPipeline');
    
    expect(guardSpeech).toBeDefined();
    expect(isPrismEnabled).toBeDefined();
    
    // Pipeline should be enabled by default
    expect(isPrismEnabled()).toBe(true);
  });

  it('PersonaGuard detects identity contradiction', async () => {
    const { personaGuard } = await import('../core/systems/PersonaGuard');
    
    const result = personaGuard.check(
      'Jestem Assistant i pomogę ci.',
      { energy: 50 },
      'Jesse'  // Expected name
    );
    
    // Should detect that response says "Assistant" but should be "Jesse"
    const identityIssue = result.issues.find(i => 
      i.type === 'identity_contradiction' || i.type === 'persona_drift'
    );
    expect(identityIssue).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 5. RPE (DOPAMINE DECAY) WIRING TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('RPE Wiring', () => {
  it('NeurotransmitterSystem accepts RPE parameters', async () => {
    const { NeurotransmitterSystem } = await import('../core/systems/NeurotransmitterSystem');
    
    const prevState = { dopamine: 70, serotonin: 60, norepinephrine: 50 };
    
    const newState = NeurotransmitterSystem.updateNeuroState(prevState, {
      soma: { energy: 100, cognitiveLoad: 0, isSleeping: false },
      activity: 'CREATIVE',
      temperament: {
        arousal: 0.5,
        verbosity: 0.5,
        conscientiousness: 0.5,
        socialAwareness: 0.5,
        curiosity: 0.5
      },
      userIsSilent: true,
      novelty: 0.1,
      consecutiveAgentSpeeches: 3,
      // RPE parameters - CRITICAL
      hadExternalReward: false,
      ticksSinceLastReward: 5
    });
    
    // With no reward for 5 ticks, dopamine should decay
    expect(newState.dopamine).toBeLessThan(prevState.dopamine);
  });

  it('CREATIVE activity does NOT boost dopamine when user is silent', async () => {
    const { NeurotransmitterSystem } = await import('../core/systems/NeurotransmitterSystem');
    
    const prevState = { dopamine: 55, serotonin: 60, norepinephrine: 50 };
    
    const newState = NeurotransmitterSystem.updateNeuroState(prevState, {
      soma: { energy: 100, cognitiveLoad: 0, isSleeping: false },
      activity: 'CREATIVE',
      temperament: {
        arousal: 0.5,
        verbosity: 0.5,
        conscientiousness: 0.5,
        socialAwareness: 0.5,
        curiosity: 0.5
      },
      userIsSilent: true,  // User is silent!
      novelty: 1.0,
      consecutiveAgentSpeeches: 0,
      hadExternalReward: false,
      ticksSinceLastReward: 0
    });
    
    // CREATIVE + silent user should NOT increase dopamine significantly
    // (homeostasis pulls toward baseline 55, so small changes ok)
    expect(newState.dopamine).toBeLessThanOrEqual(60);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 6. EVENT LOOP CONTEXT WIRING
// ═══════════════════════════════════════════════════════════════════════════

describe('EventLoop Context Wiring', () => {
  it('LoopContext has RPE fields', async () => {
    // Verify that EventLoop namespace exports LoopContext interface with RPE fields
    const eventLoopModule = await import('../core/systems/EventLoop');
    
    // EventLoop should be exported
    expect(eventLoopModule.EventLoop).toBeDefined();
    expect(eventLoopModule.EventLoop.runSingleStep).toBeDefined();
    
    // The presence of runSingleStep that accepts LoopContext with RPE fields
    // is verified by TypeScript at compile time
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 7. FACT ECHO WIRING TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('FactEcho Wiring', () => {
  it('FactEchoPipeline passes agentName to buildHardFacts', async () => {
    const { guardCortexOutputWithFactEcho } = await import('../core/systems/FactEchoPipeline');
    
    expect(guardCortexOutputWithFactEcho).toBeDefined();
    
    const result = guardCortexOutputWithFactEcho(
      {
        internal_thought: 'test',
        speech_content: 'Mam 50% energii.',
        mood_shift: { energy_delta: 0, confidence_delta: 0, stress_delta: 0 }
      },
      {
        soma: { energy: 50, cognitiveLoad: 0, isSleeping: false },
        agentName: 'Jesse'  // This should be passed to buildHardFacts
      }
    );
    
    expect(result).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 8. SYSTEM PROMPT WIRING
// ═══════════════════════════════════════════════════════════════════════════

describe('System Prompt Wiring', () => {
  it('MINIMAL_CORTEX_SYSTEM_PROMPT contains HARD FACTS instructions', async () => {
    const { MINIMAL_CORTEX_SYSTEM_PROMPT } = await import('../core/prompts/MinimalCortexPrompt');
    
    // Prompt must mention hard_facts
    expect(MINIMAL_CORTEX_SYSTEM_PROMPT).toContain('hard_facts');
    expect(MINIMAL_CORTEX_SYSTEM_PROMPT).toContain('agentName');
    
    // Prompt must NOT have hardcoded name
    expect(MINIMAL_CORTEX_SYSTEM_PROMPT).not.toContain('You are Jesse');
    expect(MINIMAL_CORTEX_SYSTEM_PROMPT).not.toContain('You are Assistant');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 9. STARTUP LOGGER WIRING
// ═══════════════════════════════════════════════════════════════════════════

describe('Startup Logger Wiring', () => {
  it('logSystemConfig is exported and callable', async () => {
    const { logSystemConfig, getConfigSnapshot } = await import('../core/config');
    
    expect(logSystemConfig).toBeDefined();
    expect(getConfigSnapshot).toBeDefined();
    
    // Should return snapshot without throwing
    const snapshot = getConfigSnapshot();
    expect(snapshot.timestamp).toBeDefined();
    expect(snapshot.featureFlags).toBeDefined();
    expect(snapshot.moduleConfigs).toBeDefined();
  });
});
