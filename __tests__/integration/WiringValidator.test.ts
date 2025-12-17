/**
 * WiringValidator.test.ts - Tests for runtime wiring validation
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 * ALARM 3 STANDARD: These tests ensure all critical systems are wired.
 * 
 * Run after EVERY deployment:
 *   npm test -- --run WiringValidator
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * @module __tests__/WiringValidator.test.ts
 */

import { describe, it, expect } from 'vitest';
import {
  CRITICAL_SYSTEMS,
  validateWiring,
  validateWiringStrict,
  type WiringValidationResult
} from '../../core/config';

describe('WiringValidator', () => {

  describe('CRITICAL_SYSTEMS Registry', () => {
    it('contains all required systems', () => {
      const systemNames = CRITICAL_SYSTEMS.map(s => s.name);

      // These systems MUST be in the registry
      expect(systemNames).toContain('PersonaGuard');
      expect(systemNames).toContain('FactEchoPipeline');
      expect(systemNames).toContain('HardFactsBuilder');
      expect(systemNames).toContain('NeurotransmitterSystem');
      expect(systemNames).toContain('CentralConfig');
      expect(systemNames).toContain('IdentityFallback');
      expect(systemNames).toContain('HardFactsInCortexState');
    });

    it('each system has required fields', () => {
      for (const system of CRITICAL_SYSTEMS) {
        expect(system.name).toBeDefined();
        expect(system.description).toBeDefined();
        expect(system.configPath).toBeDefined();
        expect(system.testFn).toBeDefined();
        expect(typeof system.testFn).toBe('function');
      }
    });
  });

  describe('validateWiring()', () => {
    it('returns validation result with all fields', async () => {
      const result = await validateWiring();

      expect(result.timestamp).toBeDefined();
      expect(typeof result.allPassed).toBe('boolean');
      expect(Array.isArray(result.results)).toBe(true);
      expect(Array.isArray(result.criticalFailures)).toBe(true);
    });

    it('all critical systems pass validation', async () => {
      const result = await validateWiring();

      // ALL critical systems MUST pass
      expect(result.allPassed).toBe(true);
      expect(result.criticalFailures).toHaveLength(0);

      // Each result should be PASS
      for (const r of result.results) {
        expect(r.status).toBe('PASS');
      }
    });

    it('validates PersonaGuard is active', async () => {
      const result = await validateWiring();
      const guardResult = result.results.find(r => r.system === 'PersonaGuard');

      expect(guardResult).toBeDefined();
      expect(guardResult?.status).toBe('PASS');
    });

    it('validates FactEchoPipeline is active', async () => {
      const result = await validateWiring();
      const factEchoResult = result.results.find(r => r.system === 'FactEchoPipeline');

      expect(factEchoResult).toBeDefined();
      expect(factEchoResult?.status).toBe('PASS');
    });

    it('validates IdentityFallback is UNINITIALIZED_AGENT', async () => {
      const result = await validateWiring();
      const identityResult = result.results.find(r => r.system === 'IdentityFallback');

      expect(identityResult).toBeDefined();
      expect(identityResult?.status).toBe('PASS');
    });

    it('validates HardFactsInCortexState is working', async () => {
      const result = await validateWiring();
      const hardFactsResult = result.results.find(r => r.system === 'HardFactsInCortexState');

      expect(hardFactsResult).toBeDefined();
      expect(hardFactsResult?.status).toBe('PASS');
    });
  });

  describe('validateWiringStrict()', () => {
    it('does not throw when all systems pass', async () => {
      // Should not throw
      await expect(validateWiringStrict()).resolves.toBeUndefined();
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// CI/CD INVARIANT TESTS
// These should be run in CI/CD pipeline before every deployment
// ═══════════════════════════════════════════════════════════════════════════

describe('CI/CD Deployment Invariants', () => {

  it('INVARIANT: All critical systems must be active', async () => {
    const result = await validateWiring();

    expect(result.allPassed).toBe(true);

    if (!result.allPassed) {
      console.error('═══════════════════════════════════════════════════════');
      console.error('🚨 DEPLOYMENT BLOCKED: Critical systems not wired!');
      console.error('Failed systems:', result.criticalFailures);
      console.error('═══════════════════════════════════════════════════════');
    }
  });

  it('INVARIANT: No hardcoded Assistant identity', async () => {
    const { DEFAULT_CORE_IDENTITY } = await import('../../core/types/CoreIdentity');

    expect(DEFAULT_CORE_IDENTITY.name).not.toBe('Assistant');
    expect(DEFAULT_CORE_IDENTITY.name).toBe('UNINITIALIZED_AGENT');
  });

  it('INVARIANT: CentralConfig is single source of truth', async () => {
    const { SYSTEM_CONFIG } = await import('../../core/config/systemConfig');

    expect(SYSTEM_CONFIG.prism.guardEnabled).toBeTypeOf('boolean');
  });

  it('INVARIANT: PersonaGuard is integrated in pipeline', async () => {
    const { isPrismEnabled } = await import('../../core/systems/PrismPipeline');

    expect(isPrismEnabled()).toBe(true);
  });

  it('INVARIANT: HardFacts include date and agentName', async () => {
    const { buildHardFacts } = await import('../../core/systems/HardFactsBuilder');

    const facts = buildHardFacts({ agentName: 'TestAgent' });

    expect(facts.date).toBeDefined();
    expect(facts.time).toBeDefined();
    expect(facts.agentName).toBe('TestAgent');
  });
});
