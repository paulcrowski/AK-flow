import { describe, it, expect } from 'vitest';
import { ModelRouter } from '../../services/ModelRouter';

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
});
