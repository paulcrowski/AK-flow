import { describe, it, expect } from 'vitest';
import { ModelRouter, runWithModelFallback } from '../../services/ModelRouter';

describe('ModelRouter', () => {
  it('should route generateJSON to json task', () => {
    expect(ModelRouter.routeForOperation('generateJSON')).toBe('json');
  });

  it('should route deepResearch to deep_research task', () => {
    expect(ModelRouter.routeForOperation('deepResearch')).toBe('deep_research');
  });

  it('should default unknown ops to text task', () => {
    expect(ModelRouter.routeForOperation('generateResponse')).toBe('text');
  });

  it('should provide fallback chain', () => {
    const chain = ModelRouter.getModelChain('text');
    expect(chain.length).toBeGreaterThanOrEqual(1);
    expect(chain[0]).toContain('flash');
  });

  it('runWithModelFallback should return second model when first fails', async () => {
    const models = ['m1', 'm2'];
    const res = await runWithModelFallback(models, async (m) => {
      if (m === 'm1') throw new Error('fail1');
      return `ok:${m}`;
    });
    expect(res.model).toBe('m2');
    expect(res.value).toBe('ok:m2');
    expect(res.attempts).toBe(2);
    expect(res.errors.length).toBe(1);
  });

  it('runWithModelFallback should throw when all models fail', async () => {
    const models = ['m1', 'm2'];
    await expect(
      runWithModelFallback(models, async () => {
        throw new Error('nope');
      })
    ).rejects.toThrow(/MODEL_FALLBACK_FAILED/);
  });
});
