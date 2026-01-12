import { describe, it, expect } from 'vitest';
import { mapAutonomyActionToActionType } from '@core/systems/AutonomyActionMap';

describe('autonomy action mapping', () => {
  it('maps EXPLORE_WORLD to observe', () => {
    const result = mapAutonomyActionToActionType('EXPLORE_WORLD');
    expect(result.action).toBe('observe');
    expect(result.reason).toBe('autonomy_explore_world');
  });

  it('maps REFLECT to note', () => {
    const result = mapAutonomyActionToActionType('REFLECT');
    expect(result.action).toBe('note');
    expect(result.reason).toBe('autonomy_reflect');
  });

  it('maps REST to rest', () => {
    const result = mapAutonomyActionToActionType('REST');
    expect(result.action).toBe('rest');
    expect(result.reason).toBe('autonomy_rest');
  });
});
