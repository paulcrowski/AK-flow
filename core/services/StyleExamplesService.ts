/**
 * StyleExamplesService - Pobieranie wzorców stylu
 * 
 * Pobiera najlepsze własne wypowiedzi agenta jako
 * few-shot examples dla LLM.
 * 
 * @module core/services/StyleExamplesService
 */

import { supabase } from '@/services/supabase';
import type { StyleExample, StyleContext } from '../types/StyleExample';
import { MAX_STYLE_EXAMPLES } from '../types/StyleExample';

/**
 * Normalizuje wartość do zakresu 0-1
 */
function normalizeToRatio(value: number, min: number, max: number): number {
  return Math.max(0, Math.min(1, (value - min) / (max - min)));
}

/**
 * Pobiera najlepsze własne wypowiedzi agenta jako wzorzec stylu.
 * 
 * @param agentId - ID agenta
 * @param context - Opcjonalny kontekst do filtrowania
 * @param limit - Maksymalna liczba przykładów (domyślnie 3)
 */
export async function fetchStyleExamples(
  agentId: string,
  context?: StyleContext,
  limit: number = MAX_STYLE_EXAMPLES
): Promise<StyleExample[]> {
  try {
    let query = supabase
      .from('memories')
      .select('content, style_rating, emotional_valence, arousal_level, interaction_context')
      .eq('agent_id', agentId)
      .eq('memory_type', 'SELF_SPEECH')
      .not('style_rating', 'is', null)
      .order('style_rating', { ascending: false })
      .limit(limit * 2); // Pobierz więcej, żeby filtrować

    // Jeśli mamy kontekst, preferuj pasujące
    if (context) {
      query = query.eq('interaction_context', context);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[StyleExamples] Database error:', error);
      return [];
    }

    if (!data || data.length === 0) {
      return [];
    }

    return data.slice(0, limit).map(m => ({
      text: m.content,
      rating: m.style_rating ?? 5,
      emotional_state: {
        confidence: normalizeToRatio(m.emotional_valence ?? 0, -100, 100),
        energy: normalizeToRatio(m.arousal_level ?? 50, 0, 100),
        stress: 1 - normalizeToRatio(m.emotional_valence ?? 0, -100, 100) // inverse
      },
      context: (m.interaction_context as StyleContext) ?? 'casual'
    }));
  } catch (error) {
    console.error('[StyleExamples] Error:', error);
    return [];
  }
}

/**
 * Zapisuje nową wypowiedź z oceną stylu
 */
export async function saveStyledSpeech(
  agentId: string,
  content: string,
  rating: number,
  context: StyleContext,
  emotionalState: { valence: number; arousal: number }
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('memories')
      .insert({
        agent_id: agentId,
        memory_type: 'SELF_SPEECH',
        content,
        style_rating: rating,
        interaction_context: context,
        emotional_valence: emotionalState.valence,
        arousal_level: emotionalState.arousal
      });

    if (error) {
      console.error('[StyleExamples] Save error:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('[StyleExamples] Save error:', error);
    return false;
  }
}
