// GoalSystem.ts - FAZA 3: Goal Formation (11/10)
// FAZA 4.3: Refractory Period + Dopamine Redirect
// FAZA 5: GoalJournal Integration

import { LimbicState, SomaState, NeurotransmitterState, Goal, GoalState } from '../../types';
import { GoalJournalService, JournalGoal } from '../../services/GoalJournalService';
import { getCurrentAgentId } from '../../services/supabase';
import { SYSTEM_CONFIG } from '../config/systemConfig';

// Simple text similarity (Jaccard on words)
function textSimilarity(a: string, b: string): number {
    const wordsA = new Set(a.toLowerCase().split(/\s+/).filter(w => w.length > 3));
    const wordsB = new Set(b.toLowerCase().split(/\s+/).filter(w => w.length > 3));
    if (wordsA.size === 0 && wordsB.size === 0) return 1;
    if (wordsA.size === 0 || wordsB.size === 0) return 0;
    const intersection = [...wordsA].filter(w => wordsB.has(w)).length;
    const union = new Set([...wordsA, ...wordsB]).size;
    return intersection / union;
}

export interface GoalContext {
  now: number;
  lastUserInteractionAt: number;
  soma: SomaState;
  neuro: NeurotransmitterState;
  limbic: LimbicState;
}

// DEPRECATED: Use SYSTEM_CONFIG.goals instead
const GOAL_SYSTEM_ENABLED = () => SYSTEM_CONFIG.goals.enabled;
const GOAL_MIN_SILENCE_MS = () => SYSTEM_CONFIG.goals.minSilenceMs;
const GOAL_MAX_PER_HOUR = () => SYSTEM_CONFIG.goals.maxPerHour;

export function shouldConsiderGoal(ctx: GoalContext, goalState: GoalState): boolean {
  if (!GOAL_SYSTEM_ENABLED()) return false;

  const silenceMs = ctx.now - ctx.lastUserInteractionAt;

  const enoughSilence = silenceMs > GOAL_MIN_SILENCE_MS();
  const enoughEnergy = ctx.soma.energy > 30;
  const notOverwhelmed = ctx.limbic.frustration < 0.8 && ctx.limbic.fear < 0.9;
  const cutoff = ctx.now - 60 * 60 * 1000;
  const recentGoals = (goalState.goalsFormedTimestamps || []).filter(t => t >= cutoff);
  const underHourlyLimit = recentGoals.length < GOAL_MAX_PER_HOUR();

  return enoughSilence && enoughEnergy && notOverwhelmed && underHourlyLimit;
}

export async function formGoal(ctx: GoalContext, goalState: GoalState): Promise<Goal | null> {
  if (!shouldConsiderGoal(ctx, goalState)) return null;

  const highFearOrFrustration = ctx.limbic.fear > 0.6 || ctx.limbic.frustration > 0.6;

  const source: Goal['source'] = highFearOrFrustration ? 'empathy' : 'curiosity';

  // FAZA 4.2 KROK 4: Dopamina -> Action Redirect
  let description = '';

  if (source === 'empathy') {
    description = 'Sprawdź, jak czuje się użytkownik i odnieś się do wcześniejszej rozmowy.';
  } else {
    // High dopamine => Action/Search bias
    if (ctx.neuro.dopamine > 70) {
         description = 'Wykonaj głęboką analizę (Deep Research) lub wyszukaj nowe informacje na temat ostatniego wątku.';
    } else {
         description = 'Zaproponuj nowy wątek do eksploracji, powiązany z ostatnimi tematami.';
    }
  }

  // FAZA 4.3: Refractory Period (Biologiczny hamulec pętli ciekawości)
  if (source === 'curiosity') {
    const recentCuriosity = (goalState.lastGoals || [])
        .filter(g => g.source === 'curiosity')
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 3); // Ostatnie 3 cele curiosity

    // WARUNEK 1: Jeśli ostatni cel curiosity powstał PO ostatniej interakcji usera
    // = user milczy od tamtej pory = nie twórz kolejnego
    const lastCuriosity = recentCuriosity[0];
    if (lastCuriosity && lastCuriosity.timestamp >= ctx.lastUserInteractionAt) {
        console.log('[GoalSystem] REFRACTORY: User silent since last curiosity goal. Blocking new goal.');
        return null;
    }

    // WARUNEK 2: Sprawdź podobieństwo do ostatnich 2-3 celów
    // Jeśli nowy cel jest >70% podobny do któregokolwiek z ostatnich → blokuj
    for (const prev of recentCuriosity) {
        const similarity = textSimilarity(description, prev.description);
        if (similarity > 0.7) {
            // Pozwól tylko jeśli minęło dużo czasu (np. 30 min)
            const cooldownMs = 30 * 60 * 1000;
            if (ctx.now - prev.timestamp < cooldownMs) {
                console.log(`[GoalSystem] REFRACTORY: Similar goal detected (${(similarity * 100).toFixed(0)}% match). Cooldown active.`);
                return null;
            }
        }
    }

    // WARUNEK 3: Jeśli mamy już 2+ cele curiosity w ostatnich 5 minutach → za dużo
    const fiveMinAgo = ctx.now - 5 * 60 * 1000;
    const recentCount = recentCuriosity.filter(g => g.timestamp > fiveMinAgo).length;
    if (recentCount >= 2) {
        console.log(`[GoalSystem] REFRACTORY: Too many curiosity goals recently (${recentCount} in 5min). Cooling down.`);
        return null;
    }
  }

  const priority = source === 'empathy' ? 0.9 : 0.6;

  const goal: Goal = {
    id: `goal-${ctx.now}`,
    description,
    priority,
    progress: 0,
    source,
    createdAt: ctx.now,
  };

  // FAZA 5: Persist to GoalJournal (fire and forget)
  const agentId = getCurrentAgentId();
  if (agentId) {
    GoalJournalService.createGoal({
      agentId,
      description,
      source,
      priority
    }).catch(err => console.warn('[GoalSystem] Journal persist failed:', err));
  }

  return goal;
}

// FAZA 5: Load persistent goals from journal on boot
export async function loadPersistentGoals(): Promise<Goal[]> {
  const agentId = getCurrentAgentId();
  if (!agentId) return [];

  try {
    const journalGoals = await GoalJournalService.getActiveGoals(agentId);
    return journalGoals.map(jg => ({
      id: jg.id,
      description: jg.description,
      priority: jg.priority,
      progress: jg.progress,
      source: jg.source as Goal['source'],
      createdAt: new Date(jg.createdAt).getTime()
    }));
  } catch (error) {
    console.warn('[GoalSystem] Failed to load persistent goals:', error);
    return [];
  }
}

// FAZA 5: Mark goal as completed in journal
export async function completeGoalInJournal(goalId: string, notes?: string): Promise<void> {
  try {
    await GoalJournalService.completeGoal(goalId, notes);
    console.log(`[GoalSystem] Goal ${goalId} marked complete in journal`);
  } catch (error) {
    console.warn('[GoalSystem] Failed to complete goal in journal:', error);
  }
}
