import { describe, it, expect } from 'vitest';
import { applyActionFeedback } from '@core/systems/eventloop/AutonomousVolitionStep';

describe('applyActionFeedback', () => {
  it('successful READ_FILE reduces curiosity', () => {
    const before = { curiosity: 0.8, satisfaction: 0.3, frustration: 0.2, fear: 0.1 };
    const after = applyActionFeedback({ success: true, tool: 'READ_FILE' }, before);
    expect(after.curiosity).toBeLessThan(before.curiosity);
    expect(after.satisfaction).toBeGreaterThan(before.satisfaction);
  });

  it('failed tool increases frustration', () => {
    const before = { curiosity: 0.5, satisfaction: 0.5, frustration: 0.2, fear: 0.1 };
    const after = applyActionFeedback({ success: false, tool: 'READ_FILE' }, before);
    expect(after.frustration).toBeGreaterThan(before.frustration);
  });
});
