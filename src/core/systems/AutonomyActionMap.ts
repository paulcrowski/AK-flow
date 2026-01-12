import type { AutonomyAction } from './AutonomyRepertoire';
import type { ActionType } from './ActionSelector';

export type MappedAutonomyAction = { action: ActionType; reason: string };

export function mapAutonomyActionToActionType(action: AutonomyAction): MappedAutonomyAction {
  switch (action) {
    case 'EXPLORE_WORLD':
      return { action: 'observe', reason: 'autonomy_explore_world' };
    case 'EXPLORE_MEMORY':
      return { action: 'note', reason: 'autonomy_explore_memory' };
    case 'REFLECT':
      return { action: 'note', reason: 'autonomy_reflect' };
    case 'REST':
      return { action: 'rest', reason: 'autonomy_rest' };
    default:
      return { action: 'note', reason: `autonomy_${String(action).toLowerCase()}` };
  }
}
