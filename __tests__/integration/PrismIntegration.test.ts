/**
 * PrismIntegration Tests
 * 
 * PRISM ARCHITECTURE (13/10) - Phase 2
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  checkResponse,
  needsGuardCheck
} from '@core/systems/PrismIntegration';
import { HardFacts } from '@/types';
import { evaluationBus } from '@core/systems/EvaluationBus';
import { SYSTEM_CONFIG } from '@core/config/systemConfig';

describe('PrismIntegration', () => {
  beforeEach(() => {
    evaluationBus.clear();
    // Ensure guard is enabled for tests
    (SYSTEM_CONFIG.prism as any).guardEnabled = true;
  });

  describe('checkResponse', () => {
    it('PASS when response is clean', () => {
      const hardFacts: HardFacts = { energy: 50, time: '15:30' };
      const response = 'Jestem AK-FLOW. Mam plan na dzis.';

      const result = checkResponse(response, { hardFacts });

      expect(result.guardResult.action).toBe('PASS');
      expect(result.wasModified).toBe(false);
      expect(result.response).toBe(response);
    });

    it('detects assistant-speak', () => {
      const hardFacts: HardFacts = { energy: 50 };
      const response = 'Jak moge pomoc?';

      const result = checkResponse(response, { hardFacts });

      expect(result.guardResult.action).not.toBe('PASS');
      expect(result.guardResult.issues.some(i => i.type === 'persona_drift')).toBe(true);
    });

    it('detects identity leak', () => {
      const hardFacts: HardFacts = { energy: 50 };
      const response = 'As an AI, I have 50% energy.';

      const result = checkResponse(response, { hardFacts });

      expect(result.guardResult.action).not.toBe('PASS');
      expect(result.guardResult.issues.some(i => i.type === 'identity_leak')).toBe(true);
    });

    it('returns soft fail response when max retries exceeded', () => {
      const response = 'As an AI, I think...';

      const result = checkResponse(response, { hardFacts: {} });

      expect(['RETRY', 'SOFT_FAIL']).toContain(result.guardResult.action);
      if (result.guardResult.action === 'SOFT_FAIL') {
        expect(result.wasModified).toBe(true);
      }
    });

    it('respects GUARD_ENABLED flag', () => {
      (SYSTEM_CONFIG.prism as any).guardEnabled = false;

      const hardFacts: HardFacts = { energy: 50 };
      const response = 'As an AI, I have lots of energy!';

      const result = checkResponse(response, { hardFacts });

      expect(result.guardResult.action).toBe('PASS');
      expect(result.wasModified).toBe(false);

      // Restore
      (SYSTEM_CONFIG.prism as any).guardEnabled = true;
    });

    it('uses custom agent name', () => {
      const hardFacts: HardFacts = {};
      const response = 'Jestem AK-FLOW, twoj asystent.';

      const result = checkResponse(response, {
        hardFacts,
        agentName: 'AK-FLOW'
      });

      expect(result.guardResult.action).toBe('PASS');
    });
  });

  describe('needsGuardCheck', () => {
    it('returns false for clean response', () => {
      expect(needsGuardCheck('Any response', {})).toBe(false);
    });

    it('returns true when identity leak detected', () => {
      expect(needsGuardCheck('As an AI, I think...', { energy: 50 })).toBe(true);
    });

    it('returns true when assistant-speak detected', () => {
      expect(needsGuardCheck('Jak moge pomoc?', {})).toBe(true);
    });

    it('returns false for fact-only checks', () => {
      expect(needsGuardCheck('Mam 50% energii', { energy: 50 })).toBe(false);
    });
  });

  describe('EvaluationBus Integration', () => {
    it('emits event on guard check', () => {
      const hardFacts: HardFacts = { energy: 50 };
      const response = 'Mam 50% energii.';

      checkResponse(response, { hardFacts });

      const metrics = evaluationBus.getMetrics();
      expect(metrics.total_events).toBeGreaterThan(0);
    });

    it('emits GUARD source events', () => {
      const hardFacts: HardFacts = { energy: 50 };

      checkResponse('Mam 50% energii.', { hardFacts });

      const metrics = evaluationBus.getMetrics();
      expect(metrics.events_by_source.GUARD).toBeGreaterThan(0);
    });

    it('tracks identity leaks in metrics', () => {
      checkResponse('As an AI, I think...', { hardFacts: {} });

      const metrics = evaluationBus.getMetrics();
      expect(metrics.events_by_tag['identity_leak']).toBeGreaterThan(0);
    });
  });
});
